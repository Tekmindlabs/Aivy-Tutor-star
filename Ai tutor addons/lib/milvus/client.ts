import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

const MILVUS_ADDRESS = process.env.MILVUS_ADDRESS || 'localhost:19530';

class MilvusConnection {
  private static instance: MilvusClient;

  private constructor() {}

  public static async getInstance(): Promise<MilvusClient> {
    if (!MilvusConnection.instance) {
      MilvusConnection.instance = new MilvusClient(MILVUS_ADDRESS);
    }
    return MilvusConnection.instance;
  }
}

export const getMilvusClient = () => MilvusConnection.getInstance();