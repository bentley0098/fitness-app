# Strength sessions

Status: ready-for-agent

## Problem Statement

My training plan only knows about runs. I also do two kinds of strength work: gym sessions with weights, and home physio/rehab routines, and neither is in the app. When I'm at the gym I have no record of what I lifted last time, so I guess my weights or dig through notes. I can't see my physio work next to my runs, so I can't tell whether I'm actually doing it. And Claude, which plans my runs through the MCP, can't schedule or reason about any of it.

## Solution

Strength sessions become a first-class part of the plan. A **strength session** has a **kind** (gym or physio) and is started from a **template**: an ordered list of **exercises** with sets and reps (or hold time), including **supersets**, but no target weight. A session can be planned on a date or started on the spot. In the gym I open the app, start the session (from Today, from the plan view, or from a new Strength tab), and log each **set** against rows pre-filled from last time, with the previous numbers visible and a rest timer running. My **strength log** is the record of what I did. Garmin only contributes duration and heart rate.

Planned strength sessions appear in the week view next to runs, have their own line in the weekly summary, and are completed when I finish them. History is available per session and per exercise, with a top-set weight chart. Claude can read my strength history and propose exercises, templates and scheduled strength sessions through the same approve-in-app proposal flow it already uses for runs. It can never log sets or mark anything completed. My real gym and physio routines are seeded and scheduled through to the week before race week.

## User Stories

