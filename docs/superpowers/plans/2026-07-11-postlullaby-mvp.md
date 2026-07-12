# PostLullaby MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a no-login, cost-bounded flow that turns one pet photo and one memory into a 45-second ElevenLabs song and audio-reactive memorial scene.

**Architecture:** A single Next.js Route Handler validates multipart input and orchestrates Turnstile, Upstash quota reservation, Gemini planning, and ElevenLabs generation through injected provider interfaces. A client-only creator owns local photo preview, request state, audio playback, and Canvas/Web Audio visualization; all secrets and paid-provider calls stay on the server.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Zod 4, Vitest, Google Gen AI SDK, ElevenLabs JS SDK, Upstash Redis, Canvas 2D, Web Audio API.

## Global Constraints

- Only the approved contest MVP in `docs/specs/2026-07-11-postlullaby-mvp.md` may be implemented.
- Maximum image size is 5 MB; allowed MIME types are JPEG, PNG, and WebP.
- Pet name is 1–40 trimmed characters; memory is 20–600 trimmed characters.
- Song length is exactly 45,000 ms.
- Production fails closed unless Gemini, ElevenLabs, Turnstile, and Upstash are configured.
- Per-IP daily attempt limit is 2; contest-wide attempt limit is 20.
- No login, user center, persistence, payment, regeneration, face animation, or video export.

---

### Task 1: Domain contract and service orchestration

