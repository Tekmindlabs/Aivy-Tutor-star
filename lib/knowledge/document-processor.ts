import { prisma } from '../../lib/prisma';
import { getEmbedding } from './embeddings';
import { insertVector } from '../milvus/vectors';
import { createRelationship } from '../milvus/knowledge-graph';
import { searchSimilarContent } from '../milvus/vectors';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { Document, VectorResult } from './types';
import path from 'path';
import { fileURLToPath } from 'url';

interface DocumentMetadata {
  size: number;
  lastModified: number;
  fileType: string;
  embeddingDimension?: number;
  processingTimestamp: string;
  previousVersions?: Array<{
    version: number;
    updatedAt: Date;
  }>;
  [key: string]: any; // Add this index signature
}

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

// Helper function to get proto path
function getProtoPath() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const basePath = isDevelopment 
    ? path.join(process.cwd(), 'public', 'proto') 
    : path.join(process.cwd(), '.next', 'static', 'proto');
  return path.join(basePath, 'schema.proto');
}

async function checkExistingDocument(
  userId: string,
  content: string,
  fileName: string
): Promise<Document | null> {
  try {
    const doc = await prisma.document.findFirst({
      where: {
        userId,
        content,
        title: fileName
      }
    });

    if (!doc) return null;

    return {
      ...doc,
      metadata: doc.metadata as Document['metadata']
    } as Document;
  } catch (error) {
    console.error('Error checking existing document:', error);
    return null;
  }
}

// Add this helper function for type safety
function sanitizeMetadata(metadata: any): DocumentMetadata {
  const sanitized: DocumentMetadata = {
    size: Number(metadata.size) || 0,
    lastModified: Number(metadata.lastModified) || Date.now(),
    fileType: String(metadata.fileType) || '',
    processingTimestamp: new Date().toISOString(),
    previousVersions: Array.isArray(metadata.previousVersions) 
      ? metadata.previousVersions.map((v: any) => ({
          version: Number(v.version),
          updatedAt: new Date(v.updatedAt)
        }))
      : [],
    ...(metadata.embeddingDimension && { 
      embeddingDimension: Number(metadata.embeddingDimension) 
    })
  };

  return sanitized;
}

export async function processDocument(
  file: File,
  userId: string
): Promise<Document> {
  try {
    // Validate user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new DocumentProcessingError('Invalid user ID');
    }

    // Validate file type
    if (!Object.values(SUPPORTED_FILE_TYPES).includes(file.type)) {
      throw new DocumentProcessingError(`Unsupported file type: ${file.type}`);
    }

    // Use the correct proto path
    const protoPath = getProtoPath();

    // Extract text content with chunking if needed
    const content = await extractText(file);
    if (!content || content.trim().length === 0) {
      throw new DocumentProcessingError('No content could be extracted from the file');
    }
    const existingDocument = await checkExistingDocument(userId, content, file.name);


    if (existingDocument) {
      const currentMetadata = existingDocument.metadata as DocumentMetadata;
      const updatedMetadata = sanitizeMetadata({
        ...currentMetadata,
        previousVersions: [
          ...(currentMetadata?.previousVersions || []),
          {
            version: existingDocument.version,
            updatedAt: existingDocument.updatedAt
          }
        ],
        lastModified: file.lastModified,
        size: file.size,
        processingTimestamp: new Date().toISOString()
      });
    
      const updatedDocument = await prisma.document.update({
        where: { id: existingDocument.id },
        data: {
          version: existingDocument.version + 1,
          updatedAt: new Date(),
          metadata: updatedMetadata as any // Type assertion to satisfy Prisma
        }
      });
    
      return {
        ...updatedDocument,
        metadata: updatedMetadata
      } as Document;
    }


    // Generate embedding for new document

    let embedding: number[];

    try {
      console.log('Generating embedding for document...');
      const embeddingFloat32 = await getEmbedding(content);
      
      // Validate embedding
      if (!(embeddingFloat32 instanceof Float32Array)) {
        throw new DocumentProcessingError('Invalid embedding format: expected Float32Array');
      }

      embedding = Array.from(embeddingFloat32);
      
      if (embedding.length !== 1024) {
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
    const newDocumentMetadata = sanitizeMetadata({
      size: file.size,
      lastModified: file.lastModified,
      fileType: file.type,
      embeddingDimension: embedding.length,
      processingTimestamp: new Date().toISOString(),
      previousVersions: []
    });
    
    const document = await prisma.document.create({
      data: {
        userId,
        title: file.name,
        content: content.slice(0, 1000000),
        fileType: file.type,
        metadata: newDocumentMetadata as any, // Type assertion to satisfy Prisma
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
          (typeof updatedDocument.metadata === 'object' ? sanitizeMetadata(updatedDocument.metadata) : null) : null,
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

    // Add validation to ensure similar is an array
    if (!Array.isArray(similar)) {
      console.warn('searchSimilarContent did not return an array:', similar);
      return; // Exit early if no valid results
    }

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
