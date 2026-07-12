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

const AUDIO_ENGINE_INITIALIZATION_ERROR_CODE = "AUDIO_ENGINE_INITIALIZATION_FAILED";

export class AudioEngineInitializationError extends Error {
  readonly code = AUDIO_ENGINE_INITIALIZATION_ERROR_CODE;

  constructor(cause: unknown) {
    super("The audio engine could not be initialized.", { cause });
    this.name = "AudioEngineInitializationError";
  }
}

export function isAudioEngineInitializationError(
  error: unknown,
): error is AudioEngineInitializationError {
  return error instanceof AudioEngineInitializationError
    || (
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === AUDIO_ENGINE_INITIALIZATION_ERROR_CODE
    );
}

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
  const initializationAttemptedRef = useRef(false);
  const initializationFailureRef = useRef<Error | null>(null);
  const contextClosePromiseRef = useRef<Promise<void> | null>(null);

  const closeContextOnce = useCallback((context: AudioContext) => {
    if (!contextClosePromiseRef.current) {
      contextClosePromiseRef.current = context.state === "closed" ? Promise.resolve() : context.close();
    }
    return contextClosePromiseRef.current;
  }, []);

  const resume = useCallback(async () => {
    if (initializationFailureRef.current) throw initializationFailureRef.current;

    const audio = audioRef.current;
    if (!audio) throw new Error("The audio player is not ready.");

    let context = audioContextRef.current;
    if (!initializationAttemptedRef.current) {
      initializationAttemptedRef.current = true;
      try {
        context = new AudioContext();
        audioContextRef.current = context;

        const analyser = context.createAnalyser();
        analyserRef.current = analyser;
        analyser.fftSize = 2_048;
        analyser.smoothingTimeConstant = 0;

        const mediaSource = context.createMediaElementSource(audio);
        mediaSourceRef.current = mediaSource;
        mediaSource.connect(analyser);
        analyser.connect(context.destination);

        frequencyBufferRef.current = new Uint8Array(analyser.frequencyBinCount);
      } catch (initializationError) {
        const failure = new AudioEngineInitializationError(initializationError);
        initializationFailureRef.current = failure;

        mediaSourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        mediaSourceRef.current = null;
        analyserRef.current = null;
        frequencyBufferRef.current = null;

        if (context) {
          try {
            await closeContextOnce(context);
          } catch (closeError) {
            const closeMessage = closeError instanceof Error ? closeError.message : String(closeError);
            failure.message = `${failure.message} Audio engine cleanup also failed: ${closeMessage}`;
          }
        }

        throw failure;
      }
    }

    if (!context) throw new Error("The audio engine initialization did not create a context.");
    if (context.state === "suspended") await context.resume();
  }, [audioRef, closeContextOnce]);

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

      if (context) void closeContextOnce(context);
    };
  }, [closeContextOnce]);

  return { resume, readFrame, reset };
}
