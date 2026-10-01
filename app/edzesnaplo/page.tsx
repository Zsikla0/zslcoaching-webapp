
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

import {
  loadTrainingWeeks,
  saveTrainingWeeks,
  saveTrainingResult,
  loadTrainingResults,
  saveExerciseOrder,
} from "../../lib/trainingCloud";

type SetEntry = {
  kg: string;
  reps: string;
  rir: string;
};

type Exercise = {
  id: string;
  name: string;
  minReps: number;
  maxReps: number;
  sets: SetEntry[];
};

type TrainingDay = {
  name: string;
  exercises: Exercise[];
};


type TrainingWeek = {
  id: string;
  number: number;
  days: TrainingDay[];
  structureVersion?: number;
};

const initialDays: TrainingDay[] = [
  {
    name: "Hétfő – Felsőtest A",
    exercises: [
      {
        id: "bench",
        name: "Fekvenyomás",
        minReps: 8,
        maxReps: 12,
        sets: [
          { kg: "", reps: "", rir: "" },
          { kg: "", reps: "", rir: "" },
          { kg: "", reps: "", rir: "" },
        ],
      },
      {
        id: "row",
        name: "Evezés",
        minReps: 10,
        maxReps: 12,
        sets: [
          { kg: "", reps: "", rir: "" },
          { kg: "", reps: "", rir: "" },
          { kg: "", reps: "", rir: "" },
        ],
      },
    ],
  },
  {
    name: "Kedd – Alsótest A",
    exercises: [
      {
        id: "squat",
        name: "Guggolás",
        minReps: 6,
        maxReps: 10,
        sets: [
          { kg: "", reps: "", rir: "" },
          { kg: "", reps: "", rir: "" },
          { kg: "", reps: "", rir: "" },
        ],
      },
    ],
  },
  {
    name: "Csütörtök – Felsőtest B",
    exercises: [
      {
        id: "incline",
        name: "Ferde pados nyomás",
        minReps: 8,
        maxReps: 12,
        sets: [
          { kg: "", reps: "", rir: "" },
          { kg: "", reps: "", rir: "" },
          { kg: "", reps: "", rir: "" },
        ],
      },
    ],
  },
];

const STORAGE_KEY = "zsl-training-weeks-v2";

function feedback(reps: string, min: number, max: number) {
  if (reps.trim() === "") return null;

  const value = Number(reps);
  if (!Number.isFinite(value) || value < 0) return null;

  if (value < min) {
    return {
      text: "Következő héten csökkents a súlyon",
      color: "#ef7777",
    };
  }

  if (value > max) {
    return {
      text: "Következő héten emelj a súlyon",
      color: "#74d9a0",
    };
  }

  return {
    text: "Ismétléstartományon belül",
    color: "#d8b96e",
  };
}

function trainingStructure(weeks: TrainingWeek[]) {
  return weeks.map((week) => ({
    number: week.number,
    days: week.days.map((day) => ({
      name: day.name,
      exercises: day.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        minReps: exercise.minReps,
        maxReps: exercise.maxReps,
        setCount: exercise.sets.length,
      })),
    })),
  }));
}

