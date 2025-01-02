export class MilvusOperationError extends Error {
    constructor(message: string, public originalError: any) {
      super(message);
      this.name = 'MilvusOperationError';
    }
  }
  
  export const handleMilvusError = (error: any) => {
    console.error('Milvus operation failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      throw new MilvusOperationError(
        'Unable to connect to Milvus server',
        error
      );
    }
    
    if (error.message.includes('collection not found')) {
      throw new MilvusOperationError(
        'Collection not initialized',
        error
      );
    }
    
    throw new MilvusOperationError('Vector operation failed', error);
  };