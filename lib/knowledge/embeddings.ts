import { pipeline, Pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { searchSimilarContent } from '../milvus/vectors';

// Custom error type
class TensorConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TensorConversionError';
  }
}

// Updated tensor conversion utility with proper type handling
function convertToTypedArray(data: unknown): Float32Array {
  try {
    // Handle direct Float32Array
    if (data instanceof Float32Array) {
      return data;
    }

    // Handle tensor-like objects with cpuData property
    if (data && typeof data === 'object' && 'cpuData' in data) {
      const cpuData = data.cpuData;
      
      // Handle BigInt64Array
      if (cpuData instanceof BigInt64Array) {
        return new Float32Array(Array.from(cpuData).map(Number));
      }
      
      // Handle TypedArrays
      if (ArrayBuffer.isView(cpuData)) {
        return new Float32Array(Array.from(cpuData));
      }
      
      // Handle array-like objects
      if (Array.isArray(cpuData)) {
        return new Float32Array(cpuData);
      }
    }

    // Handle direct BigInt64Array
    if (data instanceof BigInt64Array) {
      return new Float32Array(Array.from(data).map(Number));
    }

    // Handle ArrayBuffer
    if (data instanceof ArrayBuffer) {
      return new Float32Array(data);
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return new Float32Array(data);
    }

    throw new TensorConversionError('Unsupported data type for tensor conversion');
  } catch (error) {
    if (error instanceof Error) {
      console.error('Tensor conversion error:', error.message);
      throw new TensorConversionError(`Failed to convert tensor data: ${error.message}`);
    }
    throw new TensorConversionError('Unknown error during tensor conversion');
  }
}

// Define interfaces
export interface EmbeddingOutput {
  data: Float32Array;
  dimensions: number;
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
          graphOptimizationLevel: 'all' as const
        };

        const model = await pipeline('feature-extraction', 'Xenova/gte-base', options);
        
        if (!model) {
          throw new Error('Failed to initialize embedding model');
        }

        this.instance = model;
        return this.instance;
      } catch (error) {
        if (error instanceof Error) {
          console.error('Error loading model:', error.message);
          throw new Error(`Model initialization failed: ${error.message}`);
        }
        throw new Error('Unknown error during model initialization');
      } finally {
        this.isLoading = false;
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  static async generateEmbedding(text: string): Promise<EmbeddingOutput> {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input: text must be a non-empty string');
    }

    try {
      const model = await this.getInstance();
      
      // Pre-process text
      const processedText = text.trim();
      
      // Generate embedding with specific options
      const output = await model(processedText, {
        pooling: 'mean',
        normalize: true,
        padding: true,
        truncation: true,
        max_length: 512
      });

      // Convert output to Float32Array
      const embedding = convertToTypedArray(output.data || output);
      
      return {
        data: embedding,
        dimensions: embedding.length
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error generating embedding:', error.message);
        throw new Error(`Embedding generation failed: ${error.message}`);
      }
      throw new Error('Unknown error during embedding generation');
    }
  }
}

// Semantic search function
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
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error in semantic search:', error.message);
      throw new Error(`Semantic search failed: ${error.message}`);
    }
    throw new Error('Unknown error during semantic search');
  }
}