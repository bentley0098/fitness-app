# 02: Several runs on one day match activities by closest distance

**What to build:** When a day has several planned runs, each Garmin run activity is assigned to at most one planned run by closest distance, and any activity left over counts as an unplanned run. No new UI beyond what already shows completion.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Two planned runs on one date each resolve against a distinct activity
- [ ] A leftover activity shows as unplanned
- [ ] A day with one planned run behaves exactly as before
- [ ] Completion tests cover the multi-run cases
