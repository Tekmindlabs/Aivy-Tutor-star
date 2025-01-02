"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImagePreviewProps {
  file: File;
  onRemove: () => void;
}

export function ImagePreview({ file, onRemove }: ImagePreviewProps) {
  const [preview, setPreview] = useState(() => URL.createObjectURL(file));

  return (
    <div className="relative">
      <Image
        src={preview}
        alt="Preview"
        width={100}
        height={100}
        className="rounded-md object-cover"
      />
      <Button
        variant="destructive"
        size="icon"
        className="absolute -top-2 -right-2 h-6 w-6"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}