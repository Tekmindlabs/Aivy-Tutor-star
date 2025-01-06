import sys
import json
from mem0ai import Mem0AI
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Mem0Bridge:
    def __init__(self):
        try:
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
            self.memory = Mem0AI.from_config(self.config)
            logger.info("Memory system initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Memory system: {str(e)}")
            self.memory = None

    def add_memory(self, content: str, user_id: str, metadata: dict = None):
        try:
            if not self.memory:
                raise Exception("Memory system not initialized")
            
            result = self.memory.add(content, user_id, metadata or {})
            return {
                "success": True,
                "result": result
            }
        except Exception as e:
            logger.error(f"Add memory error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def search_memories(self, query: str, user_id: str, limit: int = 5):
        try:
            if not self.memory:
                raise Exception("Memory system not initialized")
            
            results = self.memory.search(query, user_id, limit)
            return {
                "success": True,
                "results": results["results"][:limit]
            }
        except Exception as e:
            logger.error(f"Search error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def delete_memory(self, user_id: str, memory_id: str):
        try:
            if not self.memory:
                raise Exception("Memory system not initialized")
            
            result = self.memory.delete(memory_id, user_id)
            return {
                "success": True,
                "result": result
            }
        except Exception as e:
            logger.error(f"Delete error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

def main():
    try:
        if len(sys.argv) < 3:
            raise ValueError("Insufficient arguments")

        command = sys.argv[1]
        args = json.loads(sys.argv[2])
        bridge = Mem0Bridge()

        result = None
        if command == "search":
            result = bridge.search_memories(
                query=args["query"],
                user_id=args["userId"],
                limit=args.get("limit", 5)
            )
        elif command == "add":
            result = bridge.add_memory(
                content=args["content"],
                user_id=args["userId"],
                metadata=args.get("metadata", {})
            )
        elif command == "delete":
            result = bridge.delete_memory(
                user_id=args["userId"],
                memory_id=args["memoryId"]
            )
        else:
            result = {
                "success": False,
                "error": f"Unknown command: {command}"
            }
        
        print(json.dumps(result))

    except Exception as e:
        logger.error(f"Main execution error: {str(e)}")
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()