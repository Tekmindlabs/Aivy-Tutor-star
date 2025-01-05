from mem0ai import Memory
import sys
import json

class Mem0Bridge:
    def __init__(self):
        self.config = {
            "llm": {
                "provider": "google",
                "config": {
                    "model": "gemini-pro",
                    "temperature": 0.1,
                    "max_tokens": 2000,
                }
            },
            "embedder": {
                "provider": "jina",
                "config": {
                    "dimensions": 1024
                }
            },
            "vector_store": {
                "provider": "milvus",
                "config": {
                    "collection_name": "aivy_memories",
                    "embedding_model_dims": 1024
                }
            }
        }
        self.memory = Memory.from_config(self.config)

    def add_memory(self, content, user_id, metadata=None):
        try:
            result = self.memory.add(content, user_id, metadata or {})
            return json.dumps({"success": True, "result": result})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    def search_memories(self, query, user_id, limit=5):
        try:
            results = self.memory.search(query, user_id)
            return json.dumps({
                "success": True,
                "results": results.results[:limit]
            })
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

if __name__ == "__main__":
    bridge = Mem0Bridge()
    command = sys.argv[1]
    args = json.loads(sys.argv[2])
    
    if command == "add":
        print(bridge.add_memory(args["content"], args["userId"], args.get("metadata")))
    elif command == "search":
        print(bridge.search_memories(args["query"], args["userId"], args.get("limit", 5)))