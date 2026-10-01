"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type DailyEntry = {
  entry_date: string;
  weight: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sleep: number | null;
  steps: number | null;
  cardio: number | null;
  notes: string | null;
};

type GoalKey = "calories" | "protein" | "carbs" | "fat" | "steps" | "cardio_minutes";
type Goals = Record<GoalKey, string>;

const emptyGoals: Goals = {
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  steps: "",
  cardio_minutes: "",
};

const goalFields: { key: GoalKey; label: string; unit: string; step: string }[] = [
  { key: "calories", label: "Kalória", unit: "kcal / nap", step: "1" },
  { key: "protein", label: "Fehérje", unit: "g / nap", step: "1" },
  { key: "carbs", label: "Szénhidrát", unit: "g / nap", step: "1" },
  { key: "fat", label: "Zsír", unit: "g / nap", step: "1" },
  { key: "steps", label: "Lépésszám", unit: "lépés / nap", step: "1" },
  { key: "cardio_minutes", label: "Kardió", unit: "perc / hét", step: "1" },
];

function getSevenDaySummary(entries: DailyEntry[]) {
  const dateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const today = new Date();
  const endDate = dateKey(today);
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  const startDate = dateKey(start);
  const recent = entries.filter(
    (entry) => entry.entry_date >= startDate && entry.entry_date <= endDate
  );

  const average = (field: "calories" | "protein" | "carbs" | "fat" | "sleep" | "steps") => {
    const values = recent
      .map((entry) => entry[field])
      .filter((value): value is number => value !== null);
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  };

  const cardio = recent
    .map((entry) => entry.cardio)
    .filter((value): value is number => value !== null);

  return {
    calories: average("calories"),
    protein: average("protein"),
    carbs: average("carbs"),
    fat: average("fat"),
    sleep: average("sleep"),
    steps: average("steps"),
    cardio: cardio.length ? cardio.reduce((sum, value) => sum + value, 0) : null,
  };
}

