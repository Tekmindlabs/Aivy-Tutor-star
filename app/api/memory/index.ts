// app/api/memory/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { Mem0Bridge } from '@/lib/memory/bridge';

const bridge = new Mem0Bridge();

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  success: boolean;
  results?: any;
}

type ApiResponse = SuccessResponse | ErrorResponse;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { command, args } = req.body;
    
    let result;
    switch (command) {
      case 'add':
        result = await bridge.addMemory(args.content, args.userId, args.metadata);
        break;
      case 'search':
        result = await bridge.searchMemories(args.query, args.userId);
        break;
      case 'delete':
        result = await bridge.deleteMemory(args.userId, args.memoryId);
        break;
      default:
        throw new Error('Invalid command');
    }
    
    return res.status(200).json({ success: true, results: result });
  } catch (error) {
    console.error('Memory API error:', error);
    
    // Properly type the error handling
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unknown error occurred';
      
    return res.status(500).json({ error: errorMessage });
  }
}