**Files:**
- Create: `domain/tribute.ts`
- Create: `services/create-tribute.ts`
- Create: `services/create-tribute.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `tributeFieldsSchema`, `validateImageFile`, `TributePlan`, `TributeResult`, `CreateTributeDependencies`, and `createTribute()`.
- `createTribute()` consumes `{ name, memory, imageBase64, imageMimeType, turnstileToken, ipAddress }` and returns `{ plan, audioBase64, audioMimeType }`.

- [ ] **Step 1: Add Vitest scripts and write failing orchestration tests**

```ts
it("stops before quota and providers when Turnstile is invalid", async () => {
  const dependencies = fakeDependencies({ turnstileValid: false });
  await expect(createTribute(validInput, dependencies)).rejects.toMatchObject({ code: "BOT_CHECK_FAILED" });
  expect(dependencies.reserveGeneration).not.toHaveBeenCalled();
  expect(dependencies.planTribute).not.toHaveBeenCalled();
  expect(dependencies.composeMusic).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the module does not exist**

Run: `npm test -- services/create-tribute.test.ts`

Expected: FAIL resolving `./create-tribute`.

- [ ] **Step 3: Implement the smallest typed pipeline**

```ts
export async function createTribute(input: CreateTributeInput, dependencies: CreateTributeDependencies) {
  if (!(await dependencies.verifyTurnstile(input.turnstileToken, input.ipAddress))) {
    throw new TributeError("BOT_CHECK_FAILED");
  }
  await dependencies.reserveGeneration(input.ipAddress);
  const plan = await dependencies.planTribute(input);
  const audio = await dependencies.composeMusic(plan.musicPrompt, 45_000);
  return { plan, audioBase64: audio.bytes.toString("base64"), audioMimeType: audio.mimeType };
}
```

- [ ] **Step 4: Run the service tests and verify Turnstile, quota, planner, and composer ordering**

Run: `npm test -- services/create-tribute.test.ts`

Expected: PASS with all provider-order tests green.

### Task 2: Provider adapters and fail-closed quota

**Files:**
- Create: `providers/gemini-tribute-planner.ts`
- Create: `providers/elevenlabs-music-composer.ts`
- Create: `providers/turnstile-verifier.ts`
- Create: `providers/upstash-generation-limiter.ts`
- Create: `providers/runtime-config.ts`
- Create: `providers/runtime-config.test.ts`

**Interfaces:**
- Consumes: domain and service interfaces from Task 1.
- Produces: `createRuntimeDependencies()` for the route.

- [ ] **Step 1: Write failing tests for missing configuration and safe public errors**

```ts
it("refuses live generation when a cost-control secret is missing", () => {
  expect(() => readRuntimeConfig({ GEMINI_API_KEY: "g", ELEVENLABS_API_KEY: "e" }))
    .toThrowError(/TURNSTILE_SECRET_KEY/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- providers/runtime-config.test.ts`

Expected: FAIL resolving `./runtime-config`.

- [ ] **Step 3: Implement strict environment parsing and provider adapters**

```ts
const runtimeConfigSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  SONG_TOTAL_LIMIT: z.coerce.number().int().positive().max(20).default(20),
});
```

Gemini must request JSON output matching `TributePlan`. ElevenLabs must call `music.compose({ prompt, musicLengthMs: 45_000, modelId: "music_v2", outputFormat: "mp3_44100_128" })`. Upstash must increment the per-IP UTC-day key before the contest-total key and throw before providers when either limit is exceeded.

- [ ] **Step 4: Run provider config tests**

Run: `npm test -- providers/runtime-config.test.ts`

Expected: PASS.

### Task 3: Paid generation Route Handler

**Files:**
- Create: `app/api/tribute/route.ts`
- Create: `app/api/tribute/route.test.ts`

**Interfaces:**
- Consumes: `createTribute()` and `createRuntimeDependencies()`.
- Produces: `POST /api/tribute` with stable `200`, `400`, `403`, `429`, `502`, and `503` JSON contracts.

- [ ] **Step 1: Write failing multipart and error-mapping tests**

```ts
it("returns 400 for a memory shorter than 20 characters", async () => {
  const response = await POST(requestWithForm({ memory: "too short" }));
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ code: "INVALID_INPUT" });
});
```

- [ ] **Step 2: Run the route tests and verify RED**

Run: `npm test -- app/api/tribute/route.test.ts`

Expected: FAIL resolving the route.

- [ ] **Step 3: Implement multipart parsing, validation, and error mapping**

```ts
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const form = await request.formData();
  const parsed = parseTributeForm(form);
  const result = await createTribute(parsed, createRuntimeDependencies());
  return Response.json(result);
}
```

The route derives the IP from trusted Vercel forwarding headers, never returns raw exception messages, and sends `Cache-Control: no-store`.

- [ ] **Step 4: Run route and service tests**

Run: `npm test -- app/api/tribute/route.test.ts services/create-tribute.test.ts`

Expected: PASS.

### Task 4: Creator UI and audio-reactive memorial stage

**Files:**
- Create: `components/tribute-creator.tsx`
- Create: `components/audio-memorial.tsx`
- Create: `components/tribute-creator.test.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `POST /api/tribute` JSON contract.
- Produces: accessible form and result states; `AudioMemorial` consumes `{ imageUrl, audioUrl, title, dedication }`.

- [ ] **Step 1: Write failing component-state tests**

```tsx
it("does not submit until the photo, name, and memory are valid", async () => {
  render(<TributeCreator />);
  expect(screen.getByRole("button", { name: /create their song/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run the focused UI tests and verify RED**

Run: `npm test -- components/tribute-creator.test.tsx`

Expected: FAIL resolving `./tribute-creator`.

- [ ] **Step 3: Implement the single-page flow**

The aesthetic is a dark, restrained “midnight remembrance room”: warm ivory text, deep blue-black atmosphere, a small amber memory light, editorial serif display type, and no purple SaaS gradients. The original photo remains visually honest. `AudioMemorial` creates one `AudioContext`, connects the `<audio>` element to an `AnalyserNode`, and renders a circular frequency ring plus low-density particles on Canvas. It pauses animation when audio pauses and respects `prefers-reduced-motion`.

- [ ] **Step 4: Run UI tests, lint, and typecheck**

Run: `npm test -- components/tribute-creator.test.tsx && npm run lint && npm run typecheck`

Expected: PASS and zero lint/type errors.

### Task 5: Documentation, full verification, and browser acceptance

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/specs/2026-07-11-postlullaby-mvp.md`

**Interfaces:**
- Produces: setup instructions, cost controls, challenge attribution, and verified release evidence.

- [ ] **Step 1: Document exact setup and fail-closed behavior**

README must state that provider keys are server-only, Turnstile and Upstash are mandatory in production, `SONG_TOTAL_LIMIT` cannot exceed 20 in this contest build, and provider-side ElevenLabs auto top-up must be disabled manually.

- [ ] **Step 2: Run the complete local verification suite**

Run: `npm run verify`

Expected: unit/integration tests, ESLint, TypeScript, and production build all exit 0.

- [ ] **Step 3: Run browser acceptance**

At 390×844 and 1440×1000, verify photo selection, invalid input, generating state, safe provider-unconfigured error, audio/result state with a fixture response, no overflow, no console errors, keyboard-visible focus, and reduced-motion behavior.

- [ ] **Step 4: Run one live provider smoke after credentials are configured**

Submit one authorized or licensed pet photo and verify one Gemini call, one ElevenLabs call, playable audio, and visible analyzer motion. Record only status, duration, and response size; never record secrets or the user's memorial text.

- [ ] **Step 5: Re-read the spec and mark only evidence-backed acceptance criteria complete**

Any missing credentials, deployment, provider dashboard setting, or public smoke remains an explicit launch blocker and is not described as complete.

## Self-review

- Spec coverage: all Day 0 requirements map to Tasks 1–5; all non-goals remain excluded.
- Placeholder scan: there are no deferred implementation placeholders in the plan.
- Type consistency: `TributePlan`, `TributeResult`, `createTribute()`, and `AudioMemorial` names are consistent across tasks.
- Risk review: provider credentials and provider-side billing controls remain manual gates; the code fails closed when server-side application controls are missing.
