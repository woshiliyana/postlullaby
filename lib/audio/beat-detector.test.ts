import { describe, expect, it } from "vitest";
import { createBeatDetector } from "./beat-detector";

describe("createBeatDetector", () => {
  it("fires on a strong low-frequency spike after a baseline", () => {
    const detector = createBeatDetector();
    for (let index = 0; index < 12; index += 1) detector.sample(0.12, index * 50);
    expect(detector.sample(0.72, 700)).toMatchObject({ beat: true });
  });

  it("enforces cooldown and can reset", () => {
    const detector = createBeatDetector();
    for (let index = 0; index < 12; index += 1) detector.sample(0.1, index * 50);
    expect(detector.sample(0.8, 700).beat).toBe(true);
    expect(detector.sample(0.9, 760).beat).toBe(false);
    detector.reset();
    expect(detector.sample(0.9, 1000).beat).toBe(false);
  });

  it("detects a real rise from a high baseline without treating steady energy as beats", () => {
    const detector = createBeatDetector();

    expect(detector.sample(0.74, 0).beat).toBe(false);
    for (let index = 1; index < 12; index += 1) {
      expect(detector.sample(0.74, index * 50).beat).toBe(false);
    }

    expect(detector.sample(0.88, 600).beat).toBe(true);
    expect(detector.sample(0.9, 650).beat).toBe(false);
    expect(detector.sample(0.74, 900).beat).toBe(false);

    detector.reset();
    expect(detector.sample(0.9, 1000).beat).toBe(false);
  });

  it.each([33, 50])(
    "fires once on a high-energy onset at %ims and rearms after a clear dip",
    (cadenceMs) => {
      const detector = createBeatDetector();
      let nowMs = 0;
      let beatCount = 0;

      for (let index = 0; index < 12; index += 1) {
        if (detector.sample(0.74, nowMs).beat) beatCount += 1;
        nowMs += cadenceMs;
      }

      if (detector.sample(0.88, nowMs).beat) beatCount += 1;
      nowMs += cadenceMs;

      const plateauEndsAt = nowMs + 1_000;
      while (nowMs <= plateauEndsAt) {
        if (detector.sample(0.9, nowMs).beat) beatCount += 1;
        nowMs += cadenceMs;
      }

      expect(beatCount).toBe(1);

      for (let index = 0; index < 12; index += 1) {
        expect(detector.sample(0.58, nowMs).beat).toBe(false);
        nowMs += cadenceMs;
      }

      expect(detector.sample(0.9, nowMs).beat).toBe(true);
    },
  );
});
