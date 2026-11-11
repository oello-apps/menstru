"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Droplets, Flower2, Heart, Info, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { diffDays, fmt, fmtShort, parseDate, predict, toISO } from "@/lib/cycle";

const STORAGE_KEY = "menstrual-tracker-v1";

interface Saved {
  starts: string[];
  cycleLength: number;
  periodLength: number;
}

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function dayKind(date: Date, starts: string[], pred: ReturnType<typeof predict>, periodLength: number): string | null {
  if (!pred) return null;
  const iso = toISO(date);
  // Logged period days
  for (const s of starts) {
    const start = parseDate(s);
    if (diffDays(start, date) >= 0 && diffDays(start, date) < periodLength) return "period";
  }
  if (diffDays(pred.nextPeriod, date) >= 0 && diffDays(pred.nextPeriod, date) < periodLength) return "predicted";
  if (toISO(date) === toISO(pred.ovulation)) return "ovulation";
  if (diffDays(pred.fertileStart, date) >= 0 && diffDays(date, pred.fertileEnd) >= 0) return "fertile";
  if (diffDays(pred.pmsStart, date) >= 0 && diffDays(date, pred.pmsEnd) >= 0) return "pms";
  return null;
}

function MonthCalendar({
  year,
  month,
  starts,
  pred,
  periodLength,
}: {
  year: number;
  month: number;
  starts: string[];
  pred: ReturnType<typeof predict>;
  periodLength: number;
}) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (first.getDay() + 6) % 7; // Monday first
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  const todayISO = toISO(new Date());
  const kindClass: Record<string, string> = {
    period: "bg-rose-500 text-white",
    predicted: "bg-rose-200 text-rose-900 ring-1 ring-rose-400",
    ovulation: "bg-amber-400 text-amber-950",
    fertile: "bg-emerald-200 text-emerald-900",
    pms: "bg-violet-200 text-violet-900",
  };
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">
        {first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} className="py-1 font-medium">{d}</div>
        ))}
        {cells.map((date, i) =>
          date ? (
            <div
              key={i}
              title={fmt(date)}
              className={`flex h-8 items-center justify-center rounded-full text-xs ${
                dayKind(date, starts, pred, periodLength)
                  ? kindClass[dayKind(date, starts, pred, periodLength)!]
                  : "text-foreground/80"
              } ${toISO(date) === todayISO ? "ring-2 ring-rose-600 ring-offset-1" : ""}`}
            >
              {date.getDate()}
            </div>
          ) : (
            <div key={i} />
          )
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [starts, setStarts] = useState<string[]>([""]);
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [logDate, setLogDate] = useState(toISO(new Date()));
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const s = loadSaved();
    if (s && s.starts.length > 0) {
      setStarts(s.starts);
      setCycleLength(s.cycleLength);
      setPeriodLength(s.periodLength);
      setSaved(true);
      setEditing(false);
    }
    setLoaded(true);
  }, []);

  const validStarts = useMemo(
    () => starts.map((s) => s.trim()).filter(Boolean).sort(),
    [starts]
  );
  const pred = useMemo(
    () => (validStarts.length > 0 ? predict(validStarts, cycleLength, periodLength) : null),
    [validStarts, cycleLength, periodLength]
  );

  function persist(next: Saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaved(true);
    setEditing(false);
    setNotice("Saved. Your predictions are up to date.");
  }

  function handleSave() {
    if (validStarts.length === 0) {
      setNotice("Add at least one period start date.");
      return;
    }
    persist({ starts: validStarts, cycleLength, periodLength });
  }

  function logPeriod(dateISO: string) {
    if (!dateISO) return;
    if (validStarts.includes(dateISO)) {
      setNotice("That date is already logged.");
      return;
    }
    const next = [...validStarts, dateISO].sort().slice(-3);
    const data: Saved = { starts: next, cycleLength, periodLength };
    persist(data);
    setStarts(next);
    setNotice(`Logged a period starting ${fmt(parseDate(dateISO))}. Predictions updated.`);
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    setStarts([""]);
    setCycleLength(28);
    setPeriodLength(5);
    setSaved(false);
    setEditing(true);
    setNotice("Cleared. Start again with your last period dates.");
  }

  if (!loaded) return <main className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">Loading…</main>;

  const today = new Date();
  const ringPct = pred ? Math.min(100, Math.max(0, (pred.cycleDay / pred.effectiveCycle) * 100)) : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Droplets className="h-6 w-6 text-rose-600" />
            <h1 className="text-3xl font-bold tracking-tight">Menstrual Tracker</h1>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Know your cycle, in your own rhythm. Enter your last period dates and your cycle
            length, and we predict your next period, ovulation and fertile window.
          </p>
        </div>
        {saved && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
      </header>

      {notice && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {notice}
        </div>
      )}

      {editing && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your cycle</CardTitle>
            <CardDescription>
              Add 1 to 3 of your most recent period start dates. More dates make the
              prediction more accurate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Last period start dates</Label>
              {starts.map((value, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={value}
                    onChange={(e) => {
                      const next = [...starts];
                      next[i] = e.target.value;
                      setStarts(next);
                    }}
                  />
                  {starts.length > 1 && (
                    <Button variant="ghost" size="sm" aria-label="Remove date" onClick={() => setStarts(starts.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {starts.length < 3 && (
                <Button variant="outline" size="sm" onClick={() => setStarts([...starts, ""])}>
                  <Plus className="h-4 w-4" /> Add another period date
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Tip: use the first day of bleeding for each period, most recent last.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cycle">Your cycle length: {cycleLength} days</Label>
              <input
                id="cycle"
                type="range"
                min={20}
                max={45}
                value={cycleLength}
                onChange={(e) => setCycleLength(Number(e.target.value))}
                className="w-full accent-rose-600"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={20}
                  max={45}
                  value={cycleLength}
                  onChange={(e) => setCycleLength(Math.min(45, Math.max(20, Number(e.target.value) || 28)))}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">
                  Days from the first day of one period to the first day of the next. E.g. 26 or 27.
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="period">Bleeding usually lasts: {periodLength} days</Label>
              <input
                id="period"
                type="range"
                min={2}
                max={10}
                value={periodLength}
                onChange={(e) => setPeriodLength(Number(e.target.value))}
                className="w-full accent-rose-600"
              />
            </div>

            <Button onClick={handleSave} className="w-full sm:w-auto">
              Save and see my predictions
            </Button>
          </CardContent>
        </Card>
      )}

      {pred && !editing && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card className="sm:col-span-1">
              <CardContent className="flex flex-col items-center pt-6">
                <div className="relative h-32 w-32">
                  <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#ffe4e6" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="52" fill="none" stroke="#e11d48" strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(ringPct / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">Day {pred.cycleDay}</span>
                    <span className="text-xs text-muted-foreground">of {pred.effectiveCycle}</span>
                  </div>
                </div>
                <Badge className="mt-3">{pred.phaseLabel}</Badge>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Last period started {fmt(pred.lastStart)}
                </p>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2">
              <CardHeader>
                <CardTitle>Next period</CardTitle>
                <CardDescription>
                  {pred.daysUntilNext > 0
                    ? `In ${pred.daysUntilNext} day${pred.daysUntilNext === 1 ? "" : "s"}`
                    : pred.daysUntilNext === 0
                      ? "Due today"
                      : `${-pred.daysUntilNext} day${pred.daysUntilNext === -1 ? "" : "s"} late — log it when it starts`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-2xl font-bold">{fmt(pred.nextPeriod)}</p>
                <p className="text-muted-foreground">
                  Likely range: {fmtShort(pred.nextRangeStart)} – {fmtShort(pred.nextRangeEnd)}
                  {` (±${pred.spread} day${pred.spread === 1 ? "" : "s"})`}
                </p>
                <div className="grid gap-2 pt-2 sm:grid-cols-2">
                  <div className="rounded-md bg-amber-50 p-3">
                    <p className="flex items-center gap-1 font-semibold"><Flower2 className="h-4 w-4" /> Ovulation</p>
                    <p>{fmt(pred.ovulation)}</p>
                  </div>
                  <div className="rounded-md bg-emerald-50 p-3">
                    <p className="flex items-center gap-1 font-semibold"><Heart className="h-4 w-4" /> Fertile window</p>
                    <p>{fmtShort(pred.fertileStart)} – {fmtShort(pred.fertileEnd)}</p>
                  </div>
                  <div className="rounded-md bg-violet-50 p-3">
                    <p className="font-semibold">PMS window</p>
                    <p>{fmtShort(pred.pmsStart)} – {fmtShort(pred.pmsEnd)}</p>
                  </div>
                  <div className="rounded-md bg-rose-50 p-3">
                    <p className="flex items-center gap-1 font-semibold"><CalendarDays className="h-4 w-4" /> Effective cycle</p>
                    <p>{pred.effectiveCycle} days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
              <CardDescription>Colour-coded for this month and next.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <MonthCalendar year={today.getFullYear()} month={today.getMonth()} starts={validStarts} pred={pred} periodLength={periodLength} />
              <MonthCalendar
                year={new Date(today.getFullYear(), today.getMonth() + 1, 1).getFullYear()}
                month={new Date(today.getFullYear(), today.getMonth() + 1, 1).getMonth()}
                starts={validStarts}
                pred={pred}
                periodLength={periodLength}
              />
            </CardContent>
            <CardContent className="flex flex-wrap gap-3 pt-0 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-rose-500" /> Period</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-rose-200 ring-1 ring-rose-400" /> Predicted period</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-emerald-200" /> Fertile</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-400" /> Ovulation</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-violet-200" /> PMS</span>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>How your prediction is worked out</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Stated cycle length: <strong className="text-foreground">{pred.statedCycle} days</strong></p>
              <p>
                Actual gaps between your dates:{" "}
                <strong className="text-foreground">
                  {pred.actualGaps.length > 0 ? pred.actualGaps.map((g) => `${g} days`).join(", ") : "— not enough dates yet"}
                </strong>
                {pred.actualAvg !== null && <> (average {pred.actualAvg} days)</>}
              </p>
              <p>
                Effective cycle: <strong className="text-foreground">{pred.effectiveCycle} days</strong>
                {pred.actualAvg !== null
                  ? ` — 65% your real gaps + 35% your stated length, so real history weighs more.`
                  : ` — your stated length, because only one date was entered. Add a second date and the real gap will shape it.`}
              </p>
              <p>
                Ovulation is estimated as 14 days before your next period, and the fertile window
                is the 5 days before ovulation plus ovulation day itself. The likely range is
                ±{pred.spread} day{pred.spread === 1 ? "" : "s"} around the predicted date.
              </p>
              <p className="flex gap-2 text-xs">
                <Info className="h-4 w-4 shrink-0" />
                These are estimates. Log each new period and the prediction sharpens over time.
              </p>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Log a period</CardTitle>
              <CardDescription>Logging keeps future predictions accurate.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2">
                <Label>Period start date</Label>
                <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
              </div>
              <Button onClick={() => logPeriod(logDate)}>Log this period</Button>
              <Button variant="secondary" onClick={() => logPeriod(toISO(new Date()))}>
                Period started today
              </Button>
              <Button variant="ghost" onClick={clearAll}>
                <RotateCcw className="h-4 w-4" /> Start over
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <footer className="pb-4 text-center text-xs leading-relaxed text-muted-foreground">
        Estimates only — not medical advice, and not a method of contraception.
        Your data is stored only in this browser, on this device.
        {saved && <span> · Last period dates: {validStarts.join(", ")}</span>}
      </footer>
    </main>
  );
}
