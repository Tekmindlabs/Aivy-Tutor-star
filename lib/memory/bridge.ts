import { PythonShell, Options } from 'python-shell';
import path from 'path';
import fs from 'fs';

export class Mem0Bridge {
  private pythonPath: string;

  constructor() {
    this.pythonPath = path.join(process.cwd(), 'lib/memory/python/mem0_bridge.py');
    
    // Verify Python script exists
    if (!fs.existsSync(this.pythonPath)) {
      throw new Error(`Python bridge script not found at: ${this.pythonPath}`);
    }
  }

  private async runPythonCommand(command: string, args: any): Promise<any> {
    const options: Options = {
      mode: 'text' as const,
      pythonPath: 'python', // Changed from python3 to python
      pythonOptions: ['-u'], // Add unbuffered mode
      args: [command, JSON.stringify(args)]
    };

    try {
      console.log(`Running Python command: ${command}`);
      console.log(`With args:`, args);
      
      const results = await PythonShell.run(this.pythonPath, options);
      console.log('Python results:', results);

      if (!results || !results[0]) {
        throw new Error('No response from Python script');
      }

      return JSON.parse(results[0]);
    } catch (error) {
      console.error('Python bridge error:', error);
      throw error;
    }
  }

  async addMemory(content: string, userId: string, metadata?: Record<string, any>) {
    return this.runPythonCommand('add', { content, userId, metadata });
  }

  async searchMemories(query: string, userId: string, limit: number = 5) {
    return this.runPythonCommand('search', { query, userId, limit });
  }
}