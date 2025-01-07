from datetime import datetime
from typing import Dict, Any, List, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Memory:
    def __init__(self, config=None):
        """Initialize Memory with configuration.
        
        Args:
            config (dict, optional): Configuration dictionary for memory system
        """
        self.config = config or {}
        self.memories = []  # Simple in-memory storage for demonstration
        logger.info("Memory system initialized")

    @classmethod
    def from_config(cls, config):
        """Create a Memory instance from configuration.
        
        Args:
            config (dict): Configuration dictionary
            
        Returns:
            Memory: Initialized Memory instance
        """
        return cls(config)

    def add(self, content: str, user_id: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Add a new memory entry.
        
        Args:
            content (str): The content to store
            user_id (str): User identifier
            metadata (dict, optional): Additional metadata for the memory
            
        Returns:
            dict: Result of the operation
        """
        try:
            if not content or not user_id:
                raise ValueError("Content and user_id are required")

            # Initialize metadata if None
            metadata = metadata or {}
            
            # Add timestamp to metadata
            metadata['timestamp'] = datetime.now().isoformat()
            metadata['user_id'] = user_id

            # Create memory entry
            memory_entry = {
                'content': content,
                'user_id': user_id,
                'metadata': metadata,
                'created_at': datetime.now().isoformat()
            }

            # Store memory
            self.memories.append(memory_entry)

            logger.info(f"Memory added successfully for user {user_id}")
            return {
                "success": True,
                "memory_id": len(self.memories) - 1,
                "result": memory_entry
            }

        except Exception as e:
            logger.error(f"Error adding memory: {str(e)}")
            return {"success": False, "error": str(e)}

    def search(self, query: str, user_id: str, limit: int = 5) -> Dict[str, Any]:
        """Search for memories based on query.
        
        Args:
            query (str): Search query
            user_id (str): User identifier
            limit (int, optional): Maximum number of results to return
            
        Returns:
            dict: Search results
        """
        try:
            if not query or not user_id:
                raise ValueError("Query and user_id are required")

            # Filter memories by user_id
            user_memories = [
                mem for mem in self.memories 
                if mem['user_id'] == user_id
            ]

            # Simple search implementation
            # In a real implementation, you might want to use more sophisticated
            # search algorithms or vector similarity
            results = []
            for memory in user_memories:
                if query.lower() in memory['content'].lower():
                    results.append(memory)

            # Limit results
            limited_results = results[:limit]

            logger.info(f"Search completed for user {user_id}, found {len(limited_results)} results")
            return {
                "success": True,
                "results": limited_results
            }

        except Exception as e:
            logger.error(f"Error searching memories: {str(e)}")
            return {"success": False, "error": str(e)}

    def get_all(self, user_id: str) -> Dict[str, Any]:
        """Get all memories for a user.
        
        Args:
            user_id (str): User identifier
            
        Returns:
            dict: All memories for the user
        """
        try:
            if not user_id:
                raise ValueError("user_id is required")

            user_memories = [
                mem for mem in self.memories 
                if mem['user_id'] == user_id
            ]

            return {
                "success": True,
                "memories": user_memories
            }

        except Exception as e:
            logger.error(f"Error retrieving memories: {str(e)}")
            return {"success": False, "error": str(e)}

    def reset(self) -> Dict[str, Any]:
        """Reset all memories.
        
        Returns:
            dict: Result of the operation
        """
        try:
            self.memories = []
            return {"success": True, "message": "Memory system reset successfully"}
        except Exception as e:
            logger.error(f"Error resetting memories: {str(e)}")
            return {"success": False, "error": str(e)}