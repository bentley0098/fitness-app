# 05: Gym logger core

**What to build:** From the Strength tab, start an ad-hoc strength session from any template. The logger shows each exercise's set rows pre-filled with reps and weight from the most recent logged set of that exercise (set by set, falling back to its last set, blank when there is no history), with last time's numbers shown beside each row. One tap logs a set as-is, or the runner edits reps and weight first. Sets are saved as they are logged, so leaving the app and returning resumes the unfinished session. Finish ends it. In-gym changes never alter the template. Weight is kg.

**Blocked by:** 03

**Status:** done

- [x] Starting from a template creates a strength log with set rows for every slot
- [x] Rows are pre-filled from the previous finished sessions per the prefill rule, and previous numbers are visible
- [x] An exercise with no history has blank weight
- [x] Logging or editing a set saves it immediately
- [x] Closing and reopening the app resumes the unfinished session
- [x] Finish marks the log finished; the template is unchanged
- [x] Strength module tests cover the prefill rule across measures and per-side exercises

Note: migration 0012 is generated but not applied. No test database exists, so the endpoints were built and type-checked but not exercised against live data; the prefill rule itself is covered by tests.
