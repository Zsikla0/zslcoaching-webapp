
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import {
  loadDailyEntries,
  saveDailyEntry,
} from "../../lib/dailyCloud";

type DailyEntry = {
  weight: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  sleep: string;
  steps: string;
  cardio: string;
  notes: string;
};

type ClientGoals = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  steps: number | null;
  cardio_minutes: number | null;
};

const emptyEntry: DailyEntry = {
  weight: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  sleep: "",
  steps: "",
  cardio: "",
  notes: "",
};

const fields: {
  key: keyof Omit<DailyEntry, "notes">;
  label: string;
  unit: string;
  step: string;
}[] = [
  { key: "weight", label: "Testsúly", unit: "kg", step: "0.1" },
  { key: "calories", label: "Kalória", unit: "kcal", step: "1" },
  { key: "protein", label: "Fehérje", unit: "g", step: "1" },
  { key: "carbs", label: "Szénhidrát", unit: "g", step: "1" },
  { key: "fat", label: "Zsír", unit: "g", step: "1" },
  { key: "sleep", label: "Alvás", unit: "óra", step: "0.5" },
  { key: "steps", label: "Lépésszám", unit: "lépés", step: "1" },
  { key: "cardio", label: "Kardió", unit: "perc", step: "1" },
];

const STORAGE_KEY = "zsl-daily-log-v1";

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function DailyLogPage() {
    
    const router = useRouter();
    const [authLoading, setAuthLoading] = useState(true);
const [isLoggedIn, setIsLoggedIn] = useState(false);
const [clientGoals, setClientGoals] = useState<ClientGoals | null>(null);

useEffect(() => {
  async function checkLogin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
  setIsLoggedIn(false);
  setAuthLoading(false);
  router.replace("/belepes");
  return;
}

setIsLoggedIn(true);

const { data: goalData, error: goalsError } = await supabase
  .from("client_goals")
  .select("calories, protein, carbs, fat, steps, cardio_minutes")
  .eq("client_id", user.id)
  .order("updated_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (goalsError) {
  console.error("Edzői célok betöltése:", goalsError);
} else if (goalData) {
  setClientGoals(goalData as ClientGoals);
}

setAuthLoading(false);
  }

  checkLogin();
}, [router]);
  const [date, setDate] = useState("");
  const [entries, setEntries] = useState<
    Record<string, DailyEntry>
  >({});
  const [loaded, setLoaded] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
const [cloudMessage, setCloudMessage] = useState("");
const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
const [autoSaveStatus, setAutoSaveStatus] = useState("");

  useEffect(() => {
    setDate(todayLocal());

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);

        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          setEntries(parsed);
        }
      }
    } catch (error) {
      console.error("Betöltési hiba:", error);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error("Mentési hiba:", error);
    }
  }, [entries, loaded]);

async function saveToCloud() {
  if (cloudBusy) return;

  setCloudBusy(true);
  setCloudMessage("Napi adatok mentése...");

  try {
    const dates = Object.keys(entries);

    if (dates.length === 0) {
      setCloudMessage("Még nincsenek menthető napi adatok.");
      return;
    }

    const confirmed = window.confirm(
      `${dates.length} napi bejegyzést mentünk a felhőbe. ` +
      "Az azonos dátumú felhőbeli bejegyzések felülíródnak. Folytatod?"
    );

    if (!confirmed) {
      setCloudMessage("A mentést megszakítottad.");
      return;
    }

    for (const day of dates) {
      await saveDailyEntry(day, entries[day]);
    }

    setAutoSaveEnabled(true);
    setCloudMessage(
      `Sikeresen mentve: ${dates.length} napi bejegyzés!`
    );
  } catch (error) {
    setCloudMessage(
      "Mentési hiba: " +
        (error instanceof Error ? error.message : "Ismeretlen hiba")
    );
  } finally {
    setCloudBusy(false);
  }
}
async function loadFromCloud() {
  if (cloudBusy) return;

  setCloudBusy(true);
  setCloudMessage("Adatok betöltése...");

  try {
    const cloudEntries = await loadDailyEntries();

    if (Object.keys(cloudEntries).length === 0) {
      setCloudMessage("Még nincsenek napi adatok a felhőben.");
      return;
    }

    const confirmed = window.confirm(
      "A felhőben is vannak napi adatok. Az azonos dátumú helyi bejegyzéseket a felhőben tárolt adatok váltják fel. Folytatod?"
    );

    if (!confirmed) {
      setCloudMessage("A betöltést megszakítottad.");
      return;
    }

    setEntries((previous) => ({
      ...previous,
      ...cloudEntries,
    }));

    setAutoSaveEnabled(true);
    setCloudMessage("Sikeres betöltés a felhőből!");
  } catch (error) {
    setCloudMessage(
      "Betöltési hiba: " +
        (error instanceof Error ? error.message : "Ismeretlen hiba")
    );
  } finally {
    setCloudBusy(false);
  }
}