1. As a runner, I want to start a strength session from a planned session on Today, so that I can begin logging in one tap at the gym.
2. As a runner, I want to start a strength session from a card in the plan/week view, so that I can reach the gym logger from wherever I'm looking at my week.
3. As a runner, I want a Strength tab in the bottom bar, so that I can reach templates, history and ad-hoc starts quickly.
4. As a runner, I want to start a session from any template with nothing scheduled, so that I can train when the plan doesn't say to.
5. As a runner, I want a session I start from a template to have a kind of gym or physio, so that I can tell them apart and filter them.
6. As a runner, I want each set row pre-filled with the reps and weight from the last time I did that exercise, so that I only edit what changed.
7. As a runner, I want to see last session's numbers beside each set while I'm logging, so that I know what I'm trying to beat.
8. As a runner, I want to log a set as-is with one tap, so that a normal set takes no typing.
9. As a runner, I want to edit reps and weight on a set before logging it, so that I can record what I actually lifted.
10. As a runner, I want the weight pre-filled from my last logged set rather than a target weight, so that progression happens when I decide to lift more.
11. As a runner, I want a blank weight for an exercise I've never logged, so that I'm not given a wrong number.
12. As a runner, I want to add a set to an exercise mid-session, so that I can do more than the template says.
13. As a runner, I want to remove a set mid-session, so that I can stop early on an exercise.
14. As a runner, I want to swap one exercise for another mid-session, so that I can use a different exercise when equipment is taken or I prefer the alternative.
15. As a runner, I want to add an exercise that isn't in the template mid-session, so that I can include extra work.
16. As a runner, I want to type a new exercise name in the gym and have it created if it doesn't exist, so that I never have to stop and set up a library first.
17. As a runner, I want a typed name that matches an existing exercise to use that exercise, so that I don't create duplicates and split my history.
18. As a runner, I want exercises measured in reps with an optional weight, or as a timed hold, so that bench press and a side plank are both logged naturally.
19. As a runner, I want a bodyweight exercise to have a blank weight, so that I'm not forced to enter one.
20. As a runner, I want to optionally add a weight to a bodyweight exercise, so that I can log "calf raise holding a dumbbell" once it gets easy.
21. As a runner, I want per-side exercises flagged, so that "12 per leg" is one number that applies to each side.
22. As a runner, I want a timed hold logged as seconds, so that planks and balance work are recorded.
23. As a runner, I want a rest timer after a set, so that I rest for the right time between sets.
24. As a runner, I want each exercise to carry its own rest time, with a 90 second default, so that heavy deadlifts get longer rest than calf raises.
25. As a runner, I want exercise notes such as "2–3 reps in reserve" shown in the logger, so that cues from my plan are in front of me.
26. As a runner, I want supersets in a template, so that my bench press and row are set up as one group.
27. As a runner, I want the logger to interleave the sets of a superset, so that I follow the order I train in.
28. As a runner, I want one rest timer after each round of a superset rather than after every exercise, so that the timing matches how I train.
29. As a runner, I want a template to show sets and a rep range such as 6–8, so that I see the target without a fixed number.
30. As a runner, I want a template to give a hold time per set for timed exercises, so that the target is clear.
31. As a runner, I want a Finish button that ends the session, so that it counts as done.
32. As a runner, I want sets saved as I log them, so that leaving the app mid-session doesn't lose them.
33. As a runner, I want to resume an unfinished session when I come back, so that a phone lock or app switch doesn't end my workout.
34. As a runner, I want in-gym changes to leave the template alone, so that one off-day doesn't rewrite my routine.
35. As a runner, I want to edit a template deliberately in the app, so that I can change my routine on purpose.
36. As a runner, I want to create a new template from scratch, so that I can add a routine of my own.
37. As a runner, I want to see a list of all my templates, so that I can pick one to start.
38. As a runner, I want a session history list showing date, template, kind and sets done, so that I can see what I've done.
39. As a runner, I want a per-exercise history screen showing my last few sessions' sets, so that I can see how I've been lifting.
40. As a runner, I want a chart of top-set weight over time for an exercise, so that I can see my progress.
41. As a runner, I want to edit the sets of a past session, so that I can fix a mistyped weight.
42. As a runner, I want to delete a past session, so that a mistake or a test doesn't pollute my history.
43. As a runner, I want to log a session for a past date, so that I can record one I forgot at the time.
44. As a runner, I want planned strength sessions shown on the week view alongside runs, so that I see my whole week.
45. As a runner, I want several sessions on one day, so that I can plan ankle physio before a run and a gym session on the same day.
46. As a runner, I want a day that has only strength sessions to still show as a training day with those sessions listed, so that it isn't labelled a rest day.
47. As a runner, I want to drag any session card to another day, so that I can reshuffle my week.
48. As a runner, I want a move to just relocate the session, so that dropping a session on a busy day adds to it rather than swapping.
49. As a runner, I want a strength session to be completed only when I finish it from the plan, so that completion reflects what I actually logged.
50. As a runner, I want a planned strength session I never finished to show as missed once its day is over, so that I can see what I skipped.
51. As a runner, I want a session I start from a different template than the planned one to count as unplanned, so that the plan's record stays honest.
52. As a runner, I want an ad-hoc session to count as an unplanned session on its day, so that I get credit for work I did.
53. As a runner, I want a strength session to count as done without wearing my watch, so that a forgotten watch doesn't erase the session.
54. As a runner, I want a matching Garmin activity on the same day to supply duration and heart rate, so that I see effort without double-entering it.
55. As a runner, I want a strength line in the weekly summary showing sessions done versus planned, so that I see how the week is going.
56. As a runner, I want the weekly kilometre figures to stay run-only, so that strength never distorts my running volume.
57. As a runner, I want the training engine's verdict to be unaffected by strength sessions, so that my run progression logic doesn't change.
58. As a runner, I want several runs on one day matched to Garmin activities by closest distance, so that a day with two planned runs still resolves.
59. As a runner, I want a leftover activity to count as an unplanned run, so that nothing I did is lost.
60. As a runner, I want my real Day A and Day B gym routines seeded as templates, so that I can use the app on day one.
61. As a runner, I want my physio routine seeded as two templates, an ankle half and a hips and core half, so that I can do each at the right time.
62. As a runner, I want the gym and physio sessions seeded on my weekly schedule through the week before race week, so that my plan already shows them.
63. As a runner, I want rerunning the seed to not duplicate anything, so that it's safe to run again.
64. As a runner, I want rerunning the plan import to leave strength sessions alone, so that updating my runs never wipes my strength plan.
65. As a runner, I want to ask Claude for my strength history, so that it can see what I've been lifting.
66. As a runner, I want Claude to list my exercises and templates, so that it can reference them accurately.
67. As a runner, I want Claude to see strength sessions among my planned sessions, so that it can plan around them.
68. As a runner, I want Claude to propose adding an exercise, so that new movements can be added through conversation.
69. As a runner, I want Claude to propose creating or changing a template, so that I can design a routine by chatting.
70. As a runner, I want Claude to propose scheduling a strength session from a template on a date, so that it can plan gym and physio alongside runs.
71. As a runner, I want a proposal to contain exercises, a template and scheduled sessions together, so that one conversation produces one approval.
72. As a runner, I want to approve or reject those strength proposals in the same proposal screen as run proposals, so that I have one place to decide.
73. As a runner, I want strength rows shown in a proposal's before/after preview without a distance, so that I can read them.
74. As a runner, I want Claude unable to log sets or mark a session completed, so that my log stays my own record.
75. As a runner, I want Claude not to propose load changes for my lifts, so that I decide my own progression in the gym.

