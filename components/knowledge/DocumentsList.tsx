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

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/knowledge/documents');
      const data = await response.json();
      setDocuments(data.documents);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

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