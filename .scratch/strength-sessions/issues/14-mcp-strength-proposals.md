# 14: MCP strength proposals

**What to build:** Claude can propose adding an exercise, creating or updating a template, and scheduling a strength session from a template on a date, as single tools and as operations inside the existing whole-week proposal, so one proposal can add exercises, create a template and schedule it. Move, remove and update proposals work on strength sessions. Everything goes through the existing proposal flow: stored, previewed without distance for strength rows, superseded or expired as usual, and applied only when approved in the app. Claude does not propose load or weight changes.

**Blocked by:** 03, 10

**Status:** ready-for-agent

- [ ] Each new operation can be proposed alone and inside a whole-week proposal
- [ ] The proposal screen shows strength rows without a distance
- [ ] Approving applies all operations together or none; a stale or conflicting proposal is refused as for runs
- [ ] Nothing changes the plan until approved in the app
- [ ] Planner tests cover the new operations, atomic apply and refusals
