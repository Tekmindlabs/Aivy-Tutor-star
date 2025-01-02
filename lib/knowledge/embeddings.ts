import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function getEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding;
}

export async function semanticSearch(
  query: string,
  userId: string,
  limit: number = 5
): Promise<any[]> {
  const queryEmbedding = await getEmbedding(query);
  
  // Perform vector similarity search
  // This is a simplified version - in production use a vector database
  const results = await prisma.$queryRaw`
    SELECT 
      v.content_type,
      v.content_id,
      v.embedding <-> ${queryEmbedding}::vector as distance
    FROM vectors v
    JOIN documents d ON v.content_id = d.id AND v.content_type = 'document'
    WHERE d.user_id = ${userId}
    ORDER BY distance
    LIMIT ${limit}
  `;

  return results;
}