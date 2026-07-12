export type BeatFrame = { beat: boolean; intensity: number };

export function createBeatDetector() {
  let average = 0;
  let samples = 0;
  let lastBeatAt = Number.NEGATIVE_INFINITY;

  return {
    sample(lowEnergy: number, nowMs: number): BeatFrame {
      const energy = Math.min(1, Math.max(0, lowEnergy));
      const previousAverage = average;
      average = samples === 0 ? energy : average * 0.92 + energy * 0.08;
      samples += 1;
      const warmedUp = samples >= 8;
      const threshold = Math.max(0.24, previousAverage * 1.55);
      const beat = warmedUp && energy > threshold && nowMs - lastBeatAt >= 180;
      if (beat) lastBeatAt = nowMs;
      return { beat, intensity: beat ? Math.min(1, (energy - threshold) / 0.5 + 0.35) : 0 };
    },
    reset() {
      average = 0;
      samples = 0;
      lastBeatAt = Number.NEGATIVE_INFINITY;
    },
  };
}
