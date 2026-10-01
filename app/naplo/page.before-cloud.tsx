
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  const [date, setDate] = useState("");
  const [entries, setEntries] = useState<
    Record<string, DailyEntry>
  >({});
  const [loaded, setLoaded] = useState(false);

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

  return (
    <main className="min-h-screen bg-[#101010] text-white">
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

        <div className="mt-6 rounded-xl border border-[#6e6041] bg-[#29251b] p-4 text-sm text-[#d8b96e]">
          A következő fejlesztésben napi célértékeket és
          heti összesítéseket is hozzáadunk.
        </div>
      </div>
    </main>
  );
}