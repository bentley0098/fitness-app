# Adaptive training plan — project spec

**Status:** draft v2 — pivoted 9 Sept 2026 away from physio-authored rules and symptom-gating; see the note at the end of Section 1.
**Owner:** Gavin
**Context:** Returning to running after a fibula stress reaction, still in the cautious window. Target events: Clontarf Half Marathon, 14 Nov 2026; Barcelona Marathon, 2027.

---

## 1. Problem

Off-the-shelf plans (Runna and similar) are static. They prescribe a week and expect you to follow it. Coming back from a bone stress injury, the plan needs to respond to how training is actually landing — and it needs to be conservative by default, because the failure mode is a second stress reaction, not a missed session.

The goal is a personal training app that:

- ingests activity and recovery data automatically, with no manual entry
- adapts the upcoming week against explicit, objective rules — not a clinician's judgment call
- explains every change it makes
- never applies a change without human approval

**v1 → v2 note:** the original draft made the physio the source of truth (pain ceilings, morning-stiffness thresholds, sign-off flags for phase transitions) and treated a daily pain/limp/RPE log as the primary gate, with Garmin data as secondary corroboration. That inverted, deliberately: **Garmin's own recovery signals are now the primary gate**, and there's no dependency on a scheduled appointment that hadn't happened yet. A quick optional note stays available for personal context, but the engine never reads it — nothing gates on it. Section 5 has the replacement logic; the "still cautious" posture (conservative defaults, a hard stop state, no injury-risk shortcuts) is unchanged.

---

## 2. Design principles

**The LLM does not decide load.** Claude reads data, proposes a revision, and writes the rationale. A deterministic rules engine holds the hard limits and clamps anything the model produces. A bone stress reaction punishes a system that can be talked into a bigger week.

**Garmin's recovery signals are the primary gate.** HRV status, resting heart rate trend, body battery, and a workload ratio computed from ingested activity data substitute for a clinician's judgment call. These are conservative defaults baked into the engine, not thresholds tuned by a physio — see Section 5. An optional daily note stays available for your own context, but the engine never reads it; it's memory, not a gate.

**Nothing auto-applies.** The engine proposes, the user approves. One tap, but always a tap.

**Every change carries a reason.** Adaptations are stored with a human-readable justification and surfaced in the UI. Trust in the plan collapses the first time it holds you back with no explanation.

**Target dates are advisory.** If a safe progression can't reach race fitness in time, the system says so early rather than compressing the block.

**Single user, by design, not just by scope cut.** This is Gavin's training app, not a product. No `user_id` columns, no tenancy, no account system — the whole app is scoped to one Garmin account and one bearer token. If that ever changes, it's a different, harder app; don't build hooks for it speculatively.

---

## 3. Architecture

```
Garmin watch
    |
    v
Garmin Connect (unofficial API) ---- poll ---->  Ingest endpoint
                                     activities + HRV/RHR/body battery
                                              |
Optional daily note (PWA) --------------------+  (stored, never read by the engine)
                                              |
                                              v
                                          Postgres
                                  activities, daily_health_metrics,
                                     daily_notes, plan, revisions
                                              |
                                              v
                                        Rules engine
                                  progress / hold / regress / stop
                                              |
                                              v
                                         MCP server
                                  reads window, proposes revision
                                              |
                                              v
                                        Human approval
                                    writes back to plan table
```

### Why Strava rather than Garmin direct

The Garmin Connect Developer Program (Activity API) is what commercial apps use. It delivers push notifications within seconds of a device sync and gives access to full FIT files. It is also partner-gated with no self-serve key, requires OAuth 2.0 + PKCE, and demands a partner verification covering deregistration and permission-change endpoints.

Garmin auto-syncs to Strava, so a Strava `activity/create` webhook fires within seconds of the same sync, with a far lighter setup. Start on Strava. Migrate to Garmin direct later only if the FIT-level detail turns out to matter.

Strava specifics worth noting up front:

- One push subscription per API application.
- Subscription is validated by a `GET` handshake — verify `hub.verify_token`, echo `hub.challenge` within 2 seconds.
- Events are not cryptographically signed. The handshake is the only security boundary.
- Payloads are thin (`object_type`, `aspect_type`, `object_id`). Fetch full data from the REST API.
- Acknowledge every event with a 200 within 2 seconds or it retries, up to three attempts. Do the fetch-and-store work asynchronously.

### Update, 7 Sept 2026 — reconsider Garmin direct as the v1 source

The reasoning above assumed the *official* Garmin Connect Developer Program, which is genuinely partner-gated. But there's a working precedent now: this environment has an MCP server (`garmin-mcp`) with deep read/write access to a personal Garmin account — activities, HRV, training readiness, race predictions, VO2max, endurance score, heart rate zones, plus the ability to create and schedule workouts on the device. That's built on the *unofficial* Garmin Connect API (session/cookie auth via a library such as `garth` or `python-garminconnect`), not the gated one. No partner approval, no OAuth app review — just account credentials and a token refresh cycle.

This flips the calculus for a single-user personal app:

- **Richer data.** Training readiness, HRV trend, endurance score, and race predictions aren't available via Strava at all, and they're directly useful to a return-to-run engine (e.g. training readiness as a secondary corroborating signal alongside symptoms).
- **No push webhook, but none is needed.** The plan adapts on a weekly cadence (Section 6) with symptoms as the primary daily gate. Polling Garmin 2–4×/day is more than sufficient — nothing here needs sub-minute latency.
- **Risk to weigh:** unofficial API, so it can break on a Garmin-side change, and it's against Garmin's ToS in the strict sense. Acceptable for a personal single-user tool; would not be acceptable to ship to other people.

**Recommendation:** build the ingest layer against Garmin Connect direct (unofficial API, same mechanism `garmin-mcp` uses) as the v1 source. Keep Strava as a documented fallback if the unofficial API becomes unreliable — the `activities` table schema is source-agnostic either way. See `build-plan.md` for the concrete ingestion steps.

Note the distinction: `garmin-mcp` is a tool available to *this Claude session*, not something the production app's backend can call at runtime. The app's own ingestion service needs its own auth against Garmin Connect, using the same class of library — it doesn't route through Claude in production.

### Update, 9 Sept 2026 — health metrics, not just activities

`garmin-connect-sdk` (the library actually installed) doesn't implement Garmin's proprietary Training Readiness score or Training Load Balance endpoint — those exist in the Python library `garmin-mcp` happens to use, not in the Node one. Rather than reverse-engineer undocumented endpoints to match them, the engine (Section 5) is built on signals the SDK does expose cleanly — HRV status, body battery, daily heart rate — plus a workload ratio computed from our own ingested `activities`. This is arguably better for the "every change carries a reason" principle: a computed ratio is explainable in the UI; a vendor black-box score isn't.

---

## 4. Data model

Six tables. This is the spine of the system — get it right and everything else is thin. None of them carry a `user_id` — single-user by design (Section 2), so every row implicitly belongs to the one account the app runs against.

### `activities`
Ingested from Garmin Connect direct (Section 3). Distance, moving time, elapsed time, average and max HR, cadence, elevation, activity type, external ID, raw payload.

### `daily_health_metrics`
One row per day, ingested alongside activities. HRV status and last-night/weekly averages, resting heart rate, body battery min/max, stress average, raw payload per metric. This is what the rules engine actually reads (Section 5) — the closest thing this app has to a physio's judgment call, computed rather than diagnosed.

### `daily_notes`
One row per day, entirely optional, entirely informational. Free-text note plus an optional RPE (1–10) if you want to record how a session felt. The engine never reads this table — it exists for your own scrollback, not for any rule. No pain/limp-specific fields; if something's actually wrong, write it in the note and use your own judgment about whether to see someone, same as you would without this app.

### `plan_sessions`
The prescribed plan as structured data, not prose:

