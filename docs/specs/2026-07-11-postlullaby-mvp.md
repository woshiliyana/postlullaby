# PostLullaby Weekend Challenge MVP Spec

**Status:** Approved for implementation on 2026-07-11

## Background and user problem

People grieving a pet often have one favorite photo and one memory, but turning those fragments into a personal musical tribute requires writing, composition, production, and visual-editing skills. PostLullaby should turn that small amount of input into one emotionally coherent, playable memorial moment.

PostLullaby is a new contest project with a new repository and new code. It is inspired by the memorial domain, but it is not a PawsLullaby feature or code reuse.

## Value proposition

**Turn one pet photo and one memory into a living musical tribute.**

The memorable moment is not a generic AI form. It is the result screen: the uploaded photo sits inside a restrained audio-reactive memorial scene while the custom song plays.

## MVP / Day 0 scope

### Landing page

- One English, mobile-first page.
- Explain the promise in one sentence and move directly into the creation form.
- Include a concise “How it works” explanation and clear Google AI / ElevenLabs attribution.

### Core function

- Accept one JPEG, PNG, or WebP image up to 5 MB.
- Accept a pet name from 1–40 trimmed characters.
- Accept one memory from 20–600 trimmed characters.
- Gemini analyzes the image and memory and returns a structured tribute plan containing:
  - title;
  - one-sentence dedication;
  - short lyrics suitable for a 45-second song;
  - an English music-generation prompt;
  - a three-color visual palette.
- ElevenLabs Music generates one 45-second song from the plan.
- The browser displays the original uploaded photo in a circular memorial stage and drives its glow, ring, particles, and subtle scale from live audio frequency data.
- Show the title, dedication, lyrics, and native audio controls.
- Never animate or synthesize the pet's face.

### Anonymous access and cost boundary

- No application login.
- A valid Cloudflare Turnstile token is required in production before a paid generation is reserved.
- Limit each IP address to two attempts per UTC day.
- Limit the entire product to 20 attempts for the contest deployment.
- Count attempts rather than only successes because failed provider requests may still incur cost.
- Rate-limit state must be server-side in Upstash Redis; browser storage is not a security boundary.
- API keys remain server-only.
- If the production cost-control configuration is incomplete, the API fails closed and does not call Gemini or ElevenLabs.

### User center

- Explicitly omitted. There is no login, account, history, saved project, or cross-device recovery in the contest MVP.

### Payment

- Explicitly omitted. There is no checkout, entitlement, subscription, or paid regeneration in the contest MVP.

## Core user flow and states

1. **Empty:** visitor sees the promise and form.
2. **Photo selected:** local preview appears; no upload has happened yet.
3. **Ready:** all inputs pass client validation and Turnstile is complete.
4. **Generating:** a single progress state explains that the tribute and song are being composed; inputs are locked.
5. **Success:** audio-reactive memorial stage, audio controls, title, dedication, and lyrics appear.
6. **Validation error:** field-level message explains the exact invalid value or boundary.
7. **Limit reached:** no provider is called; visitor is told the live-generation allotment is complete.
8. **Provider failure:** visitor receives a calm retry-later message; secrets and raw provider payloads are never exposed.

## Inputs, outputs, and persistence

- Input is submitted as `multipart/form-data` to a Next.js Route Handler.
- Image bytes are sent to Gemini only for the current request.
- The image and memory are not written to application storage or a database.
- Output is returned to the current browser session only.
- The generated MP3 is returned as base64 in the JSON response for this small 45-second MVP.
- Refreshing the page loses the result.

## Architecture

- Next.js App Router + TypeScript + Vercel.
- Static Server Component shell with a focused Client Component for upload, audio playback, and Web Audio visualization.
- `domain/` owns validation schemas and public result types.
- `services/` owns the provider-independent generation use case.
- `providers/` owns Gemini, ElevenLabs, Turnstile, and Upstash integrations.
- `app/api/tribute/route.ts` is the only paid-generation entry point.
- Providers are injected into the service so orchestration and fail-closed behavior can be tested without live API calls.

## Acceptance criteria

- [ ] A visitor can select an allowed photo and see its local preview on mobile and desktop.
- [ ] Invalid name, memory, file type, and file size are rejected before a provider call.
- [ ] Production generation cannot run without Gemini, ElevenLabs, Turnstile, and Upstash configuration.
- [ ] A rejected Turnstile token cannot consume provider credits.
- [ ] A blocked IP or exhausted global allowance cannot consume provider credits.
- [ ] One valid request calls Gemini once and ElevenLabs once and returns a 45-second-song response contract.
- [ ] The result uses the user's original photo and visibly responds to audio playback without altering the face.
- [ ] The result includes generated title, dedication, and lyrics.
- [ ] The page works at 390 px mobile width and a desktop viewport without overflow or hidden controls.
- [ ] API keys and raw provider errors never appear in client output.
- [ ] Unit tests, lint, typecheck, production build, and browser acceptance complete successfully before release claims.

## Test plan

- **Unit:** input validation, file rules, public error mapping, and music prompt boundaries.
- **Service:** Turnstile runs before quota reservation; quota reservation runs before providers; Gemini and ElevenLabs are each called exactly once on success; blocked and failed states stop the pipeline.
- **Route integration:** multipart parsing maps valid input into the service and returns a stable JSON response; invalid input returns `400`; rate limits return `429`; missing production configuration returns `503`.
- **Browser acceptance:** empty, selected-photo, validation-error, generating, success/demo, and mobile layout states.
- **Live provider smoke:** one real Gemini + ElevenLabs request after credentials are configured. This is a provider/manual-ops tail and cannot be claimed from mocked tests.

## Launch blockers

- New Google AI and ElevenLabs API keys are not yet present in `.env.local`.
- Upstash Redis and Cloudflare Turnstile credentials are not yet present.
- ElevenLabs PAYG auto top-up must be off and its provider-side spend cap must be set manually.
- A live deployment URL and one real provider smoke are required before the DEV post can claim a functional demo.

## Later polish / non-goals

- Login, user center, database history, payment, regeneration, multiple photos, sharing pages, MP4 export, face animation, multi-language UI, SEO content library, email, analytics dashboard, and admin tooling.
- These are excluded from the contest implementation even if they would be useful after the challenge.