export default function ClientDailyLogPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const [coachId, setCoachId] = useState("");
  const [clientName, setClientName] = useState("");
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [goals, setGoals] = useState<Goals>(emptyGoals);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setCoachId("");
      setClientName("");
      setEntries([]);
      setGoals(emptyGoals);

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          router.replace("/belepes");
          return;
        }

        const currentCoachId = authData.user.id;
        const { data: coach, error: coachError } = await supabase
          .from("coaches")
          .select("user_id")
          .eq("user_id", currentCoachId)
          .maybeSingle();
        if (coachError) throw coachError;
        if (!coach) throw new Error("Ehhez az oldalhoz edzői jogosultság szükséges.");

        const { data: connection, error: connectionError } = await supabase
          .from("coach_clients")
          .select("id")
          .eq("coach_id", currentCoachId)
          .eq("client_id", clientId)
          .eq("status", "accepted")
          .maybeSingle();
        if (connectionError) throw connectionError;
        if (!connection) throw new Error("Ez a vendég nincs hozzád kapcsolva.");

        const [dailyResult, goalsResult, profileResult] = await Promise.all([
          supabase
            .from("daily_entries")
            .select("entry_date, weight, calories, protein, carbs, fat, sleep, steps, cardio, notes")
            .eq("user_id", clientId)
            .order("entry_date", { ascending: false })
            .limit(30),
          supabase
            .from("client_goals")
            .select("calories, protein, carbs, fat, steps, cardio_minutes")
            .eq("client_id", clientId)
            .eq("coach_id", currentCoachId)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", clientId)
            .maybeSingle(),
        ]);

        if (dailyResult.error) throw dailyResult.error;
        if (goalsResult.error) throw goalsResult.error;

        if (cancelled) return;
        setCoachId(currentCoachId);
        setEntries((dailyResult.data ?? []) as DailyEntry[]);
        setClientName(profileResult.data?.full_name?.trim() || clientId);
        if (goalsResult.data) {
          setGoals({
            calories: goalsResult.data.calories?.toString() ?? "",
            protein: goalsResult.data.protein?.toString() ?? "",
            carbs: goalsResult.data.carbs?.toString() ?? "",
            fat: goalsResult.data.fat?.toString() ?? "",
            steps: goalsResult.data.steps?.toString() ?? "",
            cardio_minutes: goalsResult.data.cardio_minutes?.toString() ?? "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Nem sikerült betölteni az oldalt.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, router]);

  const summary = useMemo(() => getSevenDaySummary(entries), [entries]);

  async function saveGoals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const parsed = Object.fromEntries(
      goalFields.map(({ key }) => {
        const value = goals[key].trim();
        return [key, value === "" ? null : Number(value)];
      })
    ) as Record<GoalKey, number | null>;

    if (Object.values(parsed).some((value) => value !== null && (!Number.isFinite(value) || value < 0))) {
      setError("A célértékek csak nulla vagy annál nagyobb számok lehetnek.");
      setSaving(false);
      return;
    }

    try {
      const { error: saveError } = await supabase.rpc("coach_save_client_goals", {
        p_client_id: clientId,
        p_calories: parsed.calories,
        p_protein: parsed.protein,
        p_carbs: parsed.carbs,
        p_fat: parsed.fat,
        p_steps: parsed.steps,
        p_cardio_minutes: parsed.cardio_minutes,
      });
      if (saveError) throw saveError;
      setMessage("A célok sikeresen elmentve.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült elmenteni a célokat.");
    } finally {
      setSaving(false);
    }
  }

  const formatMetric = (value: number | null, unit: string, digits = 0) =>
    value === null
      ? "Nincs adat"
      : `${value.toLocaleString("hu-HU", {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        })} ${unit}`;

  if (loading) {
    return <main className="brand-shell min-h-screen p-6 text-white">Napló betöltése...</main>;
  }

  if (error && !coachId) {
    return (
      <main className="brand-shell min-h-screen p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-red-400">{error}</p>
          <Link href="/edzoi" className="mt-5 inline-block text-[#d8b96e]">← Vissza a vendégeimhez</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="brand-shell min-h-screen p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href="/edzoi" className="text-[#d8b96e] hover:underline">← Vissza a vendégeimhez</Link>
        <h1 className="mt-6 text-3xl font-bold text-[#d8b96e]">Vendég napi naplója</h1>
        <p className="mt-2 text-[#aaa]">{clientName}</p>

        <section className="mt-6 rounded-3xl border border-[#d8b96e]/20 bg-[#1a1a1a]/95 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
          <h2 className="text-xl font-bold text-[#d8b96e]">Napi Célok</h2>
          <p className="mt-2 text-sm text-[#aaa]">A napi célok egy napra, a kardiócél egy hétre vonatkozik.</p>

          <form onSubmit={saveGoals} className="mt-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {goalFields.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#ddd]">{field.label}</span>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step={field.step}
                      inputMode="decimal"
                      value={goals[field.key]}
                      onChange={(event) => setGoals((previous) => ({ ...previous, [field.key]: event.target.value }))}
                      placeholder="Nincs beállítva"
                      className="w-full rounded-xl border border-[#393939] bg-[#111] px-4 py-3 pr-24 text-white outline-none transition focus:border-[#d8b96e] focus:shadow-[0_0_0_3px_rgba(216,185,110,0.1)]"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-[#888]">{field.unit}</span>
                  </div>
                </label>
              ))}
            </div>

            <button type="submit" disabled={saving} className="mt-5 rounded-xl bg-gradient-to-r from-[#c9a65b] via-[#e8cc89] to-[#c9a65b] px-5 py-3 font-bold text-[#111] shadow-[0_6px_24px_rgba(216,185,110,0.2)] transition hover:-translate-y-0.5 disabled:opacity-50">
              {saving ? "Mentés..." : "Célok mentése"}
            </button>
            {message && <p role="status" className="mt-3 text-sm text-green-400">{message}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
          </form>
        </section>

        <section className="mt-6 rounded-3xl border border-[#d8b96e]/20 bg-[#1a1a1a]/95 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
          <h2 className="text-xl font-bold text-[#d8b96e]">Elmúlt 7 nap</h2>
          <p className="mt-1 text-xs text-[#999]">Átlag a rögzített napokból; a kardió 7 napos összesítése.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { label: "Kalória átlaga", value: summary.calories, unit: "kcal", digits: 0 },
              { label: "Fehérje átlaga", value: summary.protein, unit: "g", digits: 1 },
              { label: "Szénhidrát átlaga", value: summary.carbs, unit: "g", digits: 1 },
              { label: "Zsír átlaga", value: summary.fat, unit: "g", digits: 1 },
              { label: "Alvás átlaga", value: summary.sleep, unit: "óra", digits: 1 },
              { label: "Lépésszám átlaga", value: summary.steps, unit: "lépés", digits: 0 },
              { label: "Kardió összesen", value: summary.cardio, unit: "perc", digits: 0 },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-[#d8b96e]/20 bg-[#202020] p-3">
                <p className="text-xs text-[#aaa]">{metric.label}</p>
                <p className="mt-1 font-bold text-[#d8b96e]">{formatMetric(metric.value, metric.unit, metric.digits)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#d8b96e]/20 bg-[#1a1a1a]/95 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
          <h2 className="text-xl font-bold text-[#d8b96e]">Naplóbejegyzések</h2>
          {entries.length === 0 ? (
            <p className="mt-4 text-[#aaa]">A vendégnek még nincs felhőbe mentett napi naplója.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {entries.map((entry) => (
                <article key={entry.entry_date} className="rounded-2xl border border-[#444] bg-[#222] p-4">
                  <h3 className="mb-3 font-bold text-[#d8b96e]">{entry.entry_date}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <p>Testsúly: {entry.weight ?? "–"} kg</p>
                    <p>Kalória: {entry.calories ?? "–"} kcal</p>
                    <p>Fehérje: {entry.protein ?? "–"} g</p>
                    <p>Szénhidrát: {entry.carbs ?? "–"} g</p>
                    <p>Zsír: {entry.fat ?? "–"} g</p>
                    <p>Alvás: {entry.sleep ?? "–"} óra</p>
                    <p>Lépések: {entry.steps ?? "–"}</p>
                    <p>Kardió: {entry.cardio ?? "–"} perc</p>
                  </div>
                  {entry.notes && (
                    <div className="mt-4 border-t border-[#444] pt-3">
                      <p className="text-sm font-semibold text-[#d8b96e]">Megjegyzés</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#ddd]">{entry.notes}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
