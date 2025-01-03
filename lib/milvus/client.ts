import { MilvusClient } from '@zilliz/milvus2-sdk-node';

const MILVUS_ADDRESS = process.env.MILVUS_ADDRESS || 'localhost:19530';
const MILVUS_TOKEN = process.env.MILVUS_TOKEN;

class MilvusConnection {
  private static instance: MilvusClient;

  private constructor() {}

  public static async getInstance(): Promise<MilvusClient> {
    if (!MilvusConnection.instance) {
      const config = {
        address: MILVUS_ADDRESS,
        ssl: MILVUS_ADDRESS.startsWith('https'),
      };

      if (MILVUS_TOKEN) {
        Object.assign(config, { token: MILVUS_TOKEN });
      }

      MilvusConnection.instance = new MilvusClient(config);
    }
    return MilvusConnection.instance;
  }
}

export const getMilvusClient = () => MilvusConnection.getInstance();