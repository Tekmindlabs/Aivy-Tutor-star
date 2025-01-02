"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Model {
  id: string;
  name: string;
  description: string;
  capabilities?: string[];
}

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function ModelSelector({ value, onValueChange }: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function loadModels() {
      const response = await fetch("/api/ai/models");
      const data = await response.json();
      setModels(data);
    }
    loadModels();
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Model Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select AI Model</DialogTitle>
          <DialogDescription>
            Choose the AI model that best suits your needs
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={value} onValueChange={(value) => {
          onValueChange(value);
          setOpen(false);
        }}>
          {models.map((model) => (
            <div key={model.id} className="flex items-start space-x-4 space-y-4">
              <RadioGroupItem value={model.id} id={model.id} />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor={model.id}>{model.name}</Label>
                <p className="text-sm text-muted-foreground">
                  {model.description}
                </p>
                {model.capabilities && (
                  <ul className="text-xs text-muted-foreground list-disc list-inside mt-1">
                    {model.capabilities.map((capability, i) => (
                      <li key={i}>{capability}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </RadioGroup>
      </DialogContent>
    </Dialog>
  );
}