function hasLocalResultConflicts(
  localWeeks: TrainingWeek[],
  cloudWeeks: TrainingWeek[]
): boolean {
  return localWeeks.some((localWeek) => {
    const cloudWeek = cloudWeeks.find(
      (week) => week.number === localWeek.number
    );

    return localWeek.days.some((localDay, dayIndex) =>
      localDay.exercises.some((localExercise) =>
        localExercise.sets.some((localSet, setIndex) => {
          const hasLocalResult = Object.values(localSet).some(
            (value) => value.trim() !== ""
          );

          if (!hasLocalResult) return false;

          const cloudSet = cloudWeek?.days[dayIndex]?.exercises
            .find((exercise) => exercise.id === localExercise.id)
            ?.sets[setIndex];

          return (
            !cloudSet ||
            (localSet.kg !== "" && localSet.kg !== cloudSet.kg) ||
            (localSet.reps !== "" &&
              localSet.reps !== cloudSet.reps) ||
            (localSet.rir !== "" && localSet.rir !== cloudSet.rir)
          );
        })
      )
    );
  });
}
export default function Home() {
  const [weeks, setWeeks] = useState<TrainingWeek[]>([
    { id: "week-1", number: 1, days: initialDays },
  ]);
  const [activeWeek, setActiveWeek] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [cloudInitialized, setCloudInitialized] = useState(false);
  
const [cloudBusy, setCloudBusy] = useState(false);
const [cloudMessage, setCloudMessage] = useState("");

const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
const [autoSaveStatus, setAutoSaveStatus] = useState("");

async function saveToCloud() {
  if (!loaded || cloudBusy) return;

  setCloudBusy(true);
  setCloudMessage("Mentés folyamatban...");

  try {
    await saveTrainingWeeks(weeks);
    setCloudMessage("Sikeres felhőmentés!");
  } catch (error) {
    setCloudMessage(
      "Mentési hiba: " +
        (error instanceof Error ? error.message : "Ismeretlen hiba")
    );
  } finally {
    setCloudBusy(false);
  }
}

function downloadTrainingBackup() {
  const backup = JSON.stringify(weeks, null, 2);
  const blob = new Blob([backup], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "zsl-edzesnaplo-biztonsagi-mentes.json";
  link.click();

  URL.revokeObjectURL(url);
}
async function loadFromCloud() {
  if (!loaded || cloudBusy) return;

  const confirmed = window.confirm(
    "A felhőből betöltött adatok lecserélik a jelenlegi böngészős naplót. Folytatod?"
  );

  if (!confirmed) return;

  setCloudBusy(true);
  setCloudMessage("Betöltés folyamatban...");

  try {
    const cloudWeeks = await loadWeeksWithResults();

    if (cloudWeeks.length === 0) {
      setCloudMessage(
        "A felhőben még nincs edzésnapló. A helyi adatok változatlanok."
      );
      return;
    }

localStorage.setItem(
  "zsl-training-backup-before-cloud",
  JSON.stringify(weeks)
);
    setWeeks(cloudWeeks);
    setActiveWeek(0);
    setActiveDay(0);

    setAutoSaveEnabled(false);
setAutoSaveStatus("");

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
  
async function loadWeeksWithResults() {
  const [cloudWeeks, results] = await Promise.all([
    loadTrainingWeeks(),
    loadTrainingResults(),
  ]);

  return cloudWeeks.map((week) => ({
    ...week,
    days: week.days.map((day, dayIndex) => ({
      ...day,
      exercises: day.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set, setIndex) => {
          const saved = results.find(
            (result) =>
              result.week_number === week.number &&
              result.day_index === dayIndex &&
              result.exercise_id === exercise.id &&
              result.set_index === setIndex
          );

          return saved
            ? {
                kg: saved.kg,
                reps: saved.reps,
                rir: saved.rir,
              }
            : set;
        }),
      })),
    })),
  }));
}
const [checkingAuth, setCheckingAuth] = useState(true);
const [isCoach, setIsCoach] = useState(false);

useEffect(() => {
  let active = true;

  async function checkUser() {
    const { data, error } = await supabase.auth.getUser();

    if (!active) return;

    if (error || !data.user) {
      window.location.replace("/belepes");
      return;
    }
    const { data: coach } = await supabase
  .from("coaches")
  .select("user_id")
  .eq("user_id", data.user.id)
  .maybeSingle();

if (!active) return;

setIsCoach(!!coach);
    setCheckingAuth(false);
  }

  checkUser();

  const { data: listener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (!session) {
        window.location.replace("/belepes");
      }
    }
  );

  return () => {
    active = false;
    listener.subscription.unsubscribe();
  };
}, []);

  // Betöltés: az előző verzió adatait is átvesszük.
  useEffect(() => {
    try {
      const savedWeeks = localStorage.getItem(STORAGE_KEY);

      if (savedWeeks) {
        const parsed = JSON.parse(savedWeeks);

        if (Array.isArray(parsed) && parsed.length > 0) {
          setWeeks(parsed);
          setActiveWeek(parsed.length - 1);
        }
      } else {
        const oldData = localStorage.getItem("zsl-training-v1");

        if (oldData) {
          const oldDays = JSON.parse(oldData);

          if (Array.isArray(oldDays) && oldDays.length > 0) {
            setWeeks([
              {
                id: "week-1",
                number: 1,
                days: oldDays,
              },
            ]);
          }
        }
      }
    } catch (error) {
      console.error("Betöltési hiba:", error);
    }

    setLoaded(true);
  }, []);

