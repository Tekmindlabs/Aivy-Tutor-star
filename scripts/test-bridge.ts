// scripts/test-bridge.ts
import { Mem0Bridge } from '../lib/memory/bridge';

async function test() {
  try {
    // Initialize the bridge
    const bridge = new Mem0Bridge();
    console.log('Bridge initialized successfully');

    // Test adding memory
    const addResult = await bridge.addMemory(
      "Test memory content",
      "test-user-id",
      { metadata: "test" }
    );
    console.log('Add result:', addResult);

    if (!addResult.success) {
      throw new Error(`Add failed: ${addResult.error}`);
    }

    // Test searching memory
    const searchResult = await bridge.searchMemories(
      "Test query",
      "test-user-id"
    );
    console.log('Search result:', searchResult);

    if (!searchResult.success) {
      throw new Error(`Search failed: ${searchResult.error}`);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Only run if not in browser
if (typeof window === 'undefined') {
  test().catch(console.error);
}