useEffect(() => {
  if (!loaded || !autoSaveEnabled || cloudBusy) return;

  setAutoSaveStatus("Mentésre vár...");

  const timer = window.setTimeout(async () => {
    setAutoSaveStatus("Mentés folyamatban...");

    try {
      for (const day of Object.keys(entries)) {
        await saveDailyEntry(day, entries[day]);
      }

      setAutoSaveStatus("Minden napi adat mentve");
    } catch (error) {
      setAutoSaveStatus(
        "Mentési hiba: " +
          (error instanceof Error
            ? error.message
            : "Ismeretlen hiba")
      );
    }
  }, 2000);

  return () => window.clearTimeout(timer);
}, [entries, loaded, autoSaveEnabled, cloudBusy]);
  const entry = entries[date] ?? emptyEntry;

  function updateField(key: keyof DailyEntry, value: string) {
    setEntries((previous) => ({
      ...previous,
      [date]: {
        ...(previous[date] ?? emptyEntry),
        [key]: value,
      },
    }));
  }

  function changeDay(offset: number) {
    if (!date) return;

    const [year, month, day] = date.split("-").map(Number);
    const next = new Date(year, month - 1, day + offset);

    const nextYear = next.getFullYear();
    const nextMonth = String(next.getMonth() + 1).padStart(2, "0");
    const nextDay = String(next.getDate()).padStart(2, "0");

    setDate(`${nextYear}-${nextMonth}-${nextDay}`);
  }
if (authLoading || !isLoggedIn) {
  return (
    <main className="brand-shell min-h-screen p-8 text-white">
      <p>Bejelentkezés ellenőrzése...</p>
    </main>
  );
}
  return (
    <main className="brand-shell min-h-screen text-white">
      <header className="border-b border-[#333] bg-[#171717] px-5 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-widest text-[#d8b96e]">
              ZSL COACHING
            </h1>
            <p className="mt-1 text-xs text-[#999]">
              NAPI ÉLETMÓDNAPLÓ
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-[#d8b96e] px-4 py-2 text-sm font-semibold text-[#d8b96e]"
          >
            Edzéseim
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="text-3xl font-bold">Napi napló</h2>
        <p className="mt-2 text-sm text-[#aaa]">
          Táplálkozás, regeneráció és napi aktivitás.
        </p>

        {clientGoals && Object.values(clientGoals).some((value) => value !== null) && (
          <section className="mt-6 rounded-3xl border border-[#d8b96e]/20 bg-[#1a1a1a]/95 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <h3 className="text-lg font-bold text-[#d8b96e]">Az edződ céljai</h3>
            <p className="mt-1 text-xs text-[#999]">Napi célok, a kardió heti célérték.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Kalória", value: clientGoals.calories, unit: "kcal / nap" },
                { label: "Fehérje", value: clientGoals.protein, unit: "g / nap" },
                { label: "Szénhidrát", value: clientGoals.carbs, unit: "g / nap" },
                { label: "Zsír", value: clientGoals.fat, unit: "g / nap" },
                { label: "Lépésszám", value: clientGoals.steps, unit: "lépés / nap" },
                { label: "Kardió", value: clientGoals.cardio_minutes, unit: "perc / hét" },
              ].filter((goal) => goal.value !== null).map((goal) => (
                <div key={goal.label} className="rounded-xl border border-[#d8b96e]/20 bg-[#202020] p-3">
                  <p className="text-xs text-[#aaa]">{goal.label}</p>
                  <p className="mt-1 font-bold text-[#d8b96e]">
                    {goal.value?.toLocaleString("hu-HU")} {goal.unit}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
        

<section className="mt-6 rounded-2xl border border-[#6e6041] bg-[#1c1c1c] p-5">
  <h3 className="mb-3 text-lg font-bold text-[#d8b96e]">
    Felhőalapú mentés
  </h3>

  {cloudMessage && (
    <p role="status" className="mt-3 text-sm text-[#d8b96e]">
      {cloudMessage}
    </p>
  )}

  {autoSaveEnabled && (
    <p role="status" className="mt-3 text-sm text-[#74d9a0]">
      {autoSaveStatus}
    </p>
  )}
</section>
        <section className="mt-7 rounded-2xl border border-[#363636] bg-[#1c1c1c] p-5">
          <h3 className="mb-4 text-lg font-bold text-[#d8b96e]">
            Nap kiválasztása
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => changeDay(-1)}
              className="rounded-lg bg-[#333] px-4 py-3"
              aria-label="Előző nap"
            >
              ←
            </button>

            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-[#555] bg-[#292929] px-3 py-3 text-white [color-scheme:dark]"
            />

            <button
              onClick={() => changeDay(1)}
              className="rounded-lg bg-[#333] px-4 py-3"
              aria-label="Következő nap"
            >
              →
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-[#363636] bg-[#1c1c1c] p-5">
          <h3 className="mb-5 text-xl font-bold">
            Mai adatok
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-2 block text-sm text-[#ccc]">
                  {field.label}
                  <span className="ml-1 text-[#888]">
                    ({field.unit})
                  </span>
                </span>

                <input
                  type="number"
                  min="0"
                  step={field.step}
                  inputMode="decimal"
                  placeholder="0"
                  value={entry[field.key]}
                  onChange={(event) =>
                    updateField(field.key, event.target.value)
                  }
                  className="w-full rounded-xl border border-[#444] bg-[#292929] px-4 py-3 text-lg text-white outline-none focus:border-[#d8b96e]"
                />
              </label>
            ))}
          </div>

          <label className="mt-6 block">
            <span className="mb-2 block text-sm text-[#ccc]">
              Megjegyzés
            </span>

            <textarea
              rows={4}
              placeholder="Közérzet, éhség, edzéssel kapcsolatos megjegyzések..."
              value={entry.notes}
              onChange={(event) =>
                updateField("notes", event.target.value)
              }
              className="w-full resize-y rounded-xl border border-[#444] bg-[#292929] px-4 py-3 text-white outline-none focus:border-[#d8b96e]"
            />
          </label>

          <p className="mt-5 text-xs text-[#999]">
            Az adatok automatikusan mentődnek ebben a böngészőben.
          </p>
        </section>

      </div>
    </main>
  );
}