useEffect(() => {
  if (!loaded) return;

  let active = true;

  async function initializeCloud() {
    try {
      const cloudWeeks = await loadWeeksWithResults();

      if (!active || cloudWeeks.length === 0) return;

      const localWeeks = localStorage.getItem(STORAGE_KEY);

      
if (
  localWeeks &&
  (
    JSON.stringify(
      trainingStructure(JSON.parse(localWeeks))
    ) !== JSON.stringify(trainingStructure(cloudWeeks)) ||
    hasLocalResultConflicts(
      JSON.parse(localWeeks),
      cloudWeeks
    )
  )
) {
        const confirmed = window.confirm(
          "A felhőben eltérő edzésterv vagy eredmények találhatók. Betöltöd a felhőadatokat? A jelenlegi naplódról biztonsági másolat készül."
        );

        if (!confirmed || !active) return;

        localStorage.setItem(
          "zsl-training-backup-before-cloud",
          localWeeks
        );
      }

      if (!active) return;

      setWeeks(cloudWeeks);
      setActiveWeek(0);
      setActiveDay(0);
      setCloudMessage("A felhőadatok betöltődtek.");
    } catch (error) {
      if (active) {
        setCloudMessage(
          "Automatikus betöltési hiba: " +
            (error instanceof Error
              ? error.message
              : "Ismeretlen hiba")
        );
      }
    } finally {
      if (active) setCloudInitialized(true);
    }
  }

  void initializeCloud();

  return () => {
    active = false;
  };
}, [loaded]);
  // Automatikus mentés.
  useEffect(() => {
    if (!loaded || !cloudInitialized) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(weeks));
    } catch (error) {
      console.error("Mentési hiba:", error);
    }
  }, [weeks, loaded]);
  
useEffect(() => {
  if (!loaded || !autoSaveEnabled || cloudBusy) return;

  setAutoSaveStatus("Mentésre vár...");

  const timer = window.setTimeout(async () => {
    setAutoSaveStatus("Mentés folyamatban...");

    try {
      // A régi teljeshetes automatikus felhőmentés kikapcsolva.
// Az eredményeket külön mentjük a training_results táblába.
      setAutoSaveStatus("Minden változtatás mentve");
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
}, [weeks, loaded, autoSaveEnabled, cloudBusy]);

  const week = weeks[activeWeek];
  const day = week?.days[activeDay];

  function updateCurrentDay(
    updater: (day: TrainingDay) => TrainingDay
  ) {
    setWeeks((previous) =>
      previous.map((item, weekIndex) => {
        if (weekIndex !== activeWeek) return item;

        return {
          ...item,
          days: item.days.map((trainingDay, dayIndex) =>
            dayIndex === activeDay
              ? updater(trainingDay)
              : trainingDay
          ),
        };
      })
    );
  }

async function saveCurrentSet(
  exerciseId: string,
  setIndex: number,
  values: SetEntry
) {
  const currentWeek = weeks[activeWeek];

  
if (!currentWeek) return;

if (!cloudInitialized || currentWeek.structureVersion == null) {
  setAutoSaveStatus(
    "Mentési hiba: az edzésterv még nem töltődött be a felhőből. Frissítsd az oldalt!"
  );
  return;
}

  try {
    await saveTrainingResult(
  week.number,
  activeDay,
  exerciseId,
  setIndex,
  values,
  currentWeek.structureVersion
);

    setAutoSaveStatus("Eredmény mentve a felhőbe");
  } catch (error) {
    setAutoSaveStatus(
      "Mentési hiba: " +
        (error instanceof Error
          ? error.message
          : "Ismeretlen hiba")
    );
  }
}
  function updateSet(
    exerciseId: string,
    setIndex: number,
    field: keyof SetEntry,
    value: string
  ) {
    updateCurrentDay((currentDay) => ({
      ...currentDay,
      exercises: currentDay.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set, index) =>
                index === setIndex
                  ? { ...set, [field]: value }
                  : set
              ),
            }
          : exercise
      ),
    }));
  }


