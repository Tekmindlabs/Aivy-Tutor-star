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

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      const data = await response.json();

      if (data.success) {
        setProgress(100);
        notification.success({
          message: 'Success',
          description: 'Document uploaded successfully',
        });
        
        // Refresh the documents list
        router.refresh();
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
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