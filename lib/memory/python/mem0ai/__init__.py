from mem0 import Memory, MemoryClient
import logging

logger = logging.getLogger(__name__)

class Mem0AI:
    @classmethod
    def from_config(cls, config_dict):
        instance = cls()
        instance.memory = Memory.from_config(config_dict)
        return instance

    def add(self, content, user_id, metadata=None):
        try:
            messages = [{"role": "user", "content": content}]
            result = self.memory.add(
                messages=messages,
                user_id=user_id,
                metadata=metadata
            )
            return result
        except Exception as e:
            logger.error(f"Error adding memory: {e}")
            return None

    def search(self, query, user_id, limit=10):
        try:
            results = self.memory.search(
                query=query,
                user_id=user_id,
                limit=limit
            )
            return {"results": results}
        except Exception as e:
            logger.error(f"Error searching memories: {e}")
            return {"results": []}

    def delete(self, memory_id, user_id):
        try:
            result = self.memory.delete(memory_id=memory_id)
            return {"success": True}
        except Exception as e:
            logger.error(f"Error deleting memory: {e}")
            return {"success": False}