async function moveExercise(
  exerciseId: string,
  direction: -1 | 1
) {
  if (cloudBusy || !cloudInitialized) return;

  const currentWeek = weeks[activeWeek];
  const currentDay = currentWeek?.days[activeDay];

  if (!currentWeek || !currentDay) return;

  const exercises = [...currentDay.exercises];
  const currentIndex = exercises.findIndex(
    (exercise) => exercise.id === exerciseId
  );
  const targetIndex = currentIndex + direction;

  if (
    currentIndex === -1 ||
    targetIndex < 0 ||
    targetIndex >= exercises.length
  ) {
    return;
  }

  [exercises[currentIndex], exercises[targetIndex]] = [
    exercises[targetIndex],
    exercises[currentIndex],
  ];

  setCloudBusy(true);
  setCloudMessage("Sorrend mentése...");

  try {
    await saveExerciseOrder(
      currentWeek.number,
      activeDay,
      exercises.map((exercise) => exercise.id)
    );

    updateCurrentDay((day) => ({
      ...day,
      exercises,
    }));

    setCloudMessage("A gyakorlatok sorrendje elmentve.");
  } catch (error) {
    setCloudMessage(
      "Sorrendmentési hiba: " +
        (error instanceof Error
          ? error.message
          : "Ismeretlen hiba")
    );
  } finally {
    setCloudBusy(false);
  }
}
  function addSet(exerciseId: string) {
    updateCurrentDay((currentDay) => ({
      ...currentDay,
      exercises: currentDay.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: [
                ...exercise.sets,
                { kg: "", reps: "", rir: "" },
              ],
            }
          : exercise
      ),
    }));
  }

function deleteSet(exerciseId: string, setIndex: number) {
  if (!isCoach) return;

  const confirmed = window.confirm(
    "Biztosan törölni szeretnéd ezt a sorozatot?"
  );

  if (!confirmed) return;

  updateCurrentDay((currentDay) => ({
    ...currentDay,
    exercises: currentDay.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            sets: exercise.sets.filter(
              (_, index) => index !== setIndex
            ),
          }
        : exercise
    ),
  }));
}
function deleteExercise(exerciseId: string) {
  if (!isCoach) return;

  const confirmed = window.confirm(
    "Biztosan törölni szeretnéd ezt a gyakorlatot?"
  );

  if (!confirmed) return;

  updateCurrentDay((currentDay) => ({
    ...currentDay,
    exercises: currentDay.exercises.filter(
      (exercise) => exercise.id !== exerciseId
    ),
  }));
}

