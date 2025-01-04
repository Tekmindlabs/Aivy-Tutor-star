import { prisma } from '../../lib/prisma';
import { getEmbedding } from './embeddings';
import { insertVector } from '../milvus/vectors';
import { createRelationship } from '../milvus/knowledge-graph';
import { searchSimilarContent } from '../milvus/vectors';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { Document, VectorResult } from './types';

// Custom error types
class DocumentProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentProcessingError';
  }
}

class TextExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TextExtractionError';
  }
}

// Supported file types
const SUPPORTED_FILE_TYPES = {
  PDF: 'application/pdf',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TXT: 'text/plain',
};

export async function processDocument(
  file: File,
  userId: string
): Promise<Document> {
  try {
    // Validate file type
    if (!Object.values(SUPPORTED_FILE_TYPES).includes(file.type)) {
      throw new DocumentProcessingError(`Unsupported file type: ${file.type}`);
    }

    // Extract text content with chunking if needed
    const content = await extractText(file);
    if (!content || content.trim().length === 0) {
      throw new DocumentProcessingError('No content could be extracted from the file');
    }

    // Generate embedding with validation
    let embedding: number[];
    try {
      console.log('Generating embedding for document...');
      const embeddingFloat32 = await getEmbedding(content);
      
      // Validate embedding
      if (!(embeddingFloat32 instanceof Float32Array)) {
        throw new DocumentProcessingError('Invalid embedding format: expected Float32Array');
      }

      embedding = Array.from(embeddingFloat32);
      
      if (embedding.length !== 1024) { // Change from 768 to 1024

        throw new DocumentProcessingError(`Invalid embedding dimension: ${embedding.length}, expected 1024`);
      
      }

      console.log('Document embedding generated successfully:', embedding.length);
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new DocumentProcessingError(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Store document in Prisma with proper metadata
    const document = await prisma.document.create({
      data: {
        userId,
        title: file.name,
        content: content.slice(0, 1000000),
        fileType: file.type,
        metadata: {
          size: file.size,
          lastModified: file.lastModified,
          fileType: file.type,
          embeddingDimension: embedding.length,
          processingTimestamp: new Date().toISOString()
        },
        version: 1,
        vectorId: null
      },
    });

    // Store vector in Milvus with validation
    try {
      const vectorResult = await insertVector({
        userId,
        contentType: 'document',
        contentId: document.id,
        embedding,
        metadata: {
          title: file.name,
          fileType: file.type,
          documentId: document.id
        }
      });

      // Update document with vector ID
      const updatedDocument = await prisma.document.update({
        where: { id: document.id },
        data: { vectorId: vectorResult.id }
      });

      // Create relationships with error handling
      await createDocumentRelationships(document.id, content, userId).catch(error => {
        console.error('Warning: Failed to create relationships:', error);
      });

      return {
        id: updatedDocument.id,
        title: updatedDocument.title,
        content: updatedDocument.content,
        userId: updatedDocument.userId,
        vectorId: updatedDocument.vectorId,
        fileType: updatedDocument.fileType,
        metadata: updatedDocument.metadata ? 
          (typeof updatedDocument.metadata === 'object' ? updatedDocument.metadata : null) : null,
        version: updatedDocument.version,
        createdAt: updatedDocument.createdAt,
        updatedAt: updatedDocument.updatedAt
      };
    } catch (error) {
      // Clean up document if vector storage fails
      await prisma.document.delete({ where: { id: document.id } });
      throw new DocumentProcessingError(
        `Failed to store vector: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  } catch (error) {
    console.error('Error processing document:', error);
    throw error instanceof DocumentProcessingError ? error : new DocumentProcessingError(
      `Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function extractText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  switch (file.type) {
    case SUPPORTED_FILE_TYPES.PDF:
      return extractPdfText(buffer);
    case SUPPORTED_FILE_TYPES.DOC:
    case SUPPORTED_FILE_TYPES.DOCX:
      return extractWordText(buffer);
    case SUPPORTED_FILE_TYPES.TXT:
      return extractTxtText(buffer);
    default:
      throw new TextExtractionError(`Unsupported file type: ${file.type}`);
  }
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }

    return text.trim();
  } catch (error) {
    throw new TextExtractionError(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function extractWordText(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value.trim();
  } catch (error) {
    throw new TextExtractionError(
      `Failed to extract text from Word document: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function extractTxtText(buffer: ArrayBuffer): Promise<string> {
  try {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer).trim();
  } catch (error) {
    throw new TextExtractionError(
      `Failed to extract text from TXT file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function createDocumentRelationships(
  documentId: string,
  content: string,
  userId: string
): Promise<void> {
  try {
    const embeddingFloat32 = await getEmbedding(content);
    
    if (!(embeddingFloat32 instanceof Float32Array)) {
      throw new Error('Invalid embedding format for relationship creation');
    }
    
    const embedding = Array.from(embeddingFloat32);
    
    const similar = await searchSimilarContent({
      userId,
      embedding,
      limit: 3,
      contentTypes: ['document']
    });

    const relationshipPromises = similar.map((result: { content_id: string; score: number }) => {
      if (result.content_id !== documentId) {
        return createRelationship({
          userId,
          sourceId: documentId,
          targetId: result.content_id,
          relationshipType: 'similar_to',
          metadata: {
            similarity_score: result.score,
            type: 'document-similarity',
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    await Promise.all(relationshipPromises.filter(Boolean));
  } catch (error) {
    throw new Error(
      `Failed to create document relationships: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}