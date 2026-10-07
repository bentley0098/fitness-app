# 06: Logger flexibility

**What to build:** During a session the runner can add or remove sets, swap an exercise for another, add an exercise that is not in the template, and create an exercise by typing a new name, which uses an existing exercise when the name matches instead of creating a duplicate.

**Blocked by:** 05

**Status:** done

- [x] Add set and remove set work on any exercise mid-session
- [x] Swapping an exercise keeps the slot's targets and pre-fills from the new exercise's history
- [x] Adding an exercise not in the template works
- [x] A typed name matching an existing exercise reuses it; otherwise a new exercise is created
- [x] Strength module tests cover add, remove and swap rules
