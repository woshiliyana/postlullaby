export type BeatFrame = { beat: boolean; intensity: number };

const WARMUP_DURATION_MS = 300;
const BASELINE_TIME_CONSTANT_MS = 650;
const ONSET_WINDOW_MS = 120;
const BEAT_COOLDOWN_MS = 180;
const MINIMUM_BEAT_ENERGY = 0.24;
const MINIMUM_ENERGY_RISE = 0.08;
const MINIMUM_ONSET_RISE = 0.06;
const RELATIVE_ENERGY_RISE = 0.12;
const REARM_ENERGY_DROP = 0.08;

type EnergySample = {
  atMs: number;
  energy: number;
};

export function createBeatDetector() {
  let average = 0;
  let warmupStartedAt: number | null = null;
  let previousSampleAt: number | null = null;
  let lastBeatAt = Number.NEGATIVE_INFINITY;
  let armed = true;
  let latchedPeak = 0;
  let onsetWindow: EnergySample[] = [];

  return {
    sample(lowEnergy: number, nowMs: number): BeatFrame {
      const energy = Math.min(1, Math.max(0, lowEnergy));

      if (warmupStartedAt === null || previousSampleAt === null) {
        average = energy;
        warmupStartedAt = nowMs;
        previousSampleAt = nowMs;
        onsetWindow = [{ atMs: nowMs, energy }];
        return { beat: false, intensity: 0 };
      }

      const elapsedMs = Math.max(0, nowMs - previousSampleAt);
      previousSampleAt = nowMs;

      if (!armed) {
        latchedPeak = Math.max(latchedPeak, energy);
        if (latchedPeak - energy >= REARM_ENERGY_DROP) {
          armed = true;
          onsetWindow = [{ atMs: nowMs, energy }];
        }
      }

      onsetWindow.push({ atMs: nowMs, energy });
      const windowStartsAt = nowMs - ONSET_WINDOW_MS;
      while (onsetWindow.length > 1 && onsetWindow[0].atMs < windowStartsAt) {
        onsetWindow.shift();
      }

      let onsetReference = energy;
      for (const sample of onsetWindow) onsetReference = Math.min(onsetReference, sample.energy);

      const adaptiveMargin = Math.max(MINIMUM_ENERGY_RISE, average * RELATIVE_ENERGY_RISE);
      const threshold = Math.max(MINIMUM_BEAT_ENERGY, average + adaptiveMargin);
      const warmedUp = nowMs - warmupStartedAt >= WARMUP_DURATION_MS;
      const beat = armed
        && warmedUp
        && energy - onsetReference >= MINIMUM_ONSET_RISE
        && energy > threshold
        && nowMs - lastBeatAt >= BEAT_COOLDOWN_MS;

      if (beat) {
        armed = false;
        latchedPeak = energy;
        lastBeatAt = nowMs;
      }

      const baselineAlpha = 1 - Math.exp(-elapsedMs / BASELINE_TIME_CONSTANT_MS);
      average += (energy - average) * baselineAlpha;

      return { beat, intensity: beat ? Math.min(1, (energy - threshold) / 0.5 + 0.35) : 0 };
    },
    reset() {
      average = 0;
      warmupStartedAt = null;
      previousSampleAt = null;
      lastBeatAt = Number.NEGATIVE_INFINITY;
      armed = true;
      latchedPeak = 0;
      onsetWindow = [];
    },
  };
}
