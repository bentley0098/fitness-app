import { mondayOf } from "./planMeta";
import { isStrengthType, targetDistanceM, type Prescription } from "./planLabels";
import { exerciseKey, validateSlots, type Kind, type Measure, type TemplateSlot } from "./strength";

// Pure planning for proposals: what applying a set of operations would do to
// the plan. No I/O — the endpoints and MCP handlers load sessions, call this,
// and execute whatever comes back. That's what makes the awkward parts (stale
// revisions, merges, volume) testable without a database.

export interface PlannerSession {
  id: string;
  date: string;
  phase: string;
  type: string;
  prescription: Prescription;
  cap: Record<string, unknown>;
  status: string;
  revision: number;
}

export interface SessionPatch {
  type?: string;
  phase?: string;
  /** Shallow-merged into the existing prescription. */
  prescription?: Prescription;
  cap?: Record<string, unknown>;
  /** Stored as prescription.note, the key the plan already uses for notes. */
  notes?: string;
}

/** What Claude asks for, before the session state it saw is recorded. */
export interface NewSession {
  date: string;
  phase: string;
  type: string;
  prescription: Prescription;
  cap?: Record<string, unknown>;
}

export type AddRequest = { kind: "add" } & NewSession;
export type TargetedRequest =
  | { kind: "update"; sessionId: string; patch: SessionPatch }
  | { kind: "move"; sessionId: string; toDate: string }
  | { kind: "remove"; sessionId: string };

/** A template slot as asked for: the exercise by name, which may be one this same proposal adds. */
export interface SlotRequest {
  exercise: string;
  sets: number;
  repsMin?: number | null;
  repsMax?: number | null;
  holdSeconds?: number | null;
  restSeconds?: number | null;
  supersetGroup?: number | null;
  note?: string | null;
}

export interface NormalSlot {
  exercise: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  holdSeconds: number | null;
  restSeconds: number | null;
  supersetGroup: number | null;
  note: string | null;
}

/** Changes to the exercise library and templates, which strength sessions are built from. */
export type LibraryRequest =
  | { kind: "addExercise"; name: string; measure: Measure; perSide?: boolean; note?: string | null; restSeconds?: number | null }
  | { kind: "createTemplate"; name: string; templateKind: Kind; slots: SlotRequest[] }
  | { kind: "updateTemplate"; templateId: string; name?: string; slots?: SlotRequest[] };
export type OperationRequest = AddRequest | TargetedRequest | LibraryRequest;

/** What exists in the library when a proposal is made or applied. */
export interface PlanLibrary {
  exercises: { name: string; measure: Measure }[];
  templates: { id: string; name: string; kind: Kind; updatedAt: string; exerciseCount: number }[];
}

export const EMPTY_LIBRARY: PlanLibrary = { exercises: [], templates: [] };

/**
 * A stored operation: the request plus the session state it was made against.
 * `sessionDate` is the earliest date it touches on the session's side — it is
 * what expiry reads. Adds have no existing session, so no revision to check.
 */
export type Operation =
  | (TargetedRequest & {
      expectedRevision: number;
      sessionDate: string;
    })
  | (AddRequest & { sessionDate: string })
  | Extract<LibraryRequest, { kind: "addExercise" | "createTemplate" }>
  // The template's updated_at when proposed, so a template edited since is refused.
  | (Extract<LibraryRequest, { kind: "updateTemplate" }> & { expectedUpdatedAt: string });

/** Operations that act on an existing planned session. */
export type SessionOperation = Extract<Operation, { sessionId: string }>;

export function isSessionOperation(op: Operation): op is SessionOperation {
  return op.kind === "update" || op.kind === "move" || op.kind === "remove";
}

export interface WeekVolume {
  weekStart: string;
  beforeM: number;
  afterM: number;
}

export type PlanFailure = { ok: false; reason: "invalid" | "missing" | "stale" | "conflict"; message: string };

export type SnapshotResult = { ok: true; operations: Operation[] } | PlanFailure;

/**
 * A row change for the executor, run in order. `final` updates carry the
 * session's new state, with `revision` already the new value.
 */
export type SessionWrite =
  | {
      kind: "update";
      id: string;
      final: boolean;
      fields: Partial<Pick<PlannerSession, "type" | "phase" | "prescription" | "cap" | "revision" | "date">>;
    }
  | { kind: "insert"; fields: Pick<PlannerSession, "type" | "phase" | "prescription" | "cap" | "revision" | "date"> }
  | { kind: "delete"; id: string };

/** A change to the library, run before any session write. */
export type LibraryWrite =
  | { kind: "addExercise"; name: string; measure: Measure; perSide: boolean; note: string | null; restSeconds: number | null }
  | { kind: "createTemplate"; name: string; templateKind: Kind; slots: NormalSlot[] }
  | { kind: "updateTemplate"; id: string; name: string | undefined; slots: NormalSlot[] | undefined };

