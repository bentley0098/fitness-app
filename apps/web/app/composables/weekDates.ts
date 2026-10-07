// The seven ISO dates Monday..Sunday starting at `mondayIso`. Done on the
// client so a week's numbers are on screen before its data has loaded.
export function weekDatesFrom(mondayIso: string): string[] {
  const start = new Date(`${mondayIso}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
