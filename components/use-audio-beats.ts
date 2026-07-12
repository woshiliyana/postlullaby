"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

import { createBeatDetector } from "@/lib/audio/beat-detector";

export type AudioEnergyFrame = {
  low: number;
  mid: number;
  high: number;
  beat: boolean;
  intensity: number;
};

const EMPTY_FRAME: AudioEnergyFrame = {
  low: 0,
  mid: 0,
  high: 0,
  beat: false,
  intensity: 0,
};

export function useAudioBeats(audioRef: RefObject<HTMLAudioElement | null>): {
  resume: () => Promise<void>;
  readFrame: () => AudioEnergyFrame;
  reset: () => void;
} {
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frequencyBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const detectorRef = useRef(createBeatDetector());

  const resume = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) throw new Error("The audio player is not ready.");

    let context = audioContextRef.current;
    if (!context) {
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2_048;
      analyser.smoothingTimeConstant = 0.72;

      try {
        const mediaSource = context.createMediaElementSource(audio);
        mediaSource.connect(analyser);
        analyser.connect(context.destination);

        audioContextRef.current = context;
        mediaSourceRef.current = mediaSource;
        analyserRef.current = analyser;
        frequencyBufferRef.current = new Uint8Array(analyser.frequencyBinCount);
      } catch (error) {
        await context.close();
        throw error;
      }
    }

    if (context.state === "suspended") await context.resume();
  }, [audioRef]);

  const readFrame = useCallback((): AudioEnergyFrame => {
    const analyser = analyserRef.current;
    const frequencyBuffer = frequencyBufferRef.current;
    const context = audioContextRef.current;
    if (!analyser || !frequencyBuffer || !context) return EMPTY_FRAME;

    analyser.getByteFrequencyData(frequencyBuffer);
    const binWidth = context.sampleRate / analyser.fftSize;

    const averageRange = (minimumHz: number, maximumHz: number) => {
      const start = Math.max(0, Math.floor(minimumHz / binWidth));
      const end = Math.min(frequencyBuffer.length, Math.ceil(maximumHz / binWidth));
      if (end <= start) return 0;

      let sum = 0;
      for (let index = start; index < end; index += 1) sum += frequencyBuffer[index];
      return Math.min(1, Math.max(0, sum / (end - start) / 255));
    };

    const low = averageRange(20, 140);
    const mid = averageRange(140, 2_000);
    const high = averageRange(2_000, 12_000);
    const { beat, intensity } = detectorRef.current.sample(low, performance.now());

    return { low, mid, high, beat, intensity };
  }, []);

  const reset = useCallback(() => {
    detectorRef.current.reset();
  }, []);

  useEffect(() => {
    const detector = detectorRef.current;
    return () => {
      const context = audioContextRef.current;
      audioContextRef.current = null;

      mediaSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      mediaSourceRef.current = null;
      analyserRef.current = null;
      frequencyBufferRef.current = null;
      detector.reset();

      if (context && context.state !== "closed") void context.close();
    };
  }, []);

  return { resume, readFrame, reset };
}