## Implementation Decisions

- **Planned sessions become many-per-day.** A date can hold any number of planned sessions of any kind, including several runs. Anything that assumed one session per date (adding a session requires an empty day, a move onto an occupied day swaps, the week view shows one card or a rest day) is reworked. The swap is retired: a move relocates one session and leaves the target day holding both. Swapping two sessions is two moves. A day with no sessions at all is a rest day. A day with only strength sessions is not.
- **Planned strength sessions reuse the planned-session record.** A planned strength session carries its kind and a reference to a template instead of a run prescription. It still has a date, phase, status and revision, so move, remove and update proposals, revision audit rows and stale-proposal checks work for it unchanged. Phase is supplied the same way as for runs.
- **New entities.** Exercise (name, measure, per-side flag, note, rest time), template (name, kind, ordered slots), template slot (exercise, target sets, rep range or hold seconds, rest time, superset group), strength log (the session record: date, kind, template, optional link to a planned session, started/finished state, optional linked Garmin activity), and logged set (exercise, order, reps or hold seconds, optional weight in kg). A migration adds these.
- **Exercises.** Measure is either reps with an optional weight, or a timed hold. Per-side is a flag; a logged number applies to each side. Names are unique, matched case-insensitively with surrounding whitespace ignored. Creating an exercise by typing a new name must find an existing match first. Weight is stored in kg, one value per set; no unit toggle.
- **Templates hold sets and reps, never weight.** A slot targets a set count and either a rep range (min and max, equal when fixed) or a hold time. A superset is a group of two or more consecutive slots.
- **Prefill rule.** For each exercise, a new set row is pre-filled with reps and weight from the most recent logged set of that exercise across all finished sessions, set by set where the earlier session had that set, falling back to its last set. An exercise with no history is blank. The previous session's numbers are shown beside each row.
- **Logging.** Sets are saved as they are logged so an unfinished session survives leaving the app, and can be resumed. Finishing a session ends it. The logger supports adding, removing and swapping exercises and sets, interleaves superset sets, and runs a rest timer using the slot or exercise rest time with a 90 second default after a superset round. In-gym changes never alter the template.
- **Completion (read time, not stored).** A planned strength session is completed when a strength log linked to it is finished. A planned session with no finished linked log once its day is past is missed. A log started from a different template on that day, or with no plan link, is unplanned. A matching Garmin strength activity on the same date, if any, supplies duration and heart rate only; its absence never prevents completion. Run completion is unchanged, except that when a day has several planned runs, Garmin run activities are assigned to them one each by closest distance, and any left over are unplanned.
- **Editing the past.** A log's sets can be edited, a log can be deleted, and a log can be created for a past date. These are direct edits by the runner, not proposals.
- **Weekly summary.** Run kilometres and run session counts stay run-only. A separate strength line shows strength sessions finished versus planned for the week. Strength has no effect on the training engine, the engine's verdict, or weekly run volume.
- **Screens.** A Strength tab joins the bottom bar as a fifth tab, covering the template list, ad-hoc start, session history, per-exercise history with a top-set weight chart, and the in-gym logger. Today and the plan/week view show planned strength sessions with a Start action that opens the logger. Strength cards in the week view are draggable like run cards.
- **MCP reads.** New tools list exercises and templates and return strength history (sets by session for an exercise or a date range). The existing session read also returns strength sessions with their template and a summary of the log.
- **MCP proposals.** New proposal operations: add exercise, create template, update template, add strength session (template and date). They work as single-purpose tools and inside the existing whole-week proposal, so one proposal can add exercises, create a template and schedule it. Existing move, remove and update operations apply to strength sessions. All of it goes through the existing proposal, preview, expiry, supersede and approve-in-app flow. Proposal previews show strength rows without distance. The MCP cannot create or edit logged sets, mark sessions completed, or apply anything.
- **Seed data.** A strength seed script, idempotent for exercises and templates (matched by name) and replacing only the seeded planned strength sessions, creates:
  - **Gym A** (heavier legs, Mondays): conventional deadlift 3×5 (rest 2.5 min; cues: 2–3 reps in reserve, no grinding reps); Bulgarian split squat 3×8 per leg; bench press 3×6–8 superset with chest-supported row 3×8–10; seated dumbbell calf raise 3×12–15 (balls of feet on a plate, slow lowering).
  - **Gym B** (lighter legs, Fridays): goblet squat 3×6 (moderate load, nowhere near failure); single-leg RDL 3×8 per leg; incline dumbbell press 3×8–10 superset with one-arm dumbbell row 3×10 per arm; pull-ups 3×6–10 (band assistance or slow lowering reps if needed); single-leg standing calf raise 3×12 per leg.
  - **Physio: ankle** (Mondays and Wednesdays, before the run): single-leg pogos 3×20 per leg; single-leg circular hops 1×20 per leg each direction; penguin march 1×50; banded inversion 3×15; banded eversion 3×15; tibialis raises 3×15–20; single-leg calf raise (off a step) 3×12–15 per side (add a weight once 15 feels easy); single-leg balance 3×30 s per leg. Pogos and hops carry a note to stop and check with the physio if they cause pain along the outside of the lower leg.
  - **Physio: hips and core** (Sundays): single-leg glute bridge 3×12 per side (pause 2 s at the top); side-lying banded leg raise 3×15 per side; dead bug 3×10 per side; side plank 3×30 s per side; Copenhagen plank 3×20 s per side.
  - Planned sessions run from the day the seed is run through the Sunday before race week, using the week's existing phase. The seed does not touch run sessions.
