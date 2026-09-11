# Build plan — adaptive training app

**Companion to:** `adaptive-training-plan-spec.md`
**Purpose:** turn the spec into an ordered, checkable sequence of work, plus a first-pass long-range plan to Barcelona.

---

## 0. Before writing code

**Update, 9 Sept 2026 — pivoted away from physio-authored rules.** The app no longer waits on a physio appointment for anything. `engine_params` (renamed from `physio_params`) is self-authored from standard sports-science defaults (workload-ratio bands, 10%-rule volume cap) and can be written on day one — see spec Section 4/5. This removes what used to be the biggest blocker in this section.

A few inputs still matter, though:

- [ ] **Barcelona Marathon exact date.** Treated below as **assumed mid-March 2027** (the race's usual slot) purely to size the plan. Confirm the real date once registration opens and adjust the periodization table — the phase boundaries shift but the structure doesn't.
- [x] **Garmin account credentials for programmatic auth.** Done — `garmin-connect-sdk` (Node 24+, actively maintained) authenticates independently of `garmin-mcp`; tokens persist in the `garmin_tokens` table, refreshed automatically, no stored password.
- [ ] **Notification channel for the Sunday draft** (spec open item) — push, email, or in-app only. In-app only is the cheapest to build and consistent with "nothing auto-applies" — you're opening the app anyway to approve.

---

## Phase 0 — Foundations (~half a day)

- [x] Create Supabase project (chosen over Neon) — using `@supabase/supabase-js` directly rather than a raw Postgres connection string, see spec Section 3 addendum
- [x] Create Nuxt app (`apps/web`) — ended up on Nuxt 4 (current major), Tailwind + Pinia + PWA modules installed
- [ ] Set up Vercel project linked to the repo, add Supabase env vars — not done yet, everything so far tested locally
- [x] Set up a private git repo
- [x] Decide package layout: `apps/web` (Nuxt), `packages/engine` (rules engine)

---

## Phase 1 — Data layer & Garmin ingestion (~1 day)

**Schema**

- [x] `activities`, `plan_sessions`, `plan_revisions`, `garmin_tokens` — built and migrated
- [x] `physio_params` — built, but **superseded** by the 9 Sept pivot; renamed to `engine_params` (same "rules as data" shape, self-authored defaults instead of physio-supplied). Needs a rename migration.
- [ ] `daily_health_metrics` — new table, not yet built: HRV status/averages, resting HR, body battery min/max, stress average, raw payload per metric. This is what the engine actually reads now.
- [ ] `symptoms` — never built (Phase 2 hadn't started when the pivot happened, nothing to undo). Replaced by a much smaller `daily_notes` table: date, optional `note`, optional `rpe`. No pain/limp fields.
- [ ] Seed `engine_params` v1 with the sports-science defaults from spec Section 4/5 (workload-ratio bands, 10%-rule cap, consecutive-clean-weeks thresholds) — this can happen now, nothing left to wait on

**Garmin ingestion** (unofficial Garmin Connect API via `garmin-connect-sdk`, per spec's updated Section 3)

- [x] Garmin Connect auth: `npm run garmin:login` (one-time, interactive, handles MFA if Garmin challenges for it) — tokens persist and refresh automatically after that
- [x] Token storage: `garmin_tokens` table in Supabase via a `SupabaseTokenStorage` class implementing the SDK's `TokenStorage` interface. **Not application-level encrypted** — sitting in a plain Supabase table, relying on Supabase's own at-rest encryption and the service-role key gate. Fine for personal use; revisit if this ever stops being single-user.
- [x] Fetch module (`server/utils/syncGarmin.ts`): lists recent activities, skips ones already in `activities` by `external_id`, fetches full detail only for new ones
- [x] Idempotency verified: re-running the sync against the same 20 activities produced 20 skips, 0 duplicates
- [x] Auth verified: `/api/cron/sync-garmin` rejects requests without the correct `CRON_SECRET` bearer header (401)
- [x] **Real-data test:** first sync pulled 20 genuine activities from the connected Garmin account into Supabase. One bug found and fixed live: `distance_m`/`moving_time_s`/etc. were typed `integer` but Garmin returns floats (e.g. `1787.807`) — migrated to `double precision`.
- [ ] **New, from the pivot:** a second fetch module for `daily_health_metrics` — `garmin.health.getHrvStatus()`, `getBodyBattery()`, `getHeartRate()` per day, upserted (not insert-only like activities, since a day's data can still update). Same cron, same auth session, just a second table.
- [ ] Wire the actual Vercel Cron schedule (`vercel.json`) — not done, no Vercel project linked yet; route works when curled by hand
- [ ] Log sync failures somewhere visible beyond the response body (e.g. Vercel's own function logs are enough for now, but revisit once this runs unattended)

**Decision checkpoint:** the unofficial API worked cleanly on the first real attempt (after the column-type fix) — no reason yet to fall back to the Strava webhook path.

---

## Phase 2 — Optional daily note (~1 hour)

Much smaller than the original symptom form, and no longer load-bearing for anything the engine does.

- [ ] Build the `Log` screen: one free-text note, one optional RPE (1–10)
- [ ] Server route: upsert into `daily_notes`, one row per day (edit-in-place is fine here — unlike the old symptom design, there's no "no backfill" rule, since nothing downstream depends on this being tamper-proof)
- [ ] No optimistic-write urgency this time — it's not gating anything, so a missed or late note costs nothing structurally. Basic write is enough.

---

## Phase 3 — Rules engine (~1–2 days)

Pure `packages/engine`, no infrastructure, per spec Section 5 (rewritten in the 9 Sept pivot — no more physio dependency). **Built and passing as of this session.**

- [x] Define the verdict type: `progress | hold | regress | stop` (renamed from `stop_and_call_physio`)
- [x] Implement the workload-ratio calculation from `activities` (`workloadRatio.ts`) — returns `null` (not a false reading) when there's under 14 days of history
- [x] Implement HRV-status and resting-HR-trend checks from `daily_health_metrics` (`healthSignals.ts`)
- [x] Implement the multi-signal `stop` condition (`evaluate.ts`) — requires workload ratio in the danger zone **and** HRV unbalanced/low **and** an RHR spike simultaneously, not any single metric alone
- [x] Implement the two-consecutive-clean-weeks progression rule (`cleanWeek.ts`), using `engine_params` bands instead of physio thresholds. "Clean week" is now precisely defined (former spec open item, resolved): as of a given date, workload ratio is known and below the danger zone, and neither the HRV nor RHR red flag is tripped.
- [x] Hard-code the Italy trip (17–29 Sept 2026) as a deload window (`italyDeload.ts`) with no volume make-up afterward — checked *before* the deload branch bails out on progression, so an active `stop` condition still fires during the trip; travel doesn't excuse a genuine red flag
- [ ] Automatic phase-transition unlock after N consecutive clean weeks (`consecutiveCleanWeeksToUnlockPhase` exists in `engine_params`, but nothing reads it yet — there's no "phase" concept wired into `evaluate()` output. Needed once `plan_sessions`/Phase 4 exist to actually act on a phase change.)
- [x] Clamp function (`clamp.ts`) bounding any proposed weekly volume increase — independent of the MCP layer, ready for when a draft revision needs bounding
- [x] Test suite (15 tests across 4 files) written before wiring anything else to this package. Covers: multi-signal `stop` (and that danger-zone-ratio-alone → `regress` not `stop`, and HRV+RHR-alone → `hold` not `stop`), progression requiring two weeks not one, Italy deload holding regardless of an otherwise-clean streak, clamp rejecting/capping an out-of-bounds proposal, insufficient-history handling
- [x] `engine_params` v1 seeded (`npm run engine:seed` in `apps/web`) with the sports-science defaults: workload ratio sweet spot 0.8–1.3, danger zone ≥1.5, 10% weekly volume cap, 2 consecutive clean weeks to progress, 3 to unlock a phase, RHR spike threshold 5bpm, body battery floor 25
- [x] `@fitness/engine` wired as a real workspace dependency of `apps/web` (not just a sibling package) — `npm run engine:evaluate` loads real Supabase data and runs `evaluate()` against it
- [x] **Real-data test:** ran against the actual ingested Garmin history (21 activities, 9 days of health metrics spanning 29 Jul–10 Sep). First run surfaced a genuine reason-text bug — a `hold` verdict blamed "streak not long enough" when the real cause was the workload ratio (0.61) sitting below the sweet-spot floor with the streak already satisfied (2/2). Fixed live; the two causes now get distinct messages.

---

## Phase 4 — App UI (~1 week of evenings)

Build once Phases 1–3 have real data flowing (spec Section 9 sequencing — don't build against an empty database). **First pass built and smoke-tested this session, against real data.**

- [x] `Today` screen (`app/pages/index.vue`): adaptation banner, metric tiles (weekly volume, workload ratio, HRV status, resting HR), low-key note nudge. No session-card/phase content yet — there's no `plan_sessions` data or phase concept until Phase 5 exists; the banner is the real content for now.
- [x] `Log` screen (`app/pages/log.vue`) — this *is* Phase 2, done as part of this pass rather than separately
- [x] `Plan` screen (`app/pages/plan.vue`) — empty-state stub ("activates once the weekly draft is wired up"), since `plan_sessions` has no rows and no write path yet. Revision history / diff badges deferred to Phase 5.
- [x] `Trends` screen (`app/pages/trends.vue`): three charts over the last 42 days — weekly volume, workload ratio with the sweet-spot band shaded, verdict history as a colored strip. Hand-rolled inline SVG (`LineChart.vue`, `VerdictStrip.vue`) rather than pulling in Chart.js/unovis — three simple charts didn't justify the dependency, especially given the `vue-router`/`pinia` peer-dep fragility already hit in Phase 0.
- [x] Built `DailyNoteForm`, `AdaptationBanner` (no `SessionCard` yet — nothing for it to show until Phase 5)
- [ ] Pending-approval state — deferred, no `plan_revisions` drafts exist yet (needs Phase 5's weekly cron)
- [x] **Stop state**, designed deliberately per spec: solid red panel (not a toast), explicitly labeled "not dismissible," names exactly which signals tripped it (workload ratio, HRV, resting HR) with their values, says "consider medical advice" without assuming a specific physio relationship
- [x] Shared server util (`server/utils/trainingData.ts`) maps Supabase rows → engine types once, used by every API route and the standalone scripts — no duplicated mapping logic
- [x] **Real-data smoke test:** booted the dev server and curled every route and page. `/api/today` returns the live `hold` verdict with real signals; a note round-tripped through `/api/notes` GET→POST→GET; `/api/trends` returned a real 7-point series; all four pages render their heading with no error page.

---

## Phase 5 — MCP layer + weekly cron (~1 day + 1 hour)

Build last, per spec Section 9 — resist building this first, it's the tempting part but useless without the engine underneath. **Built and verified end-to-end this session.**

- [x] Remote HTTP MCP server (`server/api/mcp.ts`) — stateless `StreamableHTTPServerTransport` (fresh server+transport per request; no session state to lose between Vercel invocations), bearer-token auth via `MCP_BEARER_TOKEN` (deliberately separate from `CRON_SECRET` — different caller, different trust boundary)
- [x] All five tools implemented (spec's "four" bullet bundles `get_current_plan`/`get_plan_history` together): `get_training_window(days)`, `get_current_plan()`, `get_plan_history()`, `propose_revision(json)`, `apply_revision(planRevisionId)`
- [x] Confirmed `propose_revision` always routes through the Phase 3 clamp — it's the *only* write path to `plan_sessions`/`plan_revisions`, shared by both the MCP tool and the weekly cron (`server/utils/planRevisions.ts`), so there's no second path that could skip it
- [x] Weekly draft (`server/utils/weeklyDraft.ts` + `/api/cron/weekly-draft`) — **fully deterministic, no LLM call**, deliberately: it reads the engine verdict and mechanically proposes hold/+cap%/-20% accordingly. `stop` skips drafting entirely (nothing to approve into). The MCP tools remain available for a richer, on-demand, chat-driven proposal when asked — same clamp either way.
- [x] `vercel.json` added with both cron schedules. Daily, not the 2–4h cadence originally sketched — **Vercel's Hobby plan only allows daily-granularity cron schedules**; more frequent syncing needs Pro, or manual triggering in the meantime.
- [ ] Notification channel for the pending draft — still open (Phase 0 item), not wired to anything yet; a new `pending` row is silent until you open Trends/Plan or ask
- [ ] `apply_revision` implemented but not yet exercised end-to-end (only `propose_revision`'s write path and `get_current_plan`'s read path have been tested against real data so far)
- **Real-data test:** hit `/api/cron/weekly-draft` for real — it read the actual `hold` verdict and wrote a genuine `pending` `plan_sessions` row (`weekly-target`, unclamped) plus its `plan_revisions` audit row. Then called `tools/call get_current_plan` over the actual MCP JSON-RPC protocol (`initialize` → `tools/list` → `tools/call`) and got that exact row back — proves the cron-writes/MCP-reads loop is real, not just unit-tested in isolation.
- **Caught and fixed live:** appending two secrets to `.env` back-to-back merged them onto one line (missing newline) — one 401 down a debugging rabbit hole before the file structure turned out to be the actual bug, not the auth logic. Fixed; both tokens confirmed at their correct 64-char length now.

---

## Phase 6 — Hardening & deploy

- [ ] Single env-var bearer token for auth (spec explicitly scopes out anything heavier for a single-user app)
- [ ] Confirm the `pending`-status-plus-cron-sweep pattern is sufficient — no queue infra needed at this volume
- [ ] Smoke-test the full loop once end-to-end: real Garmin sync (activities + health metrics) → engine verdict → MCP draft → approval → written back to `plan_sessions`
- [ ] Add basic alerting on ingestion failures (Phase 1) and cron failures (Phase 5) — these are the two silent-failure points in the whole system

---

## Long-range plan: today → Barcelona Marathon

**Caveats up front:** phase boundaries below are placeholders. They need the confirmed Barcelona date to become real (the physio dependency is gone as of the 9 Sept pivot — phase transitions now unlock on consecutive clean weeks, not a sign-off). Treat this as the shape of the plan, not the plan.

| Phase | Window (assumed) | Focus | Notes |
|---|---|---|---|
| Return-to-run | now – ~late Sept 2026 | Walk-run progression, gated on workload ratio + HRV + RHR trend | Currently active; this is what the engine (Phase 3) governs first |
| Deload | 17–29 Sept 2026 | Italy trip, hard-coded no-progression window | Already encoded as a rule, not a suggestion |
| Continuous running build | late Sept – late Oct 2026 | Rebuild aerobic volume, phase-unlock to continuous running after N consecutive clean weeks | Automatic, per `engine_params` — no external gate to wait on |
| Half-marathon sharpening | late Oct – 14 Nov 2026 | Short block into Clontarf Half as a fitness check, not a max-effort race | Treat the result as data for the marathon block, not a goal in itself |
| Recovery + reassessment | 15–30 Nov 2026 | Confirm workload ratio and HRV/RHR settled back down post-race, decide whether an unbroken marathon build is appropriate | This is the decision point the spec's open item #3 refers to |
| Marathon aerobic base | Dec 2026 – mid-Jan 2027 | Volume growth, same signal-gating, no marathon-specific workouts yet | |
| Marathon-specific block | mid-Jan – late Feb 2027 | Long runs, marathon-pace work, layered on the same guardrails | This is where a bone-stress history most needs the conservative-by-default posture the spec commits to |
| Taper | ~3 weeks pre-race | Volume down, intensity maintained | |
| **Barcelona Marathon** | **assumed mid-March 2027** | | **Confirm actual date** |

The app doesn't need this whole table encoded upfront — `engine_params` and the phase-unlock counters are what actually drive progression, and those are meant to change as reality diverges from the plan (that's the entire premise of the spec). This table exists so the UI's `Trends`/`Plan` screens have a sense of where "now" sits inside the bigger arc, and so the Sunday MCP draft can reference "weeks to marathon" sensibly once that number is real.

---

## Suggested near-term order

1. ~~Finish Phase 1's remaining piece — `daily_health_metrics` ingestion~~ — done
2. ~~Rename `physio_params` → `engine_params` and seed v1~~ — done
3. ~~Phase 3 (rules engine)~~ — done, tested against real data
4. **Next up:** Phase 4 (app UI), so there's a daily reason to open the app instead of running scripts by hand. Note the workload ratio needs real history to mean much — it's currently reading 0.61 (below the sweet-spot floor) largely because there's only ~6 weeks of ingested activity history and a recent lighter stretch; expect the number to stabilize as more real weeks accumulate.
5. Phase 2 (daily note), whenever — quick, and not load-bearing for anything else
6. Phase 5 last — the phase-transition-unlock piece of Phase 3 also waits until here, since it needs `plan_sessions` to have something to act on
