import { pipeline, Pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { searchSimilarContent } from '../milvus/vectors';

// Custom error type
class TensorConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TensorConversionError';
  }
}

// Utility function for tensor conversion
function convertToTypedArray(data: ArrayBuffer | ArrayLike<number>): Float32Array {
  try {
    // If data is ArrayBuffer, create a view first
    if (data instanceof ArrayBuffer) {
      return new Float32Array(data);
    }
    
    // If it's BigInt64Array, convert to numbers
    if (data instanceof BigInt64Array) {
      return new Float32Array(Array.from(data, Number));
    }
    
    // If already a typed array, convert to Float32Array
    if (ArrayBuffer.isView(data)) {
      return new Float32Array(Array.from(data as any));
    }
    
    // If regular array-like object, convert directly
    return new Float32Array(data);
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    console.error('Error converting tensor data:', error);
    throw new TensorConversionError(`Failed to convert tensor data: ${error.message}`);
  }
}

// Define interfaces
export interface EmbeddingOutput {
  data: Float32Array;
  dimensions: number;
}

interface TensorInput {
  input_ids: { cpuData: ArrayLike<number> };
  attention_mask: { cpuData: ArrayLike<number> };
  token_type_ids: { cpuData: ArrayLike<number> };
}

interface ProcessedTensor {
  input_ids: Float32Array;
  attention_mask: Float32Array;
  token_type_ids: Float32Array;
}

interface ModelOutput {
  data: Float32Array | ArrayBuffer | ArrayLike<number>;
}

export async function getEmbedding(text: string): Promise<Float32Array> {
  const { data } = await EmbeddingModel.generateEmbedding(text);
  return data;
}

export class EmbeddingModel {
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
        
        const options = {
          revision: 'main',
          quantized: false,
          executionProviders: ['cpu'] as const,
          graphOptimizationLevel: 'all' as const,
        };

        const model = await pipeline('feature-extraction', 'Xenova/gte-base', options);
        
        if (!model) {
          throw new Error('Failed to initialize embedding model');
        }

        this.instance = model as FeatureExtractionPipeline;
        return this.instance;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        console.error('Error loading model:', error);
        throw new Error(`Model initialization failed: ${error.message}`);
      } finally {
        this.isLoading = false;
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  static async processTensorInput(input: TensorInput): Promise<ProcessedTensor> {
    try {
      // Convert BigInt64Array to Float32Array
      const convertInput = (data: ArrayLike<number>) => {
        if (data instanceof BigInt64Array) {
          return new Float32Array(Array.from(data).map(Number));
        }
        return new Float32Array(Array.from(data));
      };
  
      return {
        input_ids: convertInput(input.input_ids.cpuData),
        attention_mask: convertInput(input.attention_mask.cpuData),
        token_type_ids: convertInput(input.token_type_ids.cpuData)
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      console.error('Error processing tensor input:', error);
      throw new Error(`Tensor processing failed: ${error.message}`);
    }
  }

  static async generateEmbedding(text: string): Promise<EmbeddingOutput> {
    if (!text) {
      throw new Error("Text may not be null or undefined");
    }
    
    try {
      const model = await this.getInstance();
      const output = await model(text, {
        pooling: 'mean',
        normalize: true
      }) as ModelOutput;
  
      // Convert the output data to Float32Array using our utility function
      const embedding = convertToTypedArray(output.data);
      
      return {
        data: embedding,
        dimensions: embedding.length
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      console.error('Error generating embedding:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }
}

interface SearchParams {
  userId: string;
  embedding: number[];
  limit?: number;
  contentTypes?: string[];
}

export async function semanticSearch(
  query: string,
  userId: string,
  limit: number = 5
): Promise<any[]> {
  try {
    const { data } = await EmbeddingModel.generateEmbedding(query);
    
    return await searchSimilarContent({
      userId,
      embedding: Array.from(data),
      limit,
      contentTypes: ['document', 'note', 'url']
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    console.error('Error in semantic search:', error);
    throw new Error(`Semantic search failed: ${error.message}`);
  }
}