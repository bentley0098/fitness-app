# 12: Schedule the seed and protect it from the plan import

**What to build:** The strength seed also schedules planned strength sessions from the day it is run through the Sunday before race week: Gym A on Mondays, Gym B on Fridays, Physio: ankle on Mondays and Wednesdays, and Physio: hips and core on Sundays, each taking the phase of that week's existing run sessions. It replaces only the seeded planned strength sessions. The plan import's wholesale delete is limited to the run sessions it creates, so re-importing the plan never deletes strength sessions.

**Blocked by:** 03, 10

**Status:** done

- [x] Running the seed puts the scheduled sessions on the right weekdays through the week before race week
- [x] Re-running the seed neither duplicates nor touches other sessions
- [x] Running the plan import leaves planned strength sessions in place
- [x] Seeded sessions carry the week's phase and no run rows are modified

Note: the scheduling half of `npm run strength:seed` has not been run against your database (it needs migrations 0011 and 0012 applied first).
