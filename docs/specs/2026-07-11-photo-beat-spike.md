# PostLullaby Photo Beat Effect Spike

**Status:** Approved for effect validation on 2026-07-11

## Decision

Before building the full memorial-song pipeline, validate the product's visual “wow” moment with the smallest possible interactive prototype.

The spike turns one pet or person photo into a 15-second, music-reactive scene. It supports one bundled original sample and one locally selected song. A commercial song such as “Gee” is never bundled, downloaded, uploaded, or committed by the app; the user may select a legally obtained local copy, and analysis stays in the browser.

The existing memorial MVP specification remains preserved, but its implementation is paused until this spike is evaluated. The spike does not claim that the product direction has permanently changed.

## User promise

**One photo. One song. Instantly see it hit the beat.**

The prototype should feel understandable without instructions and visibly exciting within the first three seconds of playback.

## Day 0 scope

### Inputs

- One JPEG, PNG, or WebP photo of a pet or person, selected locally.
- One of two music sources:
  - **Original Spark:** a bundled, original 15-second Y2K pop sample created for the prototype.
  - **Your Song:** one browser-supported local audio file selected by the user.

### Flow

1. The page opens directly on a photo drop zone with the product promise.
2. The visitor selects a photo and immediately sees a preview.
3. The visitor keeps **Original Spark** or selects **Your Song**.
4. One primary button starts playback and switches into the visual stage.
5. Pause, replay, choose another photo, and choose another song remain available.

There is no memory field, lyric generation, account, payment, provider call, upload, or export in this spike.

## Visual direction

**Honesty boundary:** no generative face synthesis, face warping, lip-sync, or fabricated motion of the subject. Deterministic particle re-rendering of the photo's actual pixels is allowed — it is the same pixels drawn another way, with no generated content. The experience must open and close on the unmodified original photo.

The stage is a four-act particle portrait driven by song progress and live audio energy:

- **Act 1 — Opening (0 → ~8%):** the real photo displays untouched on a full-viewport dark stage. At the first strong beat (or the 8% mark), the photo dissolves: it fades out while particles sampled from its pixels fade in near their home positions.
- **Act 2 — Living portrait (~8% → 70%):** the subject exists as thousands of glowing particles carrying the photo's own colors. Low frequencies drive a radial breathing oscillation around each particle's home; mid frequencies modulate particle brightness and radius; each detected beat flashes ~2% of particles white and gives them a brief escape velocity before they spring back.
- **Act 3 — Peak (70% → 92%):** Act 2 continues while the title text fades in.
- **Act 4 — Return (92% → end):** particles glide home and fade out as the real photo fades back in, settling into a still keepsake frame.
- Pause freezes the current act rather than clearing the stage.
- `prefers-reduced-motion` skips the dissolve entirely: the photo stays visible with a gentle audio-driven glow, and no particle motion is shown.

## Technical design

- All photo and user-audio data remains in the browser as object URLs and is revoked when replaced or on unmount.
- One `HTMLAudioElement` feeds one `AudioContext` and one `AnalyserNode`.
- Real-time beat detection uses adaptive low-frequency energy: a beat fires only when current energy clears a rolling average threshold and a short cooldown has elapsed.
- The photo is downsampled once per selection through an offscreen canvas (`drawImage` + `getImageData`) into a pure, testable particle-sampling function; Canvas owns all particle rendering, and CSS owns photo crossfades and layout.
- The bundled original sample is a repository-owned generated audio asset, not an imitation or copy of a named commercial recording.
- No API route, database, storage, analytics, or server-side media processing is added.

Suggested ownership boundaries:

- `components/photo-beat-studio.tsx`: selection, state, controls, and object URL lifecycle.
- `components/beat-visualizer.tsx`: visual stage and Canvas rendering.
- `components/use-audio-beats.ts`: Web Audio setup, normalized energy, beat events, pause/resume, and cleanup.
- `scripts/make-original-sample.mjs`: reproducibly generates the original prototype track.
- `public/sample/original-spark.wav`: bundled original 15-second sample.

## Error handling

- Unsupported or unreadable image and audio files produce a concise field-level error.
- AudioContext starts or resumes only after the visitor presses Play.
- A decoding or playback failure returns to the ready state without losing the selected photo.
- The UI never implies that a local song was uploaded or AI-restyled.

## Acceptance criteria

- [ ] A first-time visitor can select a photo and start the bundled sample without instructions.
- [ ] A user can select a legally obtained local audio file and see the same visual stage respond to it.
- [ ] Neither the photo nor local audio produces a network request.
- [ ] The four acts play in order: untouched photo, dissolve into a recognizable particle portrait, beat-driven breathing and flashes, and a return to the untouched photo.
- [ ] The particle portrait remains recognizable as the uploaded subject, and strong beats visibly move it without destroying its silhouette.
- [ ] Pause stops animation; replay starts cleanly without creating a second AudioContext.
- [ ] Replacing photo or audio revokes the previous object URL and does not leak playback resources.
- [ ] The experience works at 390x844 and 1440x1000 without overflow or hidden controls.
- [ ] Reduced-motion mode remains usable.
- [ ] Lint, typecheck, focused tests, production build, and browser acceptance pass before the effect is presented as validated.

## Evaluation gate

After viewing both **Original Spark** and a locally selected high-energy pop song, evaluate only three questions:

1. Is the effect understandable within three seconds?
2. Do the beat moments feel deliberate enough to replay?
3. Would the result be worth exporting and sharing?

If the answer is not clearly yes, change the visual treatment before connecting Gemini, ElevenLabs, upload infrastructure, or video export.

## Later API path, not part of this spike

If the visual spike succeeds:

- add local beat pre-analysis and downloadable video export;
- add style presets and original ElevenLabs Music generation;
- optionally allow a rights-confirmed, user-owned song to be uploaded to ElevenLabs Music for supported inpainting/restyling;
- keep commercial copyrighted recordings outside the public restyle path because ElevenLabs scans uploads for infringement and may still charge for rejected material.
