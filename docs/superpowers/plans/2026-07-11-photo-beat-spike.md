# Photo Beat Effect Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only prototype that turns one local pet or person photo into a beat-reactive scene using either the bundled 15-second Original Spark track or a locally selected song that plays in full in the current browser. The spike has no export.

**Architecture:** `app/page.tsx` remains a Server Component and renders one focused Client Component. Pure local-media validation and beat detection live under `lib/` and are unit tested; one Web Audio hook owns a single `AudioContext`/`AnalyserNode`, while a visual component uses CSS variables plus Canvas without causing React renders on every animation frame. User files stay in browser object URLs and no API route is added.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Vitest 4, Web Audio API, Canvas 2D, Node.js WAV generation.

## Global Constraints

- The approved spec is `docs/specs/2026-07-11-photo-beat-spike.md`.
- The prototype accepts one JPEG, PNG, or WebP image and one browser-supported local audio file.
- A commercial song such as “Gee” is never bundled, downloaded, uploaded, or committed; the user selects a legally obtained local copy and analysis stays in the browser.
- The bundled **Original Spark** track is repository-owned, exactly 15 seconds, and must not imitate or copy a named commercial recording.
- No memory field, lyrics, API route, provider call, database, login, payment, analytics, upload, or export is added.
- One `HTMLAudioElement` uses at most one `AudioContext`, one `MediaElementAudioSourceNode`, and one `AnalyserNode` during its lifetime.
- The visual must work at 390x844 and 1440x1000, and reduced-motion mode must remain usable.
- Do not edit, delete, merge, or commit files from `.worktrees/feat-postlullaby-mvp`; it contains a separate paused implementation of the older memorial spec.

---

### Task 1: Local media rules, beat detector, and original sample

**Files:**
- Create: `lib/local-media.ts`
- Create: `lib/local-media.test.ts`
- Create: `lib/audio/beat-detector.ts`
- Create: `lib/audio/beat-detector.test.ts`
- Create: `scripts/make-original-sample.mjs`
- Create: `public/sample/original-spark.wav`
- Modify: `package.json`

**Interfaces:**
- Produces: `validatePhotoFile(file): string | null`, `validateAudioFile(file): string | null`, `createBeatDetector()`, `BeatFrame`, and `/sample/original-spark.wav`.
- `createBeatDetector().sample(lowEnergy, nowMs)` returns `{ beat, intensity }`; `reset()` clears rolling history and cooldown.

- [ ] **Step 1: Add test scripts and write failing media-validation tests**

Add these scripts to `package.json`:

```json
{
  "test": "vitest run --exclude '.worktrees/**'",
  "typecheck": "tsc --noEmit",
  "make:sample": "node scripts/make-original-sample.mjs",
  "verify": "npm test && npm run lint -- --ignore-pattern '.worktrees/**' && npm run typecheck && npm run build"
}
```

Create `lib/local-media.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateAudioFile, validatePhotoFile } from "./local-media";

describe("local media validation", () => {
  it("accepts a JPEG photo and MP3 audio", () => {
    expect(validatePhotoFile(new File(["x"], "pet.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(validateAudioFile(new File(["x"], "gee.mp3", { type: "audio/mpeg" }))).toBeNull();
  });

  it("rejects unsupported files with useful messages", () => {
    expect(validatePhotoFile(new File(["x"], "pet.gif", { type: "image/gif" }))).toBe(
      "Choose a JPEG, PNG, or WebP photo.",
    );
    expect(validateAudioFile(new File(["x"], "notes.txt", { type: "text/plain" }))).toBe(
      "Choose an audio file your browser can play.",
    );
  });
});
```

- [ ] **Step 2: Run the media test and verify RED**

Run: `npm test -- lib/local-media.test.ts`

Expected: FAIL resolving `./local-media`.

- [ ] **Step 3: Implement exact local-file boundaries**

Create `lib/local-media.ts`:

```ts
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

export function validatePhotoFile(file: File): string | null {
  if (!PHOTO_TYPES.has(file.type)) return "Choose a JPEG, PNG, or WebP photo.";
  if (file.size > MAX_PHOTO_BYTES) return "Keep the photo under 10 MB.";
  return null;
}

export function validateAudioFile(file: File): string | null {
  if (!file.type.startsWith("audio/")) return "Choose an audio file your browser can play.";
  if (file.size > MAX_AUDIO_BYTES) return "Keep the song under 30 MB for this prototype.";
  return null;
}
```

- [ ] **Step 4: Write failing adaptive-beat tests**

Create `lib/audio/beat-detector.test.ts`:

```ts
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
```

- [ ] **Step 5: Run the beat test and verify RED**

Run: `npm test -- lib/audio/beat-detector.test.ts`

Expected: FAIL resolving `./beat-detector`.

- [ ] **Step 6: Implement the beat detector**

Create `lib/audio/beat-detector.ts`:

```ts
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
```

- [ ] **Step 7: Generate a reproducible original WAV**

Create `scripts/make-original-sample.mjs`:

```js
import { mkdir, writeFile } from "node:fs/promises";

const sampleRate = 44_100;
const seconds = 15;
const frameCount = sampleRate * seconds;
const bpm = 132;
const beatSeconds = 60 / bpm;
const mix = new Float32Array(frameCount);
const bassNotes = [65.41, 82.41, 98, 73.42];
let randomState = 0x51f15e;

function noise() {
  randomState = (randomState * 1_664_525 + 1_013_904_223) >>> 0;
  return (randomState / 0xffffffff) * 2 - 1;
}

for (let index = 0; index < frameCount; index += 1) {
  const time = index / sampleRate;
  const beatPosition = time / beatSeconds;
  const beatPhase = beatPosition % 1;
  const halfBeatPhase = (beatPosition * 2) % 1;
  const barBeat = Math.floor(beatPosition) % 4;

  const kickEnvelope = Math.exp(-beatPhase * 13);
  const kickFrequency = 46 + 58 * Math.exp(-beatPhase * 18);
  const kick = Math.sin(2 * Math.PI * kickFrequency * time) * kickEnvelope;

  const clapPhase = (beatPosition + 0.5) % 1;
  const clap = clapPhase < 0.16 ? noise() * Math.exp(-clapPhase * 28) : 0;

  const bassFrequency = bassNotes[barBeat];
  const bass =
    Math.sin(2 * Math.PI * bassFrequency * time) *
    Math.exp(-halfBeatPhase * 2.8) *
    0.34;

  const chordRoot = [261.63, 220, 293.66, 246.94][Math.floor(beatPosition / 4) % 4];
  const pad = [1, 1.25, 1.5, 1.875]
    .map((ratio) => Math.sin(2 * Math.PI * chordRoot * ratio * time))
    .reduce((sum, value) => sum + value, 0) * 0.045;

  const sparkleFrequency = [659.25, 783.99, 987.77, 880][Math.floor(beatPosition * 2) % 4];
  const sparkle =
    Math.sin(2 * Math.PI * sparkleFrequency * time) *
    Math.exp(-halfBeatPhase * 8) *
    0.08;

  const fadeIn = Math.min(1, time / 0.08);
  const fadeOut = Math.min(1, (seconds - time) / 0.08);
  mix[index] = Math.max(-1, Math.min(1, (kick * 0.56 + clap * 0.15 + bass + pad + sparkle) * fadeIn * fadeOut));
}

const wavBuffer = Buffer.alloc(44 + frameCount * 4);
wavBuffer.write("RIFF", 0);
wavBuffer.writeUInt32LE(36 + frameCount * 4, 4);
wavBuffer.write("WAVEfmt ", 8);
wavBuffer.writeUInt32LE(16, 16);
wavBuffer.writeUInt16LE(1, 20);
wavBuffer.writeUInt16LE(2, 22);
wavBuffer.writeUInt32LE(sampleRate, 24);
wavBuffer.writeUInt32LE(sampleRate * 4, 28);
wavBuffer.writeUInt16LE(4, 32);
wavBuffer.writeUInt16LE(16, 34);
wavBuffer.write("data", 36);
wavBuffer.writeUInt32LE(frameCount * 4, 40);

for (let index = 0; index < frameCount; index += 1) {
  const left = Math.round(mix[index] * 32_767);
  const right = Math.round(mix[index] * (0.96 + 0.04 * Math.sin(index / 1700)) * 32_767);
  wavBuffer.writeInt16LE(left, 44 + index * 4);
  wavBuffer.writeInt16LE(right, 46 + index * 4);
}

await mkdir(new URL("../public/sample/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/sample/original-spark.wav", import.meta.url), wavBuffer);
console.log("Created public/sample/original-spark.wav (15s, original, 132 BPM)");
```

