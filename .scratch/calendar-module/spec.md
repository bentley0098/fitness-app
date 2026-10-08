# Calendar module

Status: ready-for-agent

## Problem Statement

The app decides what **Today** is in ten different places, and every one of them uses the UTC date (`isoDate(new Date())`, which is `toISOString().slice(0, 10)`). Activities are stored under the date the watch recorded locally (`startTimeLocal.slice(0, 10)` in `syncGarmin.ts`). Between local midnight and the UTC offset, "today" and the dates activities were stored under disagree, so a planned session can read as missed or upcoming when it isn't, the "today" tile shows the wrong day, and a proposal can expire early or late.

The calendar arithmetic around it is also scattered. Monday-of-week, week dates and day differences exist in `dates.ts`, `planMeta.ts`, the client's `weekDates.ts`, a private `weekday()` in `strengthSchedule.ts`, a private `isoDate` in `syncHealthMetrics.ts`, and hand-rolled day maths in `dashboardData.ts`. The client even disagrees with the server about which zone "today" is in (the template editor uses the local date, the log page and notes routes use UTC). Nothing lets a test pin the clock, so `buildDay` and `matchDay` take `todayIso` as a parameter while every caller computes it differently.

## Solution

A single **Calendar module**, shared by server and client, owns what **Today** is and the plain-date arithmetic. **Today** is the runner's current calendar date in their own timezone. The zone follows the runner's device, travels to the server as a `tz` cookie, and falls back to Europe/Dublin wherever no device is involved (the MCP tools and the Garmin sync). Nothing outside the module can build "today" from a UTC timestamp, so the bug cannot be written again.

The plan's own constants and week numbering (`PLAN_START_MONDAY`, `RACE_DATE`, `weekNumberFor`) stay in `planMeta` and build on the Calendar module.

## Decisions

- **Module location**: `shared/utils/calendar.ts` (Nuxt 4 `shared/`), importable by `server/` and `app/`. The client's `weekDatesFrom` goes away.
- **Interface**:
  - `today(now, zone)` returns the calendar date of the instant `now` in `zone`. It never reads the runtime's zone or clock itself; callers pass `now` (`new Date()` in production, a fixed instant in tests).
  - Pure date-string arithmetic: `addDaysIso`, `daysBetween`, `mondayOf`, `weekDates`, moved from `dates.ts` and `planMeta.ts`.
  - `DEFAULT_ZONE = "Europe/Dublin"`.
- **Removed from the interface**: `isoDate(Date)` and `weekDatesFrom`. A Date-to-UTC-string helper may stay private inside the module for the arithmetic. `trainingData.ts` stops re-exporting it.
- **Zone source**:
  - A client plugin sets a `tz` cookie from `Intl.DateTimeFormat().resolvedOptions().timeZone` when absent or changed.
  - One server helper takes the request and returns its zone (cookie, else `DEFAULT_ZONE`). Every route and `planView`/`dashboard` entry point gets "today" through it. A comment on the helper records why a cookie: single user today, SSR and every route read it without wiring, and it is the one place to switch to a stored profile zone if the app goes multi-user.
  - Invalid or unrecognised cookie values fall back to `DEFAULT_ZONE`.
- **No-browser contexts** (MCP tools in `mcp/createServer.ts`, Garmin and health sync) use `DEFAULT_ZONE`. The last-seen zone is not persisted.
- **Write-time dates** (strength log date, notes, health metrics rows) use the same `today(...)`. No private date helpers remain.
- **Travel**: while abroad the device zone wins. A few hours of mismatch with watch-local dates is accepted and out of scope.
- **Glossary**: **Today** is defined in `CONTEXT.md`. No ADR; the trade-off lives in the helper's comment.

## Call sites to migrate

Callers building "today" from `isoDate(new Date())`:
`planView.ts:50`, `dashboardData.ts:114`, `planProposals.ts:172, 245, 361`, `strengthLogs.ts:89`, `trainingData.ts:92`, `mcp/createServer.ts:61`, `api/today.get.ts:12`, `api/trends.get.ts:10`.

Other date handling to fold in:
- `syncHealthMetrics.ts:18` (private `isoDate`)
- `strengthSchedule.ts:30` (private `weekday()`)
- `dashboardData.ts:308-312` (`historyDays`)
- `app/composables/weekDates.ts`
- `app/pages/more/log.vue:19`
- `app/pages/strength/templates/[id]/index.vue:65`
- `server/api/notes/index.get.ts:3` and `index.post.ts:3`

## Testing Decisions

Tests cross the Calendar module's interface only, with pinned `now` values and explicit zones; nothing is mocked and nothing reads the runtime `TZ`.

- `today` for Europe/Dublin, Pacific/Auckland and America/Los_Angeles at instants just before and just after local midnight (for example 23:30 UTC in summer is already tomorrow in Dublin).
- The Irish DST changes, 2026-10-25 and 2027-03-28.
- The existing `daysBetween`, `mondayOf` and `weekDates` cases from `planMeta.test.ts`, moved across. The `TZ` override in `planMove.test.ts` goes, since nothing depends on the runtime zone.
- One regression test through `buildDay`: an activity dated by the watch on the runner's evening is matched to the right day when "today" is computed in that zone.
- Server helper: valid cookie, missing cookie, and garbage cookie (falls back to `DEFAULT_ZONE`).
- Backstop: a lint rule (or a test grepping the source) banning `.toISOString().slice(0, 10)` outside `shared/utils/calendar.ts`.

## Out of Scope

- Persisting the last-seen zone, or a per-user zone setting, until there is a real user profile.
- Changing how Garmin stores activity dates (they stay watch-local).
- Changing plan constants or week numbering in `planMeta`.
- The wider plan-calendar read refactor (week, day and dashboard shaping); this spec only fixes where "today" and date arithmetic come from.

## Further Notes

Suggested order for the tickets: (1) the module and its tests, with `dates.ts` and the `planMeta` arithmetic re-pointed at it; (2) the zone cookie, plugin and server helper; (3) migrate the server call sites; (4) migrate the client and the remaining private copies, then add the lint backstop.
