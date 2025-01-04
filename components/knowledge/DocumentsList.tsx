import { useEffect, useState } from 'react';
import { List, Card } from 'antd';

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
  
      } catch (error) {
  
        setError(error.message);
  
        console.error('Failed to fetch documents:', error);
  
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
  
      <List
  
        loading={loading}
  
        grid={{ gutter: 16, column: 3 }}
  
        dataSource={documents}
  
        renderItem={(doc) => (
  
          <List.Item>
  
            <Card title={doc.title}>
  
              <p>Uploaded on: {new Date(doc.createdAt).toLocaleDateString()}</p>
  
            </Card>
  
          </List.Item>
  
        )}
  
      />
  
    );
  
  }