# MCP plan proposals

Status: ready-for-agent

## Problem Statement

I plan my training from the Claude mobile app through this repo's MCP server, and changing a session is clumsy and unsafe. Every edit, even "make Thursday 8km instead of 10km", has to go through a tool built around weekly volume, which forces a volume target and runs it through a clamp I don't want. A proposal also overwrites the live session the moment Claude makes it, before I've agreed to anything, and I have no way to reject it. There are no tools to move, skip, add or remove a session, or to read a single week. And "Claude should never apply changes on its own" is only a request in a tool description, not something the system enforces.

## Solution

Claude proposes changes and I approve them in the app. A proposal is a stored set of operations (change, move, add or remove a session) with a rationale. It never touches the live plan until I approve it. The MCP has no way to apply or reject anything, so "never on its own" is guaranteed by the design rather than by wording. In the app a banner shows pending proposals, and a proposal screen shows before/after for each operation with Approve all and Reject. The weekly-volume clamp is removed entirely. Dragging a session in the app stays instant.

## User Stories

1. As a runner, I want to ask Claude "what's my week look like", so that it can read my upcoming sessions without dumping the whole plan history.
2. As a runner, I want Claude to read sessions for any date range, so that it can look at this week, next week or a block.
3. As a runner, I want every session Claude reads to carry its id, status and revision, so that proposals target exactly the session I mean.
4. As a runner, I want Claude to still see my recent training and the engine's verdict, so that its proposals are grounded in real numbers.
5. As a runner, I want to say "make Thursday 8km instead of 10km" and get a proposal, so that a small edit takes one step.
6. As a runner, I want a change to merge into the existing prescription, so that changing the distance doesn't wipe my paces.
7. As a runner, I want Claude to be able to change a session's type, phase, prescription, cap and notes, so that most edits are possible.
8. As a runner, I want Claude unable to change a session's completed or skipped status, so that my record of what I actually did stays mine.
9. As a runner, I want to say "move my long run to Sunday" and get a move proposal, so that rescheduling is easy.
10. As a runner, I want a move to be able to go to any date, including another week, so that a missed week can be re-planned.
11. As a runner, I want a cross-week move to show the volume change on both weeks, so that I can see what it does to each.
12. As a runner, I want to ask Claude to add a session, so that I can fit in an extra run.
13. As a runner, I want to ask Claude to remove a session, so that I can drop one when I'm ill or busy.
14. As a runner, I want skipping a session to be a remove proposal, so that skipped stays reserved for what I actually did.
15. As a runner, I want to ask Claude to rework a whole week, so that one conversation produces one coherent change.
16. As a runner, I want a reworked week to be one proposal with one approval, so that I'm not tapping approve seven times.
17. As a runner, I want every proposal to include a rationale, so that I know why Claude suggests it.
18. As a runner, I want each proposal to show weekly volume before and after for every affected week, so that I can judge the load.
19. As a runner, I want the proposal to include the engine's verdict at the time, so that I can see whether it agrees with the change.
20. As a runner, I want no clamp to limit or alter what Claude proposes, so that my plan is mine to decide.
21. As a runner, I want a proposal to leave my live plan untouched, so that nothing changes until I say so.
22. As a runner, I want Claude to have no tool that applies or rejects a proposal, so that it can't act without me.
23. As a runner, I want a banner with a count of pending proposals on Today and Plan, so that I notice them.
24. As a runner, I want to open a proposal on a screen of before/after rows, so that I can see exactly what changes.
25. As a runner, I want Approve all and Reject buttons, so that I can decide in one tap.
26. As a runner, I want approving to apply every operation together, so that a week is never half-changed.
27. As a runner, I want each applied operation to leave an audit row, so that the plan's history stays complete.
28. As a runner, I want a rejected proposal to leave my plan unchanged, so that rejecting is safe.
29. As a runner, I want Claude's reply to include a link to the proposal, so that I can reach it from the chat on mobile.
30. As a runner, I want a newer proposal on the same session to supersede the older one, so that I never approve something out of date.
31. As a runner, I want a proposal to expire once its earliest session date has passed, so that stale suggestions don't linger.
32. As a runner, I want expired and superseded proposals to stay visible with their state, so that the trail is understandable.
33. As a runner, I want approval refused if I changed a target session after it was proposed, so that I never overwrite my own edit.
34. As a runner, I want a refused proposal marked "plan changed since this was proposed", so that I know to ask Claude again.
35. As a runner, I want approval to never half-apply, so that a failure can't leave the plan inconsistent.
36. As a runner, I want a proposal that targets a session that no longer exists to be refused clearly, so that I'm not given a broken change.
37. As a runner, I want a proposal whose operations conflict with each other to be refused, so that it can't produce two sessions on one date.
38. As a runner, I want dragging a session in the app to stay instant, so that my own edits have no approval step.
39. As a runner, I want the old "revision pending approval" session state gone, so that there's one place to look for pending changes.
40. As a runner, I want the old propose, apply and plan-dump tools gone, so that Claude only has the safe, focused ones.

## Implementation Decisions

- **Proposals are a new stored entity.** Each has a rationale, an ordered list of operations, the engine verdict at proposal time, a status and timestamps. Statuses: `pending`, `applied`, `rejected`, `expired`, `superseded`. A migration adds it.
- **Operations** are one of: update a session (patch), move a session to a date, add a session, remove a session. Sessions are addressed by id, never by date. Each update, move or remove operation records the target session's `revision` as seen at proposal time.
- **Patchable fields:** type, phase, prescription (shallow-merged into the existing one), cap, and notes. Status is never patchable. Skipping is a remove operation.
- **Live sessions are never written by a proposal.** The `pending` value of the session status is retired; sessions are `planned`, `completed` or `skipped`.
- **Approval** applies all operations as one unit via the existing writers, bumping each session's revision and writing a normal revision audit row per applied operation. Before applying, every target's current revision must equal the recorded one; otherwise nothing is applied and the proposal is marked `superseded` with the message "plan changed since this was proposed".
- **Moves** may target any date, including another week, and may swap with an occupied date. The existing same-week move and swap logic and its sentinel-date safety are reused and extended so a cross-week move is allowed for proposals. Dragging in the app keeps its same-week rule and its immediate write.
- **Superseding:** creating a proposal marks any pending proposal that touches the same session as superseded, so at most one proposal is pending per session.
- **Expiry:** a proposal is expired once the earliest session date it touches is in the past. It's computed when read or listed, and the proposal is kept.
- **Volume:** weekly volume is computed from the sessions as they would be after the proposal, for each affected week, and attached to the proposal with the before figure. Claude does not supply it.
- **Clamp removed:** the weekly-increase clamp, its tests and its export are deleted. Nothing limits or warns on volume. The engine's evaluation is untouched and still attached to proposals as context.
- **MCP surface:**
  - Read: the training-window tool is kept as is. A new sessions-in-range read returns id, date, phase, type, prescription, cap, status, revision and any pending proposal touching each session. It replaces the current-plan and plan-history reads.
  - Propose: change-session, move, add-session, remove-session and a week tool taking many operations as one proposal. Each takes a rationale and returns the proposal id, a link to it, the volume before and after, and the verdict.
  - There is deliberately no apply tool and no reject tool.
  - The old propose and apply revision tools are removed.
- **App:**
  - A banner with a pending count on Today and Plan.
  - A proposal screen with before/after rows per operation, and Approve all and Reject.
  - Endpoints to list, read, approve and reject proposals.
  - Reject leaves the plan unchanged.
- **Planner module:** all decision logic lives in one pure module with no I/O. It takes current sessions plus a proposal's operations and returns either the ordered writes, the resulting sessions and per-week volumes, or a refusal (stale, missing target, conflicting operations). It also owns patch merging, the status-patch refusal, expiry and supersede selection. The endpoints, MCP handlers and screens are thin wrappers.
- **Work happens on a new branch from main**, `mcp-plan-proposals`.

## Testing Decisions

- A good test exercises external behavior only: given these sessions and this proposal, what is applied, refused or reported. It never asserts on internal structure or call order.
- **One seam:** the pure planner module. Tests cover:
  - applying each operation type
  - patch merge keeps unpatched prescription fields
  - a status patch is refused
  - cross-week moves, swaps and the volume for each affected week
  - a multi-operation week applying together
  - stale revision refusal
  - a missing target refused
  - conflicting operations refused, including two sessions landing on one date
  - supersede selection
  - expiry by earliest session date
- The MCP handlers, endpoints and Vue screens are thin wrappers with no tests of their own. This is a deliberate trade-off: there's no database test harness in the repo and building one is out of scope.
- Prior art: the existing move planner tests, which test a pure planner with no database, and the other pure session-logic tests in the same folder.
- The clamp's tests are deleted along with the clamp.

## Out of Scope

- Any advisory or warning behavior on weekly volume.
- Claude changing a session's completed or skipped status.
- Per-operation approval; approval is all or nothing for a proposal.
- An apply or reject tool in the MCP, and an "ask every time" permission setup.
- Reviewing Garmin history; a separate MCP already does that.
- Changes to the engine's evaluation, the Today verdict, or the Garmin sync.
- A database test harness.
- Notifications or push alerts for new proposals.
- Changing how dragging a session works in the app.

## Further Notes

- The weekly cron and nothing else in the app calls the old propose path, so removing it should affect only the MCP.
- Because `plan_sessions.date` has no unique constraint, the planner must refuse any proposal that would put two sessions on one date.
- Old `pending` session rows may exist from before this change; the migration or app should treat them as `planned` so nothing is stuck.
