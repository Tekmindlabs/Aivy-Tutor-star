import { pipeline, Pipeline } from '@xenova/transformers';

// Create a class to manage the model instance
class EmbeddingModel {
  private static instance: Pipeline | null = null;
  private static isLoading: boolean = false;
  private static loadingPromise: Promise<Pipeline> | null = null;

  static async getInstance(): Promise<Pipeline> {
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
          quantized: false // Set to true if you want to use quantized model for better performance
        });
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

export async function getEmbedding(text: string): Promise<number[]> {
  try {
    // Get model instance
    const model = await EmbeddingModel.getInstance();

    // Generate embedding
    const output = await model(text, {
      pooling: 'mean',
      normalize: true
    });

    // Convert to regular array
    return Array.from(output.data);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Keep the existing semanticSearch function
export async function semanticSearch(
  query: string,
  userId: string,
  limit: number = 5
): Promise<any[]> {
  const queryEmbedding = await getEmbedding(query);
  return await searchSimilarContent({
    userId,
    embedding: queryEmbedding,
    limit,
    contentTypes: ['document', 'note', 'url']
  });
}