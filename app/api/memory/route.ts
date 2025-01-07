import { NextResponse } from 'next/server';
import { PythonShell } from 'python-shell';
import path from 'path';
import fs from 'fs';

const pythonPath = path.join(process.cwd(), 'lib/memory/python/mem0_bridge.py');

// Verify Python script exists
if (!fs.existsSync(pythonPath)) {
  throw new Error(`Python bridge script not found at: ${pythonPath}`);
}

export async function POST(request: Request) {
  try {
    const { command, args } = await request.json();

    const options = {
      mode: 'text' as const,
      pythonPath: 'python',
      pythonOptions: ['-u'],
      args: [command, JSON.stringify(args)]
    };

    const results = await PythonShell.run(pythonPath, options);
    
    if (!results || !results[0]) {
      throw new Error('No response from Python script');
    }

    return NextResponse.json(JSON.parse(results[0]));
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}