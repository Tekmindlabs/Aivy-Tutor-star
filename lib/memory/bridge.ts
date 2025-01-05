import { PythonShell } from 'python-shell';
import path from 'path';

export class Mem0Bridge {
  private pythonPath: string;

  constructor() {
    this.pythonPath = path.join(process.cwd(), 'lib/memory/python/mem0_bridge.py');
  }

  private async runPythonCommand(command: string, args: any): Promise<any> {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      args: [command, JSON.stringify(args)]
    };

    return new Promise((resolve, reject) => {
      // Correct usage with 2 arguments: script path and options
      PythonShell.run(this.pythonPath, options)
        .then(results => {
          try {
            const result = JSON.parse(results?.[0] || '{}');
            if (!result.success) {
              reject(new Error(result.error));
            }
            resolve(result);
          } catch (e) {
            reject(e);
          }
        })
        .catch(reject);
    });
  }

  async addMemory(content: string, userId: string, metadata?: Record<string, any>) {
    return this.runPythonCommand('add', { content, userId, metadata });
  }

  async searchMemories(query: string, userId: string, limit: number = 5) {
    return this.runPythonCommand('search', { query, userId, limit });
  }
}