import { pipeline, Pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { searchSimilarContent } from '../milvus/vectors';

// Add utility function for tensor conversion
function convertToTypedArray(data: any[]): Float32Array {
  try {
    return new Float32Array(data);
  } catch (error) {
    console.error('Error converting tensor data:', error);
    throw new Error('Failed to convert tensor data to proper format');
  }
}

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
        
        // Add ONNX Runtime configuration
        const options = {
          executionProviders: ['cpu'],
          graphOptimizationLevel: 'all',
          tensorFormat: {
            inputFormat: 'float32',
            outputFormat: 'float32'
          }
        };

        // Initialize the model with updated configuration
        const model = await pipeline('feature-extraction', 'Xenova/gte-base', {
          revision: 'main',
          quantized: false,
          ...options
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

  // Add method to process input tensors
  static async processTensorInput(input: any) {
    const tensor = {
      input_ids: convertToTypedArray(input.input_ids.cpuData),
      attention_mask: convertToTypedArray(input.attention_mask.cpuData),
      token_type_ids: convertToTypedArray(input.token_type_ids.cpuData)
    };
    return tensor;
  }
}

export interface EmbeddingOutput {
  data: Float32Array | number[];
}

export async function getEmbedding(text: string): Promise<number[]> {
  if (!text) {
    throw new Error("text may not be null or undefined");
  }
  
  try {
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