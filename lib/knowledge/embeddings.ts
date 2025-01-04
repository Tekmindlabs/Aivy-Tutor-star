import { pipeline } from '@xenova/transformers';
import type { Pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

// Type definition for TypedArray
type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

// Global environment declaration
declare global {
  var env: {
    useLegacyWebImplementation: boolean | undefined;
  };
}

// Set environment to use legacy build
if (typeof process !== 'undefined') {
  process.env.USE_LEGACY = '1';
}

// Custom error types
class TensorConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TensorConversionError';
  }
}

class ModelLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelLoadError';
  }
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
          cache_dir: './model-cache',
          local_files_only: false,
          use_legacy: true
        };

        const model = await pipeline('feature-extraction', 'Xenova/gte-base-en-v1.5', options) as FeatureExtractionPipeline;

        if (!model) {
          throw new ModelLoadError('Failed to initialize embedding model');
        }

        this.instance = model;
        return this.instance;
      } catch (error) {
        console.error('Error loading model:', error);
        throw new ModelLoadError(`Model initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        this.isLoading = false;
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  static async generateEmbedding(text: string, max_length?: number): Promise<Float32Array> {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input: text must be a non-empty string');
    }

    try {
      const model = await this.getInstance();
      const processedText = text.trim();

      // Generate embedding with specific options matching GTE requirements
      const output = await model(processedText, {
        normalize: true,
        pooling: 'mean',
        ...(max_length && { max_length })
      });

      // Improved tensor data handling
      if (!output || !output.data) {
        throw new TensorConversionError('Invalid model output');
      }

      // Ensure proper conversion to Float32Array
      let embedding: Float32Array;
      if (output.data instanceof Float32Array) {
        embedding = output.data;
      } else if (ArrayBuffer.isView(output.data)) {
        embedding = new Float32Array(output.data.buffer);
      } else if (Array.isArray(output.data)) {
        embedding = new Float32Array(output.data);
      } else {
        throw new TensorConversionError('Unexpected output format from model');
      }

      // Verify embedding dimension (should be 768 for gte-base)
      if (embedding.length !== 768) {
        throw new Error(`Invalid embedding dimension: ${embedding.length}, expected 768`);
      }

      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error instanceof Error ? error : new Error('Unknown error during embedding generation');
    }
  }
}

// Public function to get embeddings
export async function getEmbedding(
  text: string,
  options?: { max_length?: number }
): Promise<Float32Array> {
  return await EmbeddingModel.generateEmbedding(text, options?.max_length);
}