export type BeatFrame = { beat: boolean; intensity: number };

const WARMUP_DURATION_MS = 300;
const ONSET_WINDOW_MS = 120;
const BEAT_COOLDOWN_MS = 180;
// How far back "recent" reaches when measuring the track's own current
// dynamic range. Long enough to span a full beat cycle at slow tempos,
// short enough to still describe "right now" rather than the whole song.
const RANGE_WINDOW_MS = 900;
// A beat needs the energy to clear this fraction of the track's own recent
// min-max swing above its recent floor, and to have risen by this fraction
// since the local onset window's low point. Sizing both thresholds off the
// track's own recent range (rather than an absolute level, or a level
// relative to a slow rolling average) is what lets this work for both a
// sparse, high-dynamic-range synthetic kick and a loud, compressed
// commercial master whose low-band energy never dips far from its own peak.
const THRESHOLD_RANGE_FRACTION = 0.45;
const ONSET_RISE_RANGE_FRACTION = 0.25;
const REARM_DROP_RANGE_FRACTION = 0.3;
// Floors so a near-silent passage (recent range ~0) can't spuriously "beat".
const ABSOLUTE_FLOOR = 0.03;

type EnergySample = {
  atMs: number;
  energy: number;
};

export function createBeatDetector() {
  let warmupStartedAt: number | null = null;
  let lastBeatAt = Number.NEGATIVE_INFINITY;
  let armed = true;
  let latchedPeak = 0;
  let onsetWindow: EnergySample[] = [];
  let rangeWindow: EnergySample[] = [];

  return {
    sample(lowEnergy: number, nowMs: number): BeatFrame {
      const energy = Math.min(1, Math.max(0, lowEnergy));

      if (warmupStartedAt === null) {
        warmupStartedAt = nowMs;
        onsetWindow = [{ atMs: nowMs, energy }];
        rangeWindow = [{ atMs: nowMs, energy }];
        return { beat: false, intensity: 0 };
      }

      rangeWindow.push({ atMs: nowMs, energy });
      const rangeStartsAt = nowMs - RANGE_WINDOW_MS;
      while (rangeWindow.length > 1 && rangeWindow[0].atMs < rangeStartsAt) {
        rangeWindow.shift();
      }
      let recentMin = energy;
      let recentMax = energy;
      for (const sample of rangeWindow) {
        recentMin = Math.min(recentMin, sample.energy);
        recentMax = Math.max(recentMax, sample.energy);
      }
      const recentRange = recentMax - recentMin;

      if (!armed) {
        latchedPeak = Math.max(latchedPeak, energy);
        const rearmDrop = Math.max(ABSOLUTE_FLOOR, recentRange * REARM_DROP_RANGE_FRACTION);
        if (latchedPeak - energy >= rearmDrop) {
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

      const threshold = recentMin + Math.max(ABSOLUTE_FLOOR, recentRange * THRESHOLD_RANGE_FRACTION);
      const onsetRiseThreshold = Math.max(ABSOLUTE_FLOOR, recentRange * ONSET_RISE_RANGE_FRACTION);
      const warmedUp = nowMs - warmupStartedAt >= WARMUP_DURATION_MS;
      const beat = armed
        && warmedUp
        && energy - onsetReference >= onsetRiseThreshold
        && energy > threshold
        && nowMs - lastBeatAt >= BEAT_COOLDOWN_MS;

      if (beat) {
        armed = false;
        latchedPeak = energy;
        lastBeatAt = nowMs;
      }

      const intensity = beat
        ? Math.min(1, (energy - threshold) / Math.max(0.05, recentRange) + 0.35)
        : 0;

      return { beat, intensity };
    },
    reset() {
      warmupStartedAt = null;
      lastBeatAt = Number.NEGATIVE_INFINITY;
      armed = true;
      latchedPeak = 0;
      onsetWindow = [];
      rangeWindow = [];
    },
  };
}
