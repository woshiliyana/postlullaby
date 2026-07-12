export type BeatFrame = { beat: boolean; intensity: number };

const MINIMUM_BEAT_ENERGY = 0.24;
const MINIMUM_ENERGY_RISE = 0.08;
const MINIMUM_ONSET_RISE = 0.04;
const RELATIVE_ENERGY_RISE = 0.12;

export function createBeatDetector() {
  let average = 0;
  let samples = 0;
  let lastBeatAt = Number.NEGATIVE_INFINITY;
  let previousEnergy = 0;

  return {
    sample(lowEnergy: number, nowMs: number): BeatFrame {
      const energy = Math.min(1, Math.max(0, lowEnergy));
      const previousAverage = average;
      const onsetRise = energy - previousEnergy;
      previousEnergy = energy;
      average = samples === 0 ? energy : average * 0.92 + energy * 0.08;
      samples += 1;
      const warmedUp = samples >= 8;
      const adaptiveMargin = Math.max(MINIMUM_ENERGY_RISE, previousAverage * RELATIVE_ENERGY_RISE);
      const threshold = Math.max(MINIMUM_BEAT_ENERGY, previousAverage + adaptiveMargin);
      const beat = warmedUp
        && onsetRise >= MINIMUM_ONSET_RISE
        && energy > threshold
        && nowMs - lastBeatAt >= 180;
      if (beat) lastBeatAt = nowMs;
      return { beat, intensity: beat ? Math.min(1, (energy - threshold) / 0.5 + 0.35) : 0 };
    },
    reset() {
      average = 0;
      samples = 0;
      lastBeatAt = Number.NEGATIVE_INFINITY;
      previousEnergy = 0;
    },
  };
}
