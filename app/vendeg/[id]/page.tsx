
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ClientPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
type TrainingWeek = {
  id: string;
  week_number: number;
  days: {
    name: string;
    exercises: {
      id: string;
      name: string;
      minReps: number;
      maxReps: number;
      sets: {
        kg: string;
        reps: string;
        rir: string;
      }[];
    }[];
  }[];
};

const [trainingWeeks, setTrainingWeeks] = useState<TrainingWeek[]>([]);
const [trainingLoading, setTrainingLoading] = useState(false);
const [trainingError, setTrainingError] = useState("");

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

const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
const [dailyError, setDailyError] = useState("");

const weightChartData = dailyEntries
  .filter(
    (entry) =>
      entry.weight !== null &&
      Number.isFinite(Number(entry.weight))
  )
  .map((entry) => ({
    date: entry.entry_date,
    weight: Number(entry.weight),
  }))
  .reverse();

  
const weeklyAverages = Object.entries(
  dailyEntries.reduce<
    Record<string, DailyEntry[]>
  >((weeks, entry) => {
    const date = new Date(entry.entry_date + "T12:00:00");
    const day = date.getDay();

    // A hét első napja hétfő.
    date.setDate(date.getDate() - ((day + 6) % 7));

    const weekStart = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    if (!weeks[weekStart]) {
      weeks[weekStart] = [];
    }

    weeks[weekStart].push(entry);
    return weeks;
  }, {})
)
  .sort(([a], [b]) => b.localeCompare(a))
  .map(([weekStart, entries]) => {
    function average(
      field: "weight" | "steps" | "sleep" | "calories"
    ) {
      const values = entries
        .map((entry) => entry[field])
        .filter(
          (value): value is number =>
            value !== null && Number.isFinite(Number(value))
        )
        .map(Number);

      if (values.length === 0) return null;

      return (
        values.reduce((sum, value) => sum + value, 0) /
        values.length
      );
    }

    return {
      weekStart,
      weight: average("weight"),
      steps: average("steps"),
      sleep: average("sleep"),
      calories: average("calories"),
    };
  });
  useEffect(() => {
    async function loadClient() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/belepes");
        return;
      }

      // Csak a saját, elfogadott vendég adatlapja nyitható meg.
      const { data: connection, error: connectionError } =
        await supabase
          .from("coach_clients")
          .select("id")
          .eq("coach_id", authData.user.id)
          .eq("client_id", clientId)
          .eq("status", "accepted")
          .maybeSingle();

      if (connectionError || !connection) {
        setError("Ehhez a vendéghez nincs aktív hozzáférésed.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", clientId)
          .maybeSingle();

      if (profileError) {
        setError("Nem sikerült betölteni a vendég profilját.");
      } else {
        setClientName(profile?.full_name || "Névtelen vendég");
      }

setTrainingLoading(true);

const { data: weeks, error: weeksError } = await supabase
  .from("training_weeks")
  .select("id, week_number, days")
  .eq("user_id", clientId)
  .order("week_number", { ascending: true });

if (weeksError) {
  setTrainingError("Edzésnapló betöltési hiba: " + weeksError.message);
} else {
  setTrainingWeeks((weeks ?? []) as TrainingWeek[]);
}

setTrainingLoading(false);

const { data: entries, error: entriesError } = await supabase
  .from("daily_entries")
  .select(
    "entry_date, weight, calories, protein, carbs, fat, sleep, steps, cardio, notes"
  )
  .eq("user_id", clientId)
  .order("entry_date", { ascending: false })


if (entriesError) {
  setDailyError(
    "Napi napló betöltési hiba: " + entriesError.message
  );
} else {
  setDailyEntries(entries ?? []);
}
      setLoading(false);
    }

    void loadClient();
  }, [clientId, router]);

  return (
    <main className="brand-shell min-h-screen p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold text-[#d8b96e]">
          ZSL COACHING
        </h1>

        <Link
          href="/edzoi"
          className="mt-5 inline-block text-[#d8b96e]"
        >
          ← Vissza a vendégeimhez
        </Link>

        {loading ? (
          <p className="mt-8 text-[#aaa]">Betöltés...</p>
        ) : error ? (
          <p role="alert" className="mt-8 text-red-400">
            {error}
          </p>
        ) : (
          <>
            <section className="mt-8 rounded-2xl border border-[#444] bg-[#1c1c1c] p-6">
              <h2 className="text-2xl font-bold">
                {clientName}
              </h2>
              <p className="mt-2 text-sm text-green-400">
                Aktív edzői kapcsolat
              </p>
            </section>

<section className="mt-6 rounded-2xl border border-[#444] bg-[#1c1c1c] p-6">
  <h3 className="mb-5 text-xl font-bold text-[#d8b96e]">
    Heti átlagok
  </h3>

  <div className="space-y-5">
    {weeklyAverages.map((week) => (
      <div
        key={week.weekStart}
        className="rounded-xl border border-[#444] p-4"
      >
        <h4 className="mb-4 font-semibold text-[#d8b96e]">
          {week.weekStart} kezdetű hét
        </h4>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Testsúly",
              value: week.weight?.toFixed(1),
              unit: "kg",
            },
            {
              label: "Lépésszám",
              value: week.steps?.toFixed(0),
              unit: "lépés/nap",
            },
            {
              label: "Alvás",
              value: week.sleep?.toFixed(1),
              unit: "óra",
            },
            {
              label: "Kalória",
              value: week.calories?.toFixed(0),
              unit: "kcal/nap",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg bg-[#292929] p-3"
            >
              <p className="text-sm text-[#aaa]">
                {item.label}
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {item.value ?? "–"}
              </p>
              <p className="text-xs text-[#aaa]">
                {item.unit}
              </p>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
</section>
<section className="mt-6 rounded-2xl border border-[#444] bg-[#1c1c1c] p-6">
  <h3 className="text-xl font-bold text-[#d8b96e]">
    Testsúlyváltozás
  </h3>

  <p className="mt-2 text-sm text-[#aaa]">
    A vendég legutóbbi 30 mentett napi bejegyzése alapján.
  </p>

  {weightChartData.length === 0 ? (
    <p className="mt-5 text-[#aaa]">
      Még nincsenek rögzített testsúlyadatok.
    </p>
  ) : (
    <div className="mt-6 h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={weightChartData}
          margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
        >
          <CartesianGrid stroke="#444" strokeDasharray="3 3" />

          <XAxis
            dataKey="date"
            stroke="#aaa"
            tick={{ fontSize: 11 }}
            tickFormatter={(date: string) => date.slice(5)}
          />

          <YAxis
            stroke="#aaa"
            domain={["dataMin - 1", "dataMax + 1"]}
            tick={{ fontSize: 12 }}
            unit=" kg"
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "#292929",
              border: "1px solid #d8b96e",
              borderRadius: "8px",
              color: "#fff",
            }}
            formatter={(value) => [`${value} kg`, "Testsúly"]}
          />

          <Line
            type="monotone"
            dataKey="weight"
            stroke="#d8b96e"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )}
</section>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <section className="rounded-2xl border border-[#444] bg-[#1c1c1c] p-6">
                
<section className="rounded-2xl border border-[#444] bg-[#1c1c1c] p-6">
  <h3 className="text-xl font-bold text-[#d8b96e]">
    Edzésnapló
  </h3>

  {trainingLoading && (
    <p className="mt-4 text-[#aaa]">Betöltés...</p>
  )}

  {trainingError && (
    <p role="alert" className="mt-4 text-red-400">
      {trainingError}
    </p>
  )}

  {!trainingLoading &&
    !trainingError &&
    trainingWeeks.length === 0 && (
      <p className="mt-4 text-[#aaa]">
        A vendégnek még nincs mentett edzésnaplója.
      </p>
    )}

  <div className="mt-5 space-y-5">
    {trainingWeeks.map((week) => (
      <div
        key={week.id}
        className="rounded-xl border border-[#555] p-4"
      >
        <h4 className="text-lg font-bold text-[#d8b96e]">
          {week.week_number}. hét
        </h4>

        {week.days.map((day, dayIndex) => (
          <div key={dayIndex} className="mt-5">
            <h5 className="mb-3 font-semibold">{day.name}</h5>

            {day.exercises.map((exercise) => (
              <div
                key={exercise.id}
                className="mb-3 rounded-lg bg-[#292929] p-3"
              >
                <p className="font-semibold">{exercise.name}</p>

                <p className="mt-1 text-xs text-[#aaa]">
                  Cél: {exercise.minReps}–
                  {exercise.maxReps} ismétlés
                </p>

                {exercise.sets.map((set, setIndex) => (
                  <p
                    key={setIndex}
                    className="mt-2 text-sm text-[#ddd]"
                  >
                    {setIndex + 1}. sorozat: {set.kg || "–"} kg
                    {" × "}
                    {set.reps || "–"} ismétlés
                    {" | "}
                    RIR: {set.rir || "–"}
                  </p>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    ))}
  </div>
</section>
                <p className="mt-3 text-sm text-[#aaa]">
                  A vendég edzései és súlyai.
                </p>
              </section>

              <section className="rounded-2xl border border-[#444] bg-[#1c1c1c] p-6">
                
<section className="rounded-2xl border border-[#444] bg-[#1c1c1c] p-6">
  <h3 className="text-xl font-bold text-[#d8b96e]">
    Napi napló
  </h3>

  {dailyError && (
    <p role="alert" className="mt-4 text-red-400">
      {dailyError}
    </p>
  )}

  {!dailyError && dailyEntries.length === 0 && (
    <p className="mt-4 text-[#aaa]">
      A vendégnek még nincs mentett napi naplója.
    </p>
  )}

  <div className="mt-5 space-y-4">
    {dailyEntries.map((entry) => (
      <div
        key={entry.entry_date}
        className="rounded-xl border border-[#555] bg-[#292929] p-4"
      >
        <h4 className="mb-4 text-lg font-bold text-[#d8b96e]">
          {entry.entry_date}
        </h4>

        <div className="grid grid-cols-2 gap-3 text-sm">
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
            <p className="text-sm font-semibold text-[#d8b96e]">
              Megjegyzés
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[#ddd]">
              {entry.notes}
            </p>
          </div>
        )}
      </div>
    ))}
  </div>
</section>
                <p className="mt-3 text-sm text-[#aaa]">
                  Testsúly, kalóriák, makrók és alvás.
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
