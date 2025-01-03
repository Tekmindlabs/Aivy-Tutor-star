import { pipeline, Pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

declare global {
  var env: {
    useLegacyWebImplementation: boolean | undefined;
  };
}

// Set environment to use legacy build
globalThis.env = {
  ...globalThis.env,
  useLegacyWebImplementation: true,
};

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

        // Update the model options
        const options = {
          revision: 'main',
          quantized: false,
          executionProviders: ['cpu'] as const, // Remove webgl for Node.js environment
          graphOptimizationLevel: 'all' as const,
          useCache: true
        };

        const model = await pipeline('feature-extraction', 'Xenova/gte-base', {
          ...options,
          pooling: 'mean',
          normalize: true,
        });

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

  static async generateEmbedding(text: string): Promise<Float32Array> {
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
        normalize: true
      });

      // Convert output to Float32Array
      if (!output || !output.data) {
        throw new TensorConversionError('Invalid model output');
      }

      // Ensure output is Float32Array
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

      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error instanceof Error ? error : new Error('Unknown error during embedding generation');
    }
  }
}

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

// Public function to get embeddings
export async function getEmbedding(text: string): Promise<Float32Array> {
  return await EmbeddingModel.generateEmbedding(text);
}