function editExercise(exerciseId: string) {
  if (!isCoach) return;

  const exercise = day?.exercises.find(
    (item) => item.id === exerciseId
  );

  if (!exercise) return;

  const name = window.prompt(
    "Gyakorlat neve:",
    exercise.name
  );

  if (name === null) return;

  if (!name.trim()) {
    window.alert("A gyakorlat neve nem lehet üres.");
    return;
  }

  const range = window.prompt(
    "Ismétléstartomány:",
    `${exercise.minReps}-${exercise.maxReps}`
  );

  if (range === null) return;

  const match = range.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);

  if (!match) {
    window.alert("Helyes formátum: 8-12");
    return;
  }

  const minReps = Number(match[1]);
  const maxReps = Number(match[2]);

  if (minReps < 1 || maxReps < minReps) {
    window.alert("Érvénytelen ismétléstartomány.");
    return;
  }

  updateCurrentDay((currentDay) => ({
    ...currentDay,
    exercises: currentDay.exercises.map((item) =>
      item.id === exerciseId
        ? {
            ...item,
            name: name.trim(),
            minReps,
            maxReps,
          }
        : item
    ),
  }));
}
  function addExercise() {
    const name = window.prompt("Gyakorlat neve:");
    if (!name?.trim()) return;

    const range = window.prompt(
      "Ismétléstartomány, például 8-12:",
      "8-12"
    );

    if (!range) return;

    const match = range.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);

    if (!match) {
      window.alert("Helyes formátum: 8-12");
      return;
    }

    const minReps = Number(match[1]);
    const maxReps = Number(match[2]);

    if (minReps < 1 || maxReps < minReps) {
      window.alert("Érvénytelen ismétléstartomány.");
      return;
    }

    updateCurrentDay((currentDay) => ({
      ...currentDay,
      exercises: [
        ...currentDay.exercises,
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          minReps,
          maxReps,
          sets: [{ kg: "", reps: "", rir: "" }],
        },
      ],
    }));
  }

  function createNextWeek() {
    const previousWeek = weeks[weeks.length - 1];

    if (!previousWeek) return;

    const newWeek: TrainingWeek = {
      id: crypto.randomUUID(),
      number: previousWeek.number + 1,
      days: previousWeek.days.map((trainingDay) => ({
        ...trainingDay,
        exercises: trainingDay.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) => ({
            kg: set.kg,
            reps: set.reps,
            rir: "",
          })),
        })),
      })),
    };

    setWeeks((previous) => [...previous, newWeek]);
    setActiveWeek(weeks.length);
    setActiveDay(0);
  }

  if (!day) {
    if (checkingAuth) {
  return (
    <main className="brand-shell flex min-h-screen items-center justify-center text-[#d8b96e]">
      Bejelentkezés ellenőrzése...
    </main>
  );
}
    return (
      <main className="brand-shell min-h-screen p-8 text-white">
        Edzésnapló betöltése...
      </main>
    );
  }

  return (
    <main className="brand-shell min-h-screen text-white">
      <header className="border-b border-[#d8b96e]/20 bg-[#111]/75 px-5 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-[0.15em] text-[#d8b96e]">
              ZSL COACHING
            </h1>
            <p className="mt-1 text-xs text-[#999]">
              ONLINE COACHING · EDZÉSNAPLÓ
            </p>
          </div>

          <span className="rounded-full border border-[#d8b96e] px-3 py-1 text-xs text-[#d8b96e]">
            2.0
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        
        <p className="text-sm text-[#aaa]">Üdv a naplódban!</p>
        <h2 className="mt-2 text-3xl font-bold">Edzéseim</h2>


<section className="mt-6 mb-6 rounded-3xl border border-[#d8b96e]/20 bg-[#1a1a1a]/95 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
  <h3 className="mb-2 text-lg font-bold text-[#d8b96e]">
    Felhőalapú mentés
  </h3>

<button
  type="button"
  onClick={loadFromCloud}
  disabled={cloudBusy}
  className="mt-3 rounded-lg border border-[#d8b96e] px-4 py-3 font-semibold text-[#d8b96e] hover:bg-[#d8b96e]/10 disabled:opacity-50"
>
  {cloudBusy ? "Betöltés..." : "Edzésterv betöltése a felhőből"}
</button>

<button
  type="button"
  onClick={downloadTrainingBackup}
  className="mt-3 ml-2 rounded-lg border border-[#555] px-4 py-3 font-semibold text-white hover:bg-[#292929]"
>
  Biztonsági másolat letöltése
</button>


  {cloudMessage && (
    <p role="status" className="mt-4 text-sm text-[#d8b96e]">
      {cloudMessage}
    </p>
  )}
  
{autoSaveStatus && (
  <p
    role="status"
    className={`mt-3 text-sm ${
      autoSaveStatus.includes("hiba")
        ? "text-red-400"
        : "text-[#74d9a0]"
    }`}
  >
    {autoSaveStatus}
  </p>
)}
</section>
        {/* Hetek */}
        <section className="mt-8 rounded-3xl border border-[#d8b96e]/20 bg-[#1a1a1a]/95 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Edzéshetek</h3>
            <button
              onClick={createNextWeek}
              className="rounded-lg bg-[#d8b96e] px-4 py-2 text-sm font-bold text-black"
            >
              + Új hét
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {weeks.map((item, index) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveWeek(index);
                  setActiveDay(0);
                }}
                className={`shrink-0 rounded-lg border px-5 py-3 text-sm font-bold ${
                  activeWeek === index
                    ? "border-[#d8b96e] bg-[#d8b96e] text-black"
                    : "border-[#444] bg-[#292929] text-white"
                }`}
              >
                {item.number}. hét
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-[#999]">
            Új hétnél a gyakorlatok és a súlyok átkerülnek,
            az ismétlések és a RIR újra kitölthetők.
          </p>
        </section>

        {/* Napok */}
        <div className="my-7 flex gap-2 overflow-x-auto pb-2">
          {week.days.map((item, index) => (
            <button
              key={index}
              onClick={() => setActiveDay(index)}
              className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold ${
                activeDay === index
                  ? "border-[#d8b96e] bg-[#d8b96e] text-black"
                  : "border-[#393939] bg-[#202020] text-[#ccc]"
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <p className="text-sm text-[#d8b96e]">
            {week.number}. hét
          </p>
          <h3 className="mt-1 text-xl font-bold">{day.name}</h3>
        </div>

        {/* Gyakorlatok */}
        <div className="space-y-5">
          {day.exercises.map((exercise) => (
            <section
              key={exercise.id}
              className="overflow-hidden rounded-2xl border border-[#363636] bg-[#1c1c1c]"
            >
              <div className="border-b border-[#333] p-5">
                
<div className="flex items-center justify-between gap-3">
  <h4 className="text-lg font-bold">
    {exercise.name}
  </h4>

  
<div className="flex gap-2">
  <button
    type="button"
    onClick={() => moveExercise(exercise.id, -1)}
    
disabled={cloudBusy || !cloudInitialized}
    className="rounded-lg border border-[#555] px-3 py-2 text-sm text-white"
    title="Gyakorlat feljebb"
  >
    ↑
  </button>

  <button
    type="button"
    onClick={() => moveExercise(exercise.id, 1)}
    
disabled={cloudBusy || !cloudInitialized}
    className="rounded-lg border border-[#555] px-3 py-2 text-sm text-white"
    title="Gyakorlat lejjebb"
  >
    ↓
  </button>
</div>
{isCoach && (
  <div className="flex flex-wrap gap-2">
    <button
      type="button"
      onClick={() => editExercise(exercise.id)}
      className="rounded-lg border border-[#d8b96e] px-3 py-2 text-xs font-semibold text-[#d8b96e] hover:bg-[#d8b96e]/10"
    >
      Szerkesztés
    </button>

    <button
      type="button"
      onClick={() => deleteExercise(exercise.id)}
      className="rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10"
    >
      Törlés
    </button>
  </div>
)}
</div>
                <p className="mt-1 text-sm text-[#aaa]">
                  Cél: {exercise.minReps}–{exercise.maxReps} ismétlés
                </p>
              </div>

              <div className="p-4 sm:p-5">
                <div className="mb-3 grid grid-cols-[36px_1fr_1fr_1fr] gap-2 text-center text-xs font-bold text-[#999]">
                  <span>SOR.</span>
                  <span>KG</span>
                  <span>ISM.</span>
                  <span>RIR</span>
                </div>

                <div className="space-y-3">
                  {exercise.sets.map((set, setIndex) => {
                    const result = feedback(
                      set.reps,
                      exercise.minReps,
                      exercise.maxReps
                    );

                    return (
                      <div key={setIndex}>
                        <div className="grid grid-cols-[36px_1fr_1fr_1fr] items-center gap-2">
                          <span className="text-center text-sm font-bold text-[#d8b96e]">
                            {setIndex + 1}.
                            

                          </span>

                          {(["kg", "reps", "rir"] as const).map(
                            (field) => (
                              <input
                                key={field}
                                type="number"
                                min="0"
                                step={field === "kg" ? "0.5" : "1"}
                                inputMode="decimal"
                                placeholder="—"
                                value={set[field]}
                                onChange={(event) =>
                                  updateSet(
                                    exercise.id,
                                    setIndex,
                                    field,
                                    event.target.value
                                  )
                                }
                                
onBlur={(event) => {
  const currentValues = {
    ...exercise.sets[setIndex],
    [field]: event.target.value,
  };

  void saveCurrentSet(
    exercise.id,
    setIndex,
    currentValues
  );
}}
                                className="min-w-0 rounded-lg border border-[#444] bg-[#292929] px-2 py-3 text-center text-base text-white outline-none focus:border-[#d8b96e]"
                              />
                            )
                          )}
                        </div>

{isCoach && (
  <div className="mt-2 flex justify-end">
    <button
      type="button"
      onClick={() => deleteSet(exercise.id, setIndex)}
      className="rounded-lg border border-red-500 px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10"
    >
      Sorozat törlése
    </button>
  </div>
)}
                        {result && (
                          <p
                            className="mt-2 pl-10 text-xs font-semibold"
                            style={{ color: result.color }}
                          >
                            {result.text}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                
{isCoach && (
  <button
    onClick={() => addSet(exercise.id)}
    className="mt-5 w-full rounded-xl border border-dashed border-[#6e6041] py-3 text-sm font-semibold text-[#d8b96e]"
  >
    + Új sorozat
  </button>
)}
              </div>
            </section>
          ))}
        </div>

        
{isCoach && (
  <button
    onClick={addExercise}
    className="mt-6 w-full rounded-xl bg-[#d8b96e] px-5 py-4 font-bold text-black"
  >
    + Gyakorlat hozzáadása
  </button>
)}

        <p className="mt-8 text-center text-xs text-[#777]">
          ZSL Coaching · Helyi automatikus mentés
        </p>
      </div>
    </main>
  );
}
