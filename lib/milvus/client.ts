import { MilvusClient } from '@zilliz/milvus2-sdk-node';

const MILVUS_ADDRESS = process.env.MILVUS_ADDRESS || 'localhost:19530';
const MILVUS_TOKEN = process.env.MILVUS_TOKEN;

class MilvusConnection {
  private static instance: MilvusClient;

  private constructor() {}

  public static async getInstance(): Promise<MilvusClient> {
    if (!MilvusConnection.instance) {
      // Use the correct import from the SDK
      MilvusConnection.instance = new (require('@zilliz/milvus2-sdk-node').MilvusClient)({
        address: MILVUS_ADDRESS,
        token: MILVUS_TOKEN
      });
    }
    return MilvusConnection.instance;
  }
}

export const getMilvusClient = () => MilvusConnection.getInstance();