import { prisma } from '@/lib/prisma';
import { getEmbedding } from './embeddings';
import { insertVector } from '../milvus/vectors';
import { createRelationship } from '../milvus/knowledge-graph';
import { searchSimilarContent } from '../milvus/vectors';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { Document, VectorResult } from './types';

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
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    // Extract text content
    const content = await extractText(file);
    if (!content) {
      throw new Error('No content could be extracted from the file');
    }

    // Generate embedding
    const embeddingFloat32 = await getEmbedding(content);
    const embedding = Array.from(embeddingFloat32);
    console.log('Document embedding generated:', embedding.length);

    // Store document in Prisma
    const document = await prisma.document.create({
      data: {
        userId,
        title: file.name,
        content,
        fileType: file.type,
        metadata: JSON.stringify({
          size: file.size,
          lastModified: file.lastModified,
          fileType: file.type
        }),
        version: 1,
        vectorId: null
      },
    });

    // Store vector in Milvus
    const vectorResult = await insertVector({
      userId,
      contentType: 'document',
      contentId: document.id,
      embedding,
      metadata: {
        title: file.name,
        fileType: file.type
      }
    }) as VectorResult;

    // Update document with vector ID
    const updatedDocument = await prisma.document.update({
      where: { id: document.id },
      data: { vectorId: vectorResult.id }
    });

    // Create relationships
    await createDocumentRelationships(document.id, content, userId);

    // Return document with all required fields
    return {
      id: updatedDocument.id,
      title: updatedDocument.title,
      content: updatedDocument.content,
      userId: updatedDocument.userId,
      vectorId: updatedDocument.vectorId,
      fileType: file.type, // Use the original file type
      metadata: typeof updatedDocument.metadata === 'string' 
        ? JSON.parse(updatedDocument.metadata) 
        : updatedDocument.metadata,
      version: updatedDocument.version,
      createdAt: updatedDocument.createdAt,
      updatedAt: updatedDocument.updatedAt
    };
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
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
      throw new Error(`Unsupported file type: ${file.type}`);
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
    console.error('Error extracting PDF text:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function extractWordText(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value.trim();
  } catch (error) {
    console.error('Error extracting Word document text:', error);
    throw new Error('Failed to extract text from Word document');
  }
}

async function extractTxtText(buffer: ArrayBuffer): Promise<string> {
  try {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer).trim();
  } catch (error) {
    console.error('Error extracting TXT text:', error);
    throw new Error('Failed to extract text from TXT file');
  }
}

async function createDocumentRelationships(
  documentId: string,
  content: string,
  userId: string
) {
  try {
    const embeddingFloat32 = await getEmbedding(content);
    const embedding = Array.from(embeddingFloat32);
    
    const similar = await searchSimilarContent({
      userId,
      embedding,
      limit: 3,
      contentTypes: ['document']
    });

    for (const result of similar) {
      if (result.content_id !== documentId) {
        await createRelationship({
          userId,
          sourceId: documentId,
          targetId: result.content_id,
          relationshipType: 'similar_to',
          metadata: {
            similarity_score: result.score,
            type: 'document-similarity'
          }
        });
      }
    }
  } catch (error) {
    console.error('Error creating document relationships:', error);
  }
}