- **Plan import.** The plan import's wholesale delete is limited to the run sessions it creates, so strength sessions survive a re-import.

## Testing Decisions

- A good test exercises external behaviour through the public function with plain data and asserts on the result, not on internal steps. The existing planner tests are the model: build sessions as plain objects, call the function, assert on the returned plan.
- **Seam 1: the proposal planner** (prior art: the existing planProposal tests). Extend it to cover the new strength operations, move-without-swap with several sessions on a day, adding to an occupied day, stale and conflicting-operation refusals for strength sessions, and weekly volume being unaffected by strength rows.
- **Seam 2: plan completion** (prior art: the existing planCompletion tests). Extend it to cover strength completion, missed and unplanned states, completion without a Garmin activity, and matching several planned runs on one day to activities by closest distance.
- **Seam 3: a new pure strength module.** It covers the prefill rule (set by set, fallback to last set, blank when no history, across measures and per-side), superset interleaving order and rest placement, exercise-name matching for creation, the per-exercise top-set series for the chart, session history summaries, and the rules for add, remove and swap of sets and exercises.
- Not tested: the MCP tool wiring, server routes, Vue components and the seed script. They stay thin over the seams above.

## Out of Scope

- Offline logging or sync.
- Strength sessions affecting the training engine, weekly run volume, or run progression.
- LLM-proposed load or weight changes for lifts, and any rule-based progression in the app.
- Personal records, estimated one-rep max and tonnage.
- A unit toggle for pounds, assisted-weight exercises with negative weight, or logging left and right sides separately.
- One-off strength sessions with an inline exercise list and no template.
- An optional "update template from this session" prompt.
- Reading exercise sets from Garmin strength activities.
- Seeding strength history, and scheduling physio on Thursdays.

## Further Notes

- The plan import script's header comment already lists "easy run + gym" for Monday and Friday, with Tuesday as swim and Thursday as full rest. This spec realises that pattern, with Gym A on Monday and Gym B on Friday.
- Monday heavy legs share a day with the Monday easy run, and from week 16 with the quality run. This is a deliberate choice by the runner and can be adjusted by dragging sessions or via proposals.
- Single-leg calf raise appears in both Gym B and the ankle physio routine. Seed it as one shared exercise so its history is continuous, and note that the weight is optional.
- ADR 0001 (strength sets are entered by hand) records the departure from the spec's "no manual entry" principle for strength only. ADR 0002 has been offered but not yet written: a date holds many planned sessions and a move no longer swaps.
- Domain terms are in `CONTEXT.md` (strength session, kind, gym, physio, template, exercise, measure, set, superset, strength log).
