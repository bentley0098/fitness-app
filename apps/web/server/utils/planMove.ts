import { mondayOf } from "./planMeta";

// Pure planning for "drag this session onto that day". No I/O — the endpoint
// executes whatever `steps` comes back with, which is what makes the awkward
// part (see SENTINEL_DATE below) testable without a database.

export interface MovableSession {
  id: string;
  date: string;
}

/**
 * A parking date used to keep a swap from ever producing two sessions on one
 * calendar date.
 *
 * `db` is a supabase-js client, so there is no transaction here. The obvious
 * two-step swap — A takes B's date, then B takes A's — leaves a duplicate if
 * the process dies between the writes, and a duplicate is the one state this
 * codebase genuinely cannot cope with:
 *
 *   - buildWeek() joins with `.find()`, so the second row is invisible: one
 *     session simply vanishes from the week.
 *   - proposeRevision() looks sessions up with `.eq("date", …).maybeSingle()`,
 *     which throws on two or more rows — poisoning that date for the MCP tool
 *     and the weekly cron from then on.
 *   - plan_sessions.date carries no unique constraint, so nothing stops it.
 *
 * Parking A out of the way first means an interrupted swap leaves a session
 * *missing* (it shows as a rest day, and the sentinel date is trivial to grep
 * for) rather than duplicated. A recoverable glitch instead of a broken
 * invariant.
 */
export const SENTINEL_DATE = "9999-12-31";

export interface MoveStep {
  id: string;
  date: string;
  /** False for the parking write, which is bookkeeping rather than a result. */
  final: boolean;
}

export interface MoveOutcome {
  id: string;
  from: string;
  to: string;
}

export interface MovePlan {
  ok: boolean;
  /** Set when the move is refused; `steps` is empty. */
  error?: string;
  /** Dropped on the day it already occupies — nothing to write, not an error. */
  noop: boolean;
  steps: MoveStep[];
  moved: MoveOutcome | null;
  /** The session displaced by the move, if the target day was occupied. */
  swapped: MoveOutcome | null;
}

function refuse(error: string): MovePlan {
  return { ok: false, error, noop: false, steps: [], moved: null, swapped: null };
}

/**
 * Work out the writes that move `session` onto `toDate`.
 *
 * `occupant` is whatever already sits on `toDate` (null if the day is free).
 * Moves are confined to the session's own ISO week: that keeps every week's
 * planned volume exactly as it was, which is why this path doesn't need the
 * engine's weekly-volume clamp the way proposeRevision() does.
 */
export function planSessionMove(
  session: MovableSession,
  toDate: string,
  occupant: MovableSession | null,
): MovePlan {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return refuse(`Not a calendar date: ${toDate}`);

  if (mondayOf(session.date) !== mondayOf(toDate)) {
    return refuse("Sessions can only be moved within their own week.");
  }

  if (toDate === session.date) {
    return { ok: true, noop: true, steps: [], moved: null, swapped: null };
  }

  const moved: MoveOutcome = { id: session.id, from: session.date, to: toDate };

  // Dropping onto a day that's already taken swaps the two, so the week keeps
  // one session per day.
  if (occupant && occupant.id !== session.id) {
    return {
      ok: true,
      noop: false,
      steps: [
        { id: session.id, date: SENTINEL_DATE, final: false },
        { id: occupant.id, date: session.date, final: true },
        { id: session.id, date: toDate, final: true },
      ],
      moved,
      swapped: { id: occupant.id, from: occupant.date, to: session.date },
    };
  }

  return {
    ok: true,
    noop: false,
    steps: [{ id: session.id, date: toDate, final: true }],
    moved,
    swapped: null,
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-09-23" -> "Wed 23 Sep". Parsed at UTC midnight like every other date
 * in this app, so a negative local offset can't shift the label back a day.
 */
export function formatMoveDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** What lands on the session card: where this session came from. */
export function movedFromLabel(from: string): string {
  return `Moved from ${formatMoveDate(from)}`;
}

/** What lands in the plan_revisions audit trail: the whole move. */
export function moveRationale(from: string, to: string): string {
  return `Moved from ${formatMoveDate(from)} to ${formatMoveDate(to)}`;
}