```json
{
  "date": "2026-09-14",
  "phase": "return-to-run",
  "type": "walk_run",
  "prescription": { "reps": 6, "run_min": 3, "walk_min": 2 },
  "cap": { "max_min": 30, "max_hr": 155 },
  "status": "planned",
  "revision": 3,
  "changed_because": "Held at last week's volume — HRV unbalanced 3 of the last 4 days"
}
```

### `plan_revisions`
Append-only. Every change to a session, with timestamp, engine verdict, proposed vs applied, and rationale. When something goes wrong in October you want to read the decision trail, not reconstruct it.

### `engine_params`
The rules, as data rather than code constants: workload-ratio bands, weekly volume increase cap, consecutive clean weeks required before progression and before a phase transition, resting-HR spike threshold, body-battery floor, reassessment interval. These are conservative defaults drawn from standard sports-science heuristics (10%-rule volume progression, acute:chronic workload ratio bands), not physio-supplied — self-authored on day one rather than blocked on an appointment, versioned so they can be tightened or loosened deliberately later.

---

## 5. Rules engine

A pure TypeScript package — no infrastructure, no side effects, no network. Functions over the last 14–28 days of `activities` and `daily_health_metrics` (never `daily_notes` — that table is read by the UI, not the engine), returning one of:

- `progress`
- `hold`
- `regress`
- `stop` (renamed from `stop_and_call_physio` — there's no standing physio relationship driving this anymore; the rationale text says "consider medical advice," it doesn't assume who that is)

### Signals

All computed from data already being ingested, no reliance on Garmin's own opaque scores (Section 3 update):

- **Workload ratio (ACWR)** — trailing 7-day training total ÷ (trailing 28-day total ÷ 4). The standard "sweet spot" is roughly 0.8–1.3; above ~1.5 is the classic injury-risk red zone. This is the main progression/regression driver.
- **HRV status** — Garmin's own daily classification (balanced / unbalanced / low). Unbalanced or low for 2+ consecutive days is a hold signal.
- **Resting heart rate trend** — 7-day rolling average vs. 28-day baseline. A sustained rise above threshold (early illness/overreaching signal) is a hold signal.
- **Body battery** — a very low overnight charge is a same-day caution signal, not a week-level one.

### Guardrails

- Progression requires two consecutive clean weeks (workload ratio in the sweet-spot band, no HRV/RHR red flags) — never a single good week.
- Weekly volume increase is capped (10%-rule default in `engine_params`) regardless of what the workload ratio alone would allow.
- Multiple simultaneous red flags (workload ratio in the danger zone *and* HRV unbalanced/low *and* an RHR spike) return `stop`, skipping adaptation entirely. A single noisy metric shouldn't trigger it — that's the point of using several signals instead of one physio-set pain ceiling.
- Phase transitions (walk-run → continuous, continuous → intervals) unlock automatically after N consecutive clean weeks (`engine_params`), not on an external sign-off. No physio flag exists anymore for the engine to wait on.
- The Italy trip (17–29 Sept 2026) is a hard-coded deload. No rule may make up the missed volume afterwards.
- Model output is clamped by the engine after generation, always. There is no path where an LLM proposal bypasses this.

This is the only part of the system that materially affects injury risk. Unit-test it hard — especially the multi-signal `stop` condition, since that's the guardrail replacing a clinician's judgment.

---

## 6. MCP layer

