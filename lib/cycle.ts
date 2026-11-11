export type Phase = "menstrual" | "follicular" | "ovulation" | "luteal";

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

export function fmt(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtShort(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export interface Prediction {
  statedCycle: number;
  actualGaps: number[];
  actualAvg: number | null;
  effectiveCycle: number;
  spread: number; // +/- days shown as the likely range
  lastStart: Date;
  nextPeriod: Date;
  nextRangeStart: Date;
  nextRangeEnd: Date;
  ovulation: Date;
  fertileStart: Date;
  fertileEnd: Date;
  pmsStart: Date;
  pmsEnd: Date;
  cycleDay: number;
  phase: Phase;
  phaseLabel: string;
  daysUntilNext: number;
}

/** Blend real gaps with the stated cycle length.
 *  Real gaps weigh more (65%) because they are the person's own history;
 *  the stated length anchors the estimate when history is thin or noisy. */
export function predict(
  periodStarts: string[],
  statedCycle: number,
  periodLength: number,
  today: Date = new Date()
): Prediction | null {
  const sorted = [...periodStarts].sort();
  if (sorted.length === 0) return null;
  const lastStart = parseDate(sorted[sorted.length - 1]);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(diffDays(parseDate(sorted[i - 1]), parseDate(sorted[i])));
  }
  const actualAvg =
    gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
  const effectiveCycle =
    actualAvg === null ? statedCycle : Math.round(actualAvg * 0.65 + statedCycle * 0.35);
  const spread =
    gaps.length >= 2 ? (Math.max(...gaps) - Math.min(...gaps) <= 1 ? 1 : 2) : gaps.length === 1 ? 1 : 2;

  const nextPeriod = addDays(lastStart, effectiveCycle);
  const ovulation = addDays(nextPeriod, -14);
  const fertileStart = addDays(ovulation, -5);
  const fertileEnd = addDays(ovulation, 1);
  const pmsStart = addDays(nextPeriod, -7);
  const pmsEnd = addDays(nextPeriod, -1);

  // Current cycle day: count forward from the most recent start on/before today.
  let cycleDay = diffDays(lastStart, today) + 1;
  // If the last logged start is in the future, treat today as day 1 of a new cycle.
  if (cycleDay < 1) cycleDay = 1;
  // If today is past the predicted period, keep counting (late) rather than wrapping silently.
  let phase: Phase;
  let phaseLabel: string;
  if (cycleDay <= periodLength) {
    phase = "menstrual";
    phaseLabel = "Menstrual";
  } else if (cycleDay <= effectiveCycle - 15) {
    phase = "follicular";
    phaseLabel = "Follicular";
  } else if (cycleDay <= effectiveCycle - 12) {
    phase = "ovulation";
    phaseLabel = "Ovulation window";
  } else if (cycleDay <= effectiveCycle - 7) {
    phase = "luteal";
    phaseLabel = "Luteal";
  } else {
    phase = "luteal";
    phaseLabel = "Late luteal / PMS";
  }

  return {
    statedCycle,
    actualGaps: gaps,
    actualAvg,
    effectiveCycle,
    spread,
    lastStart,
    nextPeriod,
    nextRangeStart: addDays(nextPeriod, -spread),
    nextRangeEnd: addDays(nextPeriod, spread),
    ovulation,
    fertileStart,
    fertileEnd,
    pmsStart,
    pmsEnd,
    cycleDay,
    phase,
    phaseLabel,
    daysUntilNext: diffDays(today, nextPeriod),
  };
}
