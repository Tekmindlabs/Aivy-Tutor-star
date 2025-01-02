"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Camera, Image as ImageIcon, Send } from "lucide-react";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useCamera } from "@/hooks/use-camera";
import { ImagePreview } from "./image-preview";

interface InputControlsProps {
  onSubmit: (text: string, images?: File[]) => void;
  isLoading: boolean;
}

export function InputControls({ onSubmit, isLoading }: InputControlsProps) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    isRecording, 
    startRecording, 
    stopRecording, 
    transcript 
  } = useVoiceInput({
    onTranscript: (text) => setInput(prev => prev + " " + text)
  });

  const {
    isCameraActive,
    startCamera,
    stopCamera,
    takePicture
  } = useCamera({
    onPicture: (file) => setImages(prev => [...prev, file])
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && images.length === 0) return;
    onSubmit(input, images);
    setInput("");
    setImages([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((file, i) => (
            <ImagePreview 
              key={i} 
              file={file} 
              onRemove={() => setImages(images.filter((_, index) => index !== i))}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? (
            <MicOff className="h-4 w-4 text-red-500" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={isCameraActive ? stopCamera : startCamera}
        >
          <Camera className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or speak your message..."
          disabled={isLoading}
          className="flex-1"
        />

        <Button type="submit" disabled={isLoading || (!input.trim() && images.length === 0)}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}