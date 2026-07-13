import { describe, expect, it } from "vitest";
import { createBeatDetector } from "./beat-detector";
import {
  REAL_TRACK_ENERGY_FIXTURE,
  REAL_TRACK_ENERGY_FIXTURE_CADENCE_MS,
} from "./beat-detector.fixtures";

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

  it("keeps tracking a loud, compressed real track without multi-beat silent gaps", () => {
    // Recorded from an actual bundled library track: a real four-on-the-floor
    // dance mix whose low-band energy sits high and close to its own peak
    // throughout (a compressed master), unlike Original Spark's very sparse,
    // high-dynamic-range synthetic kick. The track keeps a steady beat every
    // ~400-500ms the whole time; a detector anchored to an absolute rolling
    // average (rather than the track's own recent local range) can go over a
    // second without registering a single beat here even though the music
    // never stops.
    const detector = createBeatDetector();
    const beatTimesMs: number[] = [];

    REAL_TRACK_ENERGY_FIXTURE.forEach((energy, index) => {
      const nowMs = index * REAL_TRACK_ENERGY_FIXTURE_CADENCE_MS;
      if (detector.sample(energy, nowMs).beat) beatTimesMs.push(nowMs);
    });

    const totalDurationMs =
      (REAL_TRACK_ENERGY_FIXTURE.length - 1) * REAL_TRACK_ENERGY_FIXTURE_CADENCE_MS;
    const gapsMs = [
      beatTimesMs[0] ?? totalDurationMs,
      ...beatTimesMs.slice(1).map((atMs, index) => atMs - beatTimesMs[index]),
      totalDurationMs - (beatTimesMs.at(-1) ?? 0),
    ];

    // The real track's own audio never has a rhythmic gap this long; a
    // detector gap this long means real beats were missed, not that the
    // track went quiet.
    expect(Math.max(...gapsMs)).toBeLessThan(700);
  });
});
