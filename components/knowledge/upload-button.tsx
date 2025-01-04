"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function UploadButton() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // Move useState inside component

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    setIsUploading(true);
    setUploadProgress(0);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      
      setUploadProgress(100);
      // Handle successful upload
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        disabled={isUploading}
        onClick={() => document.getElementById("file-upload")?.click()}
      >
        <Upload className="h-4 w-4 mr-2" />
        {isUploading ? "Uploading..." : "Upload Document"}
        <input
          id="file-upload"
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleUpload}
        />
      </Button>
      
      {isUploading && (
        <Progress 
          value={uploadProgress} 
          className="mt-2"
        />
      )}
    </div>
  );
}