Run: `npm run make:sample`

Expected: the success line above and a WAV duration between 14.99 and 15.01 seconds when probed with `ffprobe`.

- [ ] **Step 8: Run focused tests and commit**

Run: `npm test -- lib/local-media.test.ts lib/audio/beat-detector.test.ts`

Expected: 4 tests pass.

Commit:

```bash
git add package.json package-lock.json lib scripts public/sample/original-spark.wav
git commit -m "feat: add local beat engine and original sample"
```

---

### Task 2: Interactive photo-beat studio and visual stage

**Files:**
- Create: `components/use-audio-beats.ts`
- Create: `components/beat-visualizer.tsx`
- Create: `components/photo-beat-studio.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- `useAudioBeats(audioRef)` produces `{ resume, readFrame, reset }`.
- `readFrame()` returns `{ low, mid, high, beat, intensity }`, with every energy normalized to `0..1`.
- `BeatVisualizer` consumes `{ photoUrl, audioRef, isPlaying, readFrame }`.
- `PhotoBeatStudio` owns photo/audio selection, object URL cleanup, playback controls, and error copy.

- [ ] **Step 1: Implement the single-context audio hook**

Create `components/use-audio-beats.ts` as a Client Component hook. Store `AudioContext`, `MediaElementAudioSourceNode`, `AnalyserNode`, frequency buffer, and the Task 1 detector in refs. `resume()` creates and connects them only when absent, then resumes a suspended context. `readFrame()` averages analyser bins for approximately 20–140 Hz, 140–2,000 Hz, and 2,000–12,000 Hz, normalizes by 255, and passes low energy into the detector. `reset()` resets the detector without creating or closing the context. On unmount, disconnect nodes and close the context exactly once.

The public signature must be:

```ts
export type AudioEnergyFrame = {
  low: number;
  mid: number;
  high: number;
  beat: boolean;
  intensity: number;
};

export function useAudioBeats(audioRef: React.RefObject<HTMLAudioElement | null>): {
  resume: () => Promise<void>;
  readFrame: () => AudioEnergyFrame;
  reset: () => void;
};
```

- [ ] **Step 2: Implement the visual stage without per-frame React state**

Create `components/beat-visualizer.tsx` with a root `div`, blurred background image, honest foreground image, a Canvas overlay, and a requestAnimationFrame loop active only while `isPlaying` is true. Each frame must:

```ts
const frame = readFrame();
root.style.setProperty("--photo-scale", String(1 + frame.low * 0.055));
root.style.setProperty("--ring-alpha", String(0.25 + frame.mid * 0.65));
root.style.setProperty("--beat-flash", String(frame.beat ? frame.intensity : 0));
```

On a beat, add no more than 14 particles to a capped pool of 90. Draw a circular frequency ring plus particles on Canvas. On pause, cancel the frame, clear particles, and leave the photo at scale `1`. When `matchMedia("(prefers-reduced-motion: reduce)")` matches, cap scale at `1.015` and skip particle creation.

- [ ] **Step 3: Implement the zero-instruction studio flow**

Create `components/photo-beat-studio.tsx` with `"use client"`. It must:

- validate image/audio with Task 1 functions;
- use `/sample/original-spark.wav` until the user chooses local audio;
- display the chosen photo immediately through an object URL;
- revoke the previous photo/audio object URL when replaced and revoke both on unmount;
- never fetch, upload, or mention AI restyling;
- disable the primary play button until a valid photo and playable audio source exist;
- call `await resume()` before `audio.play()`;
- reset audio time and detector before replay;
- show `Original Spark` or the local file name as the current track;
- expose photo input, `Original Spark` and `Your Song` choices, local audio input, play/pause, replay, and change-photo controls.

Use these exact public-facing anchors:

```tsx
<p className="studio-kicker">PHOTO BEAT LAB</p>
<h1>One photo. One song. Hit the beat.</h1>
<p>Your files stay in this browser.</p>
<button type="button">Enter the beat</button>
```

- [ ] **Step 4: Replace the default page and metadata**

`app/page.tsx` remains a Server Component:

```tsx
import { PhotoBeatStudio } from "@/components/photo-beat-studio";

export default function Home() {
  return <PhotoBeatStudio />;
}
```

Set metadata in `app/layout.tsx`:

```ts
export const metadata: Metadata = {
  title: "PostLullaby — One photo. One song. Hit the beat.",
  description: "Turn a photo and a song into a live beat-reactive visual.",
};
```

- [ ] **Step 5: Build the Y2K visual system in global CSS**

Replace the default light/dark page treatment with a black-blue stage, cyan/hot-pink/yellow accents, chrome-white text, visible keyboard focus, responsive single-column controls, and CSS driven by `--photo-scale`, `--ring-alpha`, and `--beat-flash`. Keep shadcn theme tokens intact if components still depend on them. Add a reduced-motion media query that disables nonessential transitions and animations.

The following layout invariants are mandatory:

```css
.studio-shell { min-height: 100svh; overflow-x: clip; }
.visual-stage { position: fixed; inset: 0; }
.visual-stage__photo { transform: scale(var(--photo-scale, 1)); }
@media (max-width: 640px) { .studio-panel { width: calc(100% - 24px); } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } }
```

- [ ] **Step 6: Run static verification and commit**

Run: `npm test && npm run lint -- --ignore-pattern '.worktrees/**' && npm run typecheck && npm run build`

Expected: all commands exit 0.

Commit:

```bash
git add app components lib package.json package-lock.json
git commit -m "feat: build photo beat visual spike"
```

---

### Task 3: Browser acceptance and effect-quality gate

**Files:**
- Modify only if acceptance finds a concrete defect: `components/photo-beat-studio.tsx`, `components/beat-visualizer.tsx`, `components/use-audio-beats.ts`, `app/globals.css`
- Modify: `README.md`

**Interfaces:**
- Produces browser evidence for the approved spike; does not add product scope.

- [ ] **Step 1: Document local testing and copyright boundary**

Update README with exactly these operational facts: `npm run dev` starts the prototype; Original Spark is repository-owned; a local song never leaves the browser; users must hold rights to any selected song; there is no AI restyle, server upload, or export in this spike.

- [ ] **Step 2: Run desktop acceptance at 1440x1000**

Verify the empty state, photo preview, Original Spark playback, beat-reactive scale/flash/ring/particles, pause, replay, change photo, unsupported-file errors, no horizontal overflow, and no console errors. Confirm DevTools network shows no request for the selected local photo or audio.

- [ ] **Step 3: Run mobile and reduced-motion acceptance**

At 390x844, repeat photo selection and Original Spark playback; confirm controls remain visible and tappable. Emulate reduced motion and confirm scale is capped, particles are absent, and playback/glow still work.

- [ ] **Step 4: Test a legally obtained local high-energy song**

Use the browser file chooser with a local audio file supplied by the user. The file must not be copied into the repository. Verify the displayed track name, playback, and visible beat response. If the file is not available, report this criterion as user-input blocked; do not substitute an unauthorized download.

- [ ] **Step 5: Run final verification and commit**

Run: `npm run verify`

Expected: tests, lint, typecheck, and production build exit 0.

Commit:

```bash
git add README.md app components
git commit -m "test: validate photo beat spike experience"
```

## Plan self-review

- Spec coverage: local photo, bundled original, local song, privacy, honest imagery, beat effects, single audio graph, responsive views, reduced motion, and the evaluation gate all map to Tasks 1–3.
- Scope: API/provider work, upload, export, memory/lyrics, accounts, and payment remain excluded.
- Type consistency: `BeatFrame`, `AudioEnergyFrame`, `useAudioBeats`, `BeatVisualizer`, and `PhotoBeatStudio` have one name and one owner throughout.
- Deferred-work scan: every implementation step is concrete; browser acceptance may change code only in response to an observed defect.
