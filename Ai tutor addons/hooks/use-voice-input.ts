"use client";

import { useState, useEffect, useCallback } from "react";

interface UseVoiceInputProps {
  onTranscript?: (text: string) => void;
}

export function useVoiceInput({ onTranscript }: UseVoiceInputProps = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setTranscript(finalTranscript);
          onTranscript?.(finalTranscript);
        }
      };

      setRecognition(recognition);
    }
  }, [onTranscript]);

  const startRecording = useCallback(() => {
    if (recognition) {
      recognition.start();
      setIsRecording(true);
    }
  }, [recognition]);

  const stopRecording = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setIsRecording(false);
    }
  }, [recognition]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    transcript,
    isSupported: !!recognition
  };
}