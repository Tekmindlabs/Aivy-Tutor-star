# mem0ai/__init__.py

class Mem0AI:  # Changed from Memory to Mem0AI
    @classmethod
    def from_config(cls, config):
        # Initialize memory system with configuration
        return cls()

    def add(self, content, user_id, metadata=None):
        # Add memory
        return {"status": "success"}

    def search(self, query, user_id):
        # Search memories
        return {"results": []}