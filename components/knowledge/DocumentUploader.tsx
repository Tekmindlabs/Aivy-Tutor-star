import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Progress, notification } from 'antd';

export function DocumentUploader() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  const uploadDocument = async (file: File) => {

    try {
  
      setUploading(true);
  
      
  
      const formData = new FormData();
  
      formData.append('file', file);
  
  
      const response = await fetch('/api/knowledge/upload', {
  
        method: 'POST',
  
        body: formData,
  
      });
  
  
      if (!response.ok) {
  
        throw new Error(`Upload failed: ${response.statusText}`);
  
      }
  
  
      const data = await response.json();
  
  
      if (data.success) {
  
        setProgress(100);
  
        notification.success({
  
          message: 'Success',
  
          description: data.message || 'Document uploaded successfully',
  
        });
  
        
  
        // Emit an event for successful upload
  
        window.dispatchEvent(new Event('documentUploaded'));
  
      } else {
  
        throw new Error(data.error || 'Upload failed');
  
      }
  
    } catch (error) {
  
      setProgress(0);
  
      notification.error({
  
        message: 'Error',
  
        description: error.message || 'Failed to upload document',
  
      });
  
    } finally {
  
      setUploading(false);
  
      setTimeout(() => setProgress(0), 1000);
  
    }
  
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadDocument(file);
        }}
        disabled={uploading}
      />
      
      {progress > 0 && (
        <Progress
          percent={progress}
          status={progress === 100 ? 'success' : 'active'}
        />
      )}
    </div>
  );
}