export type ApplyPlan =
  | { ok: true; after: PlannerSession[]; writes: SessionWrite[]; libraryWrites: LibraryWrite[]; volume: WeekVolume[] }
  | PlanFailure;

const PATCHABLE = new Set(["type", "phase", "prescription", "cap", "notes"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(reason: PlanFailure["reason"], message: string): PlanFailure {
  return { ok: false, reason, message };
}

/** Records the revision and date each target had when the proposal was made. */
export function snapshotOperations(
  sessions: PlannerSession[],
  requests: OperationRequest[],
  library: PlanLibrary = EMPTY_LIBRARY,
): SnapshotResult {
  const operations: Operation[] = [];
  for (const request of requests) {
    if (request.kind === "add") {
      operations.push({ ...request, sessionDate: request.date });
      continue;
    }
    if (request.kind === "addExercise" || request.kind === "createTemplate") {
      operations.push(request);
      continue;
    }
    if (request.kind === "updateTemplate") {
      const template = library.templates.find((t) => t.id === request.templateId);
      if (!template) return fail("missing", `No template with id ${request.templateId}.`);
      operations.push({ ...request, expectedUpdatedAt: template.updatedAt });
      continue;
    }
    const target = sessions.find((s) => s.id === request.sessionId);
    if (!target) return fail("missing", `No session with id ${request.sessionId}.`);
    operations.push({ ...request, expectedRevision: target.revision, sessionDate: target.date });
  }
  return { ok: true, operations };
}

function applyPatch(session: PlannerSession, patch: SessionPatch): PlannerSession | PlanFailure {
  const illegal = Object.keys(patch).filter((k) => !PATCHABLE.has(k));
  if (illegal.length > 0) return fail("invalid", `Cannot change: ${illegal.join(", ")}.`);

  const prescription = { ...session.prescription, ...(patch.prescription ?? {}) };
  if (patch.notes !== undefined) prescription.note = patch.notes;

  return {
    ...session,
    type: patch.type ?? session.type,
    phase: patch.phase ?? session.phase,
    cap: patch.cap ?? session.cap,
    prescription,
  };
}

function plannedM(sessions: PlannerSession[], weekStart: string): number {
  return sessions
    .filter((s) => mondayOf(s.date) === weekStart)
    .reduce((sum, s) => sum + (targetDistanceM(s.prescription) ?? 0), 0);
}

/** The sessions the operations would leave behind, or why they can't apply. */
export function planApply(sessions: PlannerSession[], operations: Operation[], library: PlanLibrary = EMPTY_LIBRARY): ApplyPlan {
  const applied = applyLibraryOperations(operations, library);
  if (!applied.ok) return applied;

  let working = sessions;
  let addedCount = 0;
  for (const op of operations) {
    if (!isSessionOperation(op) && op.kind !== "add") continue; // library operations were handled above

    if (op.kind === "add") {
      if (!ISO_DATE.test(op.date)) return fail("invalid", `Not a calendar date: ${op.date}`);
      let prescription = op.prescription;
      if (isStrengthType(op.type)) {
        const checked = checkStrengthPrescription(op.type, op.prescription, applied.templates);
        if (!checked.ok) return checked;
        prescription = checked.prescription;
      }
      working = [
        ...working,
        { id: `new-${addedCount++}`, date: op.date, phase: op.phase, type: op.type, prescription, cap: op.cap ?? {}, status: "planned", revision: 1 },
      ];
      continue;
    }

    // Staleness is judged against the plan as it is now, not as earlier
    // operations in this same proposal leave it.
    const original = sessions.find((s) => s.id === op.sessionId);
    if (!original) return fail("missing", `No session with id ${op.sessionId}.`);
    if (original.revision !== op.expectedRevision) return fail("stale", "Plan changed since this was proposed.");

    const target = working.find((s) => s.id === op.sessionId);
    if (!target) return fail("conflict", "An operation targets a session this proposal already removed.");

    if (op.kind === "remove") {
      working = working.filter((s) => s.id !== target.id);
    } else if (op.kind === "update") {
      const patched = applyPatch(target, op.patch);
      if ("ok" in patched) return patched;
      if (isStrengthType(target.type) || isStrengthType(patched.type)) {
        if (isStrengthType(target.type) !== isStrengthType(patched.type) || target.type !== patched.type) {
          return fail("invalid", "A session can't be turned into, or out of, a strength session. Remove it and add the one you want.");
        }
        const checked = checkStrengthPrescription(patched.type, patched.prescription, applied.templates);
        if (!checked.ok) return checked;
        patched.prescription = checked.prescription;
      }
      working = working.map((s) => (s.id === target.id ? patched : s));
    } else {
      if (!ISO_DATE.test(op.toDate)) return fail("invalid", `Not a calendar date: ${op.toDate}`);
      if (op.toDate === target.date) continue;

      working = working.map((s) => (s.id === target.id ? { ...s, date: op.toDate } : s));
    }
  }

  const before = new Map(sessions.map((s) => [s.id, s]));
  const unchanged = (s: PlannerSession) => {
    const was = before.get(s.id);
    return !!was && JSON.stringify({ ...s, revision: 0 }) === JSON.stringify({ ...was, revision: 0 });
  };
  const added = working.filter((s) => !before.has(s.id));
  const changed = working.filter((s) => before.has(s.id) && !unchanged(s));
  const removed = sessions.filter((s) => !working.some((w) => w.id === s.id));
  const after = working.map((s) => (changed.includes(s) ? { ...s, revision: s.revision + 1 } : s));

  // Deletes first, inserts last.
  const writes: SessionWrite[] = [];
  for (const s of removed) writes.push({ kind: "delete", id: s.id });
  for (const s of after.filter((a) => changed.some((c) => c.id === a.id))) {
    writes.push({
      kind: "update",
      id: s.id,
      final: true,
      fields: { type: s.type, phase: s.phase, prescription: s.prescription, cap: s.cap, revision: s.revision, date: s.date },
    });
  }
  for (const s of added) {
    writes.push({
      kind: "insert",
      fields: { date: s.date, phase: s.phase, type: s.type, prescription: s.prescription, cap: s.cap, revision: 1 },
    });
  }

  const touchedWeeks = new Set<string>();
  for (const s of [...changed, ...removed]) touchedWeeks.add(mondayOf(before.get(s.id)!.date));
  for (const s of [...changed, ...added]) touchedWeeks.add(mondayOf(s.date));
  const volume = [...touchedWeeks].sort().map((weekStart) => ({
    weekStart,
    beforeM: plannedM(sessions, weekStart),
    afterM: plannedM(after, weekStart),
  }));

  return { ok: true, after, writes, libraryWrites: applied.writes, volume };
}

function normaliseSlots(slots: SlotRequest[]): NormalSlot[] {
  return slots.map((s) => ({
    exercise: s.exercise.trim().replace(/\s+/g, " "),
    sets: s.sets,
    repsMin: s.repsMin ?? null,
    repsMax: s.repsMax ?? null,
    holdSeconds: s.holdSeconds ?? null,
    restSeconds: s.restSeconds ?? null,
    supersetGroup: s.supersetGroup ?? null,
    note: s.note ?? null,
  }));
}

/** The first problem with a template's slots against the exercises that exist, or the slots with names made canonical. */
function checkSlots(requested: SlotRequest[], exercises: PlanLibrary["exercises"]): NormalSlot[] | PlanFailure {
  const slots = normaliseSlots(requested);
  const byKey = new Map(exercises.map((e) => [exerciseKey(e.name), e]));

  for (const slot of slots) {
    const exercise = byKey.get(exerciseKey(slot.exercise));
    if (!exercise) {
      return fail("invalid", `There's no exercise called "${slot.exercise}". Add it first (addExercise), in this proposal or before.`);
    }
    slot.exercise = exercise.name;
  }

  const problem = validateSlots(
    slots.map((s, i): TemplateSlot => ({ id: String(i), exerciseId: exerciseKey(s.exercise), ...s })),
    exercises.map((e) => ({ id: exerciseKey(e.name), name: e.name, measure: e.measure })),
  );
  return problem ? fail("invalid", problem) : slots;
}

/**
 * Library operations run first, in order, against a working copy of the
 * library, so a template can use an exercise the same proposal adds and a
 * session can use a template the same proposal creates.
 */
function applyLibraryOperations(
  operations: Operation[],
  library: PlanLibrary,
): { ok: true; writes: LibraryWrite[]; templates: PlanLibrary["templates"] } | PlanFailure {
  const exercises = [...library.exercises];
  let templates = [...library.templates];
  const writes: LibraryWrite[] = [];
  const nameTaken = (list: { name: string }[], name: string, exceptId?: string, ids?: string[]) =>
    list.some((x, i) => exerciseKey(x.name) === exerciseKey(name) && (exceptId === undefined || ids?.[i] !== exceptId));

  for (const op of operations) {
    if (op.kind === "addExercise") {
      const name = op.name?.trim().replace(/\s+/g, " ");
      if (!name) return fail("invalid", "An exercise needs a name.");
      if (op.measure !== "reps" && op.measure !== "hold") return fail("invalid", `${name}: measure must be "reps" or "hold".`);
      if (nameTaken(exercises, name)) return fail("conflict", `There is already an exercise called "${name}".`);
      exercises.push({ name, measure: op.measure });
      writes.push({ kind: "addExercise", name, measure: op.measure, perSide: op.perSide ?? false, note: op.note ?? null, restSeconds: op.restSeconds ?? null });
    } else if (op.kind === "createTemplate") {
      const name = op.name?.trim().replace(/\s+/g, " ");
      if (!name) return fail("invalid", "A template needs a name.");
      if (op.templateKind !== "gym" && op.templateKind !== "physio") return fail("invalid", `${name}: kind must be "gym" or "physio".`);
      if (nameTaken(templates, name)) return fail("conflict", `There is already a template called "${name}".`);
      const slots = checkSlots(op.slots ?? [], exercises);
      if (!Array.isArray(slots)) return slots;
      if (slots.length === 0) return fail("invalid", `${name} needs at least one exercise.`);
      templates.push({ id: `new:${name}`, name, kind: op.templateKind, updatedAt: "", exerciseCount: slots.length });
      writes.push({ kind: "createTemplate", name, templateKind: op.templateKind, slots });
    } else if (op.kind === "updateTemplate") {
      const current = library.templates.find((t) => t.id === op.templateId);
      if (!current) return fail("missing", `No template with id ${op.templateId}.`);
      if (current.updatedAt !== op.expectedUpdatedAt) return fail("stale", "Plan changed since this was proposed.");

      const name = op.name === undefined ? undefined : op.name.trim().replace(/\s+/g, " ");
      if (name !== undefined) {
        if (!name) return fail("invalid", "A template needs a name.");
        const others = templates.filter((t) => t.id !== current.id);
        if (nameTaken(others, name)) return fail("conflict", `There is already a template called "${name}".`);
      }
      let slots: NormalSlot[] | undefined;
      if (op.slots !== undefined) {
        const checked = checkSlots(op.slots, exercises);
        if (!Array.isArray(checked)) return checked;
        if (checked.length === 0) return fail("invalid", `${name ?? current.name} needs at least one exercise.`);
        slots = checked;
      }
      templates = templates.map((t) => (t.id === current.id ? { ...t, name: name ?? t.name, exerciseCount: slots?.length ?? t.exerciseCount } : t));
      writes.push({ kind: "updateTemplate", id: current.id, name, slots });
    }
  }
  return { ok: true, writes, templates };
}

/** A strength session must name a template that exists (possibly one created in this proposal) of the matching kind. */
function checkStrengthPrescription(
  type: string,
  prescription: Prescription,
  templates: PlanLibrary["templates"],
): { ok: true; prescription: Prescription } | PlanFailure {
  const name = prescription.templateName;
  if (typeof name !== "string" || !name.trim()) return fail("invalid", "A strength session needs prescription.templateName.");
  const template = templates.find((t) => exerciseKey(t.name) === exerciseKey(name));
  if (!template) return fail("invalid", `There's no template called "${name}". Create it first (createTemplate), in this proposal or before.`);
  const kind: Kind = type === "strength_gym" ? "gym" : "physio";
  if (template.kind !== kind) return fail("invalid", `"${template.name}" is a ${template.kind} template, so the session type must be strength_${template.kind}.`);
  return { ok: true, prescription: { ...prescription, templateName: template.name } };
}

function touchedDates(op: Operation): string[] {
  if (op.kind === "move") return [op.sessionDate, op.toDate];
  if (op.kind === "addExercise" || op.kind === "createTemplate" || op.kind === "updateTemplate") return [];
  return [op.sessionDate];
}

/**
 * A proposal goes stale once the earliest date it touches has passed. Derived
 * at read time and never stored, so a proposal that is still being looked at
 * can't flip underneath the page.
 */
export function isExpired(operations: Operation[], today: string): boolean {
  const earliest = operations.flatMap(touchedDates).sort()[0];
  return earliest !== undefined && earliest < today;
}

/**
 * What an operation competes for. A newer proposal replaces an older pending one
 * that wants the same thing: the same session, the same library entry, or on the
 * same day the same session (same kind, and the same template for strength).
 */
function supersedeKey(op: Operation): string {
  switch (op.kind) {
    case "add":
      return `add|${op.date}|${op.type}|${op.prescription?.templateId ?? op.prescription?.templateName ?? ""}`;
    case "addExercise":
      return `exercise|${exerciseKey(op.name)}`;
    case "createTemplate":
      return `template|${exerciseKey(op.name)}`;
    case "updateTemplate":
      return `template-id|${op.templateId}`;
    default:
      return `session|${op.sessionId}`;
  }
}

/**
 * Pending proposals a new one replaces. Keeps at most one pending proposal per
 * session, template or exercise.
 */
export function selectSuperseded(pending: { id: string; operations: Operation[] }[], incoming: Operation[]): string[] {
  const keys = new Set(incoming.map(supersedeKey));
  return pending.filter((p) => p.operations.some((op) => keys.has(supersedeKey(op)))).map((p) => p.id);
}
