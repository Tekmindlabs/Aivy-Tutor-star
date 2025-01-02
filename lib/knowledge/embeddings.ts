import { pipeline, Pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { searchSimilarContent } from '../milvus/vectors';

// Create a class to manage the model instance
class EmbeddingModel {
  private static instance: FeatureExtractionPipeline | null = null;
  private static isLoading: boolean = false;
  private static loadingPromise: Promise<FeatureExtractionPipeline> | null = null;

  static async getInstance(): Promise<FeatureExtractionPipeline> {
    if (this.instance) {
      return this.instance;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.isLoading = true;
    this.loadingPromise = (async () => {
      try {
        console.log('Loading GTE-Base model...');
        // Initialize the model with specific configuration
        const model = await pipeline('feature-extraction', 'Xenova/gte-base', {
          revision: 'main',
          quantized: false, // Set to true if you want to use quantized model for better performance
        }) as FeatureExtractionPipeline;

        if (!model) {
          throw new Error('Failed to initialize embedding model');
        }

        this.instance = model;
        return this.instance;
      } catch (error) {
        console.error('Error loading model:', error);
        throw error;
      } finally {
        this.isLoading = false;
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }
}

export interface EmbeddingOutput {
  data: Float32Array | number[];
}

export async function getEmbedding(text: string): Promise<number[]> {
  try {
    // Get model instance
    const model = await EmbeddingModel.getInstance();
    if (!model) {
      throw new Error('Model not initialized');
    }

    // Generate embedding
    const output = await model(text, {
      pooling: 'mean',
      normalize: true
    }) as EmbeddingOutput;

    // Convert to regular array
    return Array.from(output.data);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Interface for search parameters
interface SearchParams {
  userId: string;
  embedding: number[];
  limit?: number;
  contentTypes?: string[];
}

// Keep the existing semanticSearch function
export async function semanticSearch(
  query: string,
  userId: string,
  limit: number = 5
): Promise<any[]> {
  try {
    const queryEmbedding = await getEmbedding(query);
    
    return await searchSimilarContent({
      userId,
      embedding: queryEmbedding,
      limit,
      contentTypes: ['document', 'note', 'url']
    });
  } catch (error) {
    console.error('Error in semantic search:', error);
    throw error;
  }
}

// Export the EmbeddingModel class if needed elsewhere
export { EmbeddingModel };