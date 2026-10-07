# 14: MCP strength proposals

**What to build:** Claude can propose adding an exercise, creating or updating a template, and scheduling a strength session from a template on a date, as single tools and as operations inside the existing whole-week proposal, so one proposal can add exercises, create a template and schedule it. Move, remove and update proposals work on strength sessions. Everything goes through the existing proposal flow: stored, previewed without distance for strength rows, superseded or expired as usual, and applied only when approved in the app. Claude does not propose load or weight changes.

**Blocked by:** 03, 10

**Status:** done

- [x] Each new operation can be proposed alone and inside a whole-week proposal
- [x] The proposal screen shows strength rows without a distance
- [x] Approving applies all operations together or none; a stale or conflicting proposal is refused as for runs
- [x] Nothing changes the plan until approved in the app
- [x] Planner tests cover the new operations, atomic apply and refusals

Note: the executor (library writes with undo, then session writes) is type-checked and built but has not been exercised against a database; the planner rules it relies on are covered by tests.
