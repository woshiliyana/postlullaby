import { describe, expect, it } from "vitest";
import { createBeatDetector } from "./beat-detector";

const FRAME_CADENCES_MS = [8, 16, 33, 50] as const;

function countBeats(
  cadenceMs: number,
  durationMs: number,
  energyAt: (nowMs: number) => number,
) {
  const detector = createBeatDetector();
  let beatCount = 0;

  for (let nowMs = 0; nowMs <= durationMs; nowMs += cadenceMs) {
    if (detector.sample(energyAt(nowMs), nowMs).beat) beatCount += 1;
  }

  return beatCount;
}

describe("createBeatDetector", () => {
  it.each(FRAME_CADENCES_MS)(
    "fires exactly once for a high-baseline step plateau at a %ims cadence",
    (cadenceMs) => {
      const beatCount = countBeats(cadenceMs, 1_500, (nowMs) => {
        if (nowMs < 500) return 0.74;

        // A real analyser window resolves a step over a short period even with
        // built-in smoothing disabled.
        const onsetElapsedMs = nowMs - 500;
        return 0.9 - 0.16 * Math.exp(-onsetElapsedMs / 60);
      });

      expect(beatCount).toBe(1);
    },
  );

  it.each(FRAME_CADENCES_MS)(
    "counts a 300ms energy ramp once at a %ims cadence",
    (cadenceMs) => {
      const beatCount = countBeats(cadenceMs, 1_400, (nowMs) => {
        if (nowMs < 500) return 0.12;
        if (nowMs < 800) return 0.12 + ((nowMs - 500) / 300) * 0.7;
        return 0.82;
      });

      expect(beatCount).toBe(1);
    },
  );

  it.each(FRAME_CADENCES_MS)(
    "rearms after a clear dip and fires on the next rise at a %ims cadence",
    (cadenceMs) => {
      const beatCount = countBeats(cadenceMs, 1_500, (nowMs) => {
        if (nowMs < 500) return 0.16;
        if (nowMs < 850) return 0.8;
        if (nowMs < 1_100) return 0.42;
        return 0.84;
      });

      expect(beatCount).toBe(2);
    },
  );

  it("fires on a strong low-frequency spike after a low baseline", () => {
    const detector = createBeatDetector();
    for (let nowMs = 0; nowMs <= 500; nowMs += 16) detector.sample(0.12, nowMs);

    expect(detector.sample(0.72, 516)).toMatchObject({ beat: true });
  });

  it("enforces cooldown even after a dip rearms the detector", () => {
    const detector = createBeatDetector();
    for (let nowMs = 0; nowMs <= 400; nowMs += 20) detector.sample(0.1, nowMs);

    expect(detector.sample(0.8, 420).beat).toBe(true);
    expect(detector.sample(0.3, 440).beat).toBe(false);
    expect(detector.sample(0.82, 460).beat).toBe(false);
  });

  it("does not fire on the first frame after reset", () => {
    const detector = createBeatDetector();
    for (let nowMs = 0; nowMs <= 400; nowMs += 20) detector.sample(0.1, nowMs);
    expect(detector.sample(0.8, 420).beat).toBe(true);

    detector.reset();

    expect(detector.sample(0.9, 1_000).beat).toBe(false);
  });
});
