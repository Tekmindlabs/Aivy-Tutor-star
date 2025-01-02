import { getEmbedding } from '@/lib/knowledge/embeddings';
import { insertVector, searchSimilarContent } from '@/lib/milvus/vectors';
import { Document, Note, URL, Vector } from '@/lib/knowledge/types';
import { handleMilvusError } from '@/lib/milvus/error-handler';

export class KnowledgeService {
  async addDocument(userId: string, document: Document): Promise<void> {
    try {
      const embedding = await getEmbedding(document.content);
      
      await insertVector({
        userId,
        contentType: 'document',
        contentId: document.id,
        embedding,
        metadata: {
          title: document.title,
          fileType: document.fileType,
          version: document.version
        }
      });
    } catch (error) {
      handleMilvusError(error);
    }
  }

  async searchRelatedContent(userId: string, query: string): Promise<Vector[]> {
    try {
      const embedding = await getEmbedding(query);
      const results = await searchSimilarContent({
        userId,
        embedding,
        limit: 5,
        contentTypes: ['document', 'note', 'url']
      });
      return results;
    } catch (error) {
      handleMilvusError(error);
      return [];
    }
  }

  async addNote(userId: string, note: Note): Promise<void> {
    try {
      const embedding = await getEmbedding(note.content);
      await insertVector({
        userId,
        contentType: 'note',
        contentId: note.id,
        embedding,
        metadata: {
          title: note.title,
          tags: note.tags
        }
      });
    } catch (error) {
      handleMilvusError(error);
    }
  }

  async addURL(userId: string, url: URL): Promise<void> {
    try {
      const embedding = await getEmbedding(url.content);
      await insertVector({
        userId,
        contentType: 'url',
        contentId: url.id,
        embedding,
        metadata: {
          url: url.url,
          title: url.title
        }
      });
    } catch (error) {
      handleMilvusError(error);
    }
  }
}