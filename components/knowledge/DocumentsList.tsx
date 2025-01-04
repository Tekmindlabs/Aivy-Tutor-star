import { useEffect, useState } from 'react';
import { Card } from "@/components/ui/card"; // Use existing Card component


interface Document {
  id: string;
  title: string;
  createdAt: string;
}


export function DocumentsList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/knowledge/documents');
  
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
  
      const data = await response.json();
      setDocuments(data.documents);
    } catch (err: unknown) { // Explicitly type the caught error as unknown
      // Type guard to handle the error properly
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Failed to fetch documents:', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  
    useEffect(() => {
  
      fetchDocuments();
  
      
  
      // Listen for new document uploads
  
      window.addEventListener('documentUploaded', fetchDocuments);
  
      return () => {
  
        window.removeEventListener('documentUploaded', fetchDocuments);
  
      };
  
    }, []);
  
  
    if (error) {

        return <div className="text-red-500">Error: {error}</div>;
    
      }
    
    
      return (
    
        <div className="grid gap-4 md:grid-cols-3">
    
          {loading ? (
    
            <div>Loading...</div>
    
          ) : (
    
            documents.map((doc) => (
    
              <Card key={doc.id} className="p-4">
    
                <h3 className="font-semibold">{doc.title}</h3>
    
                <p className="text-sm text-muted-foreground">
    
                  Uploaded on: {new Date(doc.createdAt).toLocaleDateString()}
    
                </p>
    
              </Card>
    
            ))
    
          )}
    
        </div>
    
      );
    
    }