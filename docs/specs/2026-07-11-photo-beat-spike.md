# PostLullaby Photo Beat Effect Spike

**Status:** Approved for effect validation on 2026-07-11

## Decision

Before building the full memorial-song pipeline, validate the product's visual “wow” moment with the smallest possible interactive prototype.

The spike turns one pet or person photo into a music-reactive scene. **Original Spark** is a 15-second bundled sample; a small **bundled track library** offers a few longer royalty-free songs with real drum content for a fuller preview; **Your Song** plays the selected local track in full for browser testing. A commercial song such as “Gee” is never bundled, downloaded, uploaded, or committed by the app; the user may select a legally obtained local copy, and analysis stays in the browser. This spike has no export.

Every bundled library track must carry a verifiable royalty-free or CC0-equivalent license (e.g. Pixabay License) confirmed at download time, with its source URL, license, and artist recorded in `public/sample/library/LICENSES.md`. A track is added to the repository only after its license and audio content have both been independently confirmed — filename alone is not sufficient confirmation, since a filename can be wrong or misleading.

The existing memorial MVP specification remains preserved, but its implementation is paused until this spike is evaluated. The spike does not claim that the product direction has permanently changed.

## User promise

**One photo. One song. Instantly see it hit the beat.**

The prototype should feel understandable without instructions and visibly exciting within the first three seconds of playback.

## Day 0 scope

### Inputs

- One JPEG, PNG, or WebP photo of a pet or person, selected locally.
- One of three music sources:
  - **Original Spark:** a bundled, original 15-second Y2K pop sample created for the prototype.
  - **Library tracks:** a small, fixed set of bundled royalty-free songs (license recorded per track) offering a fuller, real-drum preview beyond Original Spark's 15 seconds.
  - **Your Song:** one browser-supported local audio file selected by the user.

### Flow

1. The page opens directly on a photo drop zone with the product promise.
2. The visitor selects a photo and immediately sees a preview.
3. The visitor keeps **Original Spark**, picks a **library track**, or selects **Your Song**.
4. One primary button starts playback and switches into the visual stage.
5. Pause, replay, choose another photo, and choose another song remain available.

There is no memory field, lyric generation, account, payment, provider call, upload, or export in this spike.

## Visual direction

- Full-viewport dark stage with the same photo enlarged and blurred behind the subject.
- The primary photo remains visually honest; no face generation, face warping, lip-sync, or synthetic motion.
- Low frequencies drive a restrained 1.00–1.08 photo scale pulse.
- Beat peaks trigger a brief frame flash, color accent change, and particle burst.
- Mid and high frequencies drive an outer waveform ring and small light particles.
- A short intro settles the image before the first strong beat; the strongest moments should feel intentional rather than constantly noisy.
- The original preset uses bright Y2K pop energy: cyan, hot pink, warm yellow, chrome-white highlights, and fast but readable transitions.
- `prefers-reduced-motion` reduces scale and particles while preserving audio playback and a gentle glow response.

## Technical design

- All photo and user-audio data remains in the browser as object URLs and is revoked when replaced or on unmount.
- One `HTMLAudioElement` feeds one `AudioContext` and one `AnalyserNode`.
- Real-time beat detection uses adaptive low-frequency energy: a beat fires only when current energy clears a rolling average threshold and a short cooldown has elapsed.
- Canvas owns the waveform ring and particles. CSS owns photo transforms, frame flashes, and layout.
- The bundled original sample is a repository-owned generated audio asset, not an imitation or copy of a named commercial recording.
- No API route, database, storage, analytics, or server-side media processing is added.

Suggested ownership boundaries:

- `components/photo-beat-studio.tsx`: selection, state, controls, and object URL lifecycle.
- `components/beat-visualizer.tsx`: visual stage and Canvas rendering.
- `components/use-audio-beats.ts`: Web Audio setup, normalized energy, beat events, pause/resume, and cleanup.
- `scripts/make-original-sample.mjs`: reproducibly generates the original prototype track.
- `public/sample/original-spark.wav`: bundled original 15-second sample.
- `public/sample/library/`: bundled royalty-free library tracks, trimmed to a preview length.
- `public/sample/library/LICENSES.md`: source URL, license, and artist for every bundled library track.

## Error handling

- Unsupported or unreadable image and audio files produce a concise field-level error.
- AudioContext starts or resumes only after the visitor presses Play.
- A decoding or playback failure returns to the ready state without losing the selected photo.
- The UI never implies that a local song was uploaded or AI-restyled.

## Acceptance criteria

- [ ] A first-time visitor can select a photo and start the bundled sample without instructions.
- [ ] Each bundled library track has a confirmed royalty-free license recorded in `public/sample/library/LICENSES.md`, verified against the track's actual audio content and metadata, not just its filename.
- [ ] A user can select a legally obtained local audio file and see the same visual stage respond to it.
- [ ] Neither the photo nor local audio produces a network request.
- [ ] Strong beats visibly affect photo scale, frame light, waveform, and particles without obscuring the subject.
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
