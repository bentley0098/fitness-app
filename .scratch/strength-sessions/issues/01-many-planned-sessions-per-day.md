# 01: Many planned sessions per day

**What to build:** A date can hold any number of planned sessions of any kind. Dragging a session onto an occupied day relocates it and leaves both on that day; the swap behaviour is retired (see ADR-0002). Adding a session no longer needs an empty day, and a day with no sessions at all is the only rest day. This is the prefactor that strength scheduling relies on.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Moving a planned session to a day that already has one leaves both there, with no swap
- [x] A proposal to add a session on an occupied day is accepted, and a proposal's conflicting-operation checks no longer treat two sessions on one date as a conflict
- [x] The week view lists every session on a day and shows a rest day only when the day has none
- [x] Weekly run volume and existing run completion behave as before
- [x] Planner tests cover move-without-swap and adding to an occupied day
