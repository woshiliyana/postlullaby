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
});