A remote HTTP MCP server (remote rather than stdio, so it's reachable from Android), bearer-token auth, exposing four tools:

| Tool | Purpose |
|---|---|
| `get_training_window(days)` | Merged activity + health-metric data for the window |
| `get_current_plan()` / `get_plan_history()` | Current plan and full revision trail |
| `propose_revision(json)` | Schema-validated, then clamped by the engine |
| `apply_revision(id)` | Only ever called after explicit approval |

**Weekly run:** a Sunday-evening cron reads the training window, the engine's verdict, and the race date, then drafts next week plus a short rationale. It lands as a pending draft in the app. The MCP proposes, the engine constrains, the human commits.

---

## 7. Application

Nuxt PWA — Vue 3, `<script setup>`, Tailwind, Pinia. Four routes, bottom nav.

### Screens

**Today** — the primary screen and roughly 80% of daily usage. Session card with date and phase, adaptation banner explaining any change, prescribed work and caps as metric tiles, plain-language session description, week strip, and an optional-note nudge (low-key — this is context for you, not a required input).

**Log** — a single free-text note plus an optional RPE (1–10). One control set, one submit, reachable in two taps from Today. Entirely optional; skipping it changes nothing about tomorrow's plan.

**Plan** — upcoming sessions as a vertical list, tap to expand. Past sessions show planned vs actual with a diff badge when the engine intervened. This is where revision history surfaces.

**Trends** — three charts: weekly volume, workload ratio (with the sweet-spot band shaded) over time, engine verdict history. Not a Garmin clone.

### Components

~15 total, of which three do real work: `SessionCard`, `DailyNoteForm`, `AdaptationBanner`. Charts via unovis or Chart.js.

### States that need designing deliberately

- **Pending approval** — a fifth state on Today showing the proposed week, the verdict, the rationale, and approve/edit. Don't push this into a chat window; it should be a ten-second decision.
- **Stop** — design this state first, not as an afterthought. It has the highest consequence and the strongest temptation to style as a dismissible toast. It should not be dismissible. Copy should say what tripped it (which signals, over what window) and suggest getting it checked out — without assuming a specific physio relationship exists.

---

## 8. Build scope

| # | Component | Deploy target | Effort |
|---|---|---|---|
| 1 | Postgres + schema | Neon / Supabase free tier | ~0.5 day |
| 2 | Garmin Connect ingest — activities + health metrics (unofficial API auth, poll cron) | Nuxt server routes + Vercel Cron | ~1 day |
| 3 | Optional daily-note form | Nuxt PWA | ~1 hour |
| 4 | Rules engine | `packages/engine`, no deploy | 1–2 days |
| 5 | MCP server | Vercel, bearer auth | ~1 day |
| 6 | Weekly cron | Vercel Cron | ~1 hour |
| 7 | App UI (4 screens) | Nuxt PWA | ~1 week of evenings |

**Total:** two to three weeks part-time. One Nuxt app plus one Postgres, on infrastructure already in use.

### Explicitly out of scope

- Auth beyond a single env-var token (single user)
- A job queue — a `pending` status column plus a cron sweep is sufficient at this volume
- Redis, Docker, any separate backend service
- Strava integration (kept as documented fallback only, not built unless Garmin direct proves unreliable)
- Official Garmin Connect Developer Program (partner-gated; revisit only if the unofficial API breaks and a commercial-grade integration becomes worth the approval process)

---

## 9. Sequencing

1. **Build 1, 2 and 3 together, first.** Let data accumulate for two weeks. An adaptation engine cannot be tested against an empty database.
2. **Health-metric ingestion runs from day one too** — no reason to wait, and the rules engine needs history to compute a 28-day workload ratio against.
3. **Then 4, immediately** — `engine_params` defaults are self-authored (Section 4), not blocked on an appointment. Building the engine no longer waits on anything external.
4. **Then 7,** so there's something to look at daily.
5. **Then 5 and 6.**

The MCP layer is the interesting part and the one that will be tempting to build first. Resist it. A Claude-drafted week with no engine underneath is just a chatbot telling you it's fine to run.

---

## 10. Open items

- [x] Pick the actual default numbers for `engine_params` — seeded v1: sweet spot 0.8–1.3, danger zone ≥1.5, 10% weekly volume cap, 2 consecutive clean weeks to progress, 3 to unlock a phase, RHR spike threshold 5bpm, body battery floor 25. Adjustable later — it's versioned data, not code.
- [ ] Decide the notification channel for the Sunday draft (push, email, or in-app only)
- [ ] Set the decision point at which the 14 Nov target is formally reassessed

See `build-plan.md` for the step-by-step build sequence and the long-range periodization outline through Barcelona.
