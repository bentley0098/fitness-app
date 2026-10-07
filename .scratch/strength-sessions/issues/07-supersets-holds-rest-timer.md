# 07: Supersets, holds and rest timer

**What to build:** The logger interleaves the sets of a superset group (A set 1, B set 1, A set 2, …). Timed-hold exercises log seconds. Per-side exercises log one number that applies to each side. A rest timer starts after a logged set using the exercise's rest time (90 second default), with one timer after each superset round rather than after each exercise. Exercise notes such as cues are shown in the logger.

**Blocked by:** 05

**Status:** done

- [x] A superset's rows appear in interleaved order and the timer runs after each round
- [x] A hold exercise logs seconds and a per-side exercise is labelled as per side
- [x] Rest time comes from the exercise, defaulting to 90 seconds
- [x] Exercise notes are visible while logging
- [x] Strength module tests cover superset interleaving order and rest placement
