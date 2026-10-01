
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

import {
  loadClientTrainingWeeks,
  loadClientTrainingResults,
  addClientTrainingSet,
  deleteClientTrainingSet,
  saveClientTrainingWeek,
  type TrainingResult,
  type TrainingWeek,
} from "../../../../lib/trainingCloud";

export default function ClientTrainingEditor() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [weeks, setWeeks] = useState<TrainingWeek[]>([]);
  const [trainingResults, setTrainingResults] = useState<TrainingResult[]>([]);
  const [activeWeek, setActiveWeek] = useState(0);
const [activeDay, setActiveDay] = useState(0);

const selectedWeek = weeks[activeWeek];
const selectedDay = selectedWeek?.days[activeDay];
const selectedWeekHasResults = selectedWeek
  ? trainingResults.some((result) => result.week_number === selectedWeek.number)
  : false;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
async function addNewWeek() {
  if (loading || weeks.length === 0) return;

  const confirmed = window.confirm(
    "Létrehozod a következő hetet az utolsó hét edzéstervének másolásával?"
  );

  if (!confirmed) return;

  setLoading(true);
  setError("");

  try {
    const { data: newWeekNumber, error: createError } =
      await supabase.rpc("coach_create_client_week", {
        p_client_id: clientId,
      });

    if (createError) throw createError;

    const updatedWeeks = await loadClientTrainingWeeks(clientId);

    setWeeks(updatedWeeks);

    const newWeekIndex = updatedWeeks.findIndex(
      (week) => week.number === newWeekNumber
    );

    setActiveWeek(newWeekIndex >= 0 ? newWeekIndex : 0);
    setActiveDay(0);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Nem sikerült létrehozni az új hetet."
    );
  } finally {
    setLoading(false);
  }
}

async function addTrainingDay() {
  const currentWeek = weeks[activeWeek];

  if (!currentWeek || loading) return;

  const dayName = window.prompt(
    "Mi legyen az edzésnap neve?",
    `Edzésnap ${currentWeek.days.length + 1}`
  );

  if (dayName === null) return;

  if (!dayName.trim()) {
    setError("Az edzésnap neve nem lehet üres.");
    return;
  }

  const newDay = {
    name: dayName.trim(),
    exercises: [],
  };
  const updatedWeek = {
    ...currentWeek,
    days: [...currentWeek.days, newDay],
  };

  setLoading(true);
  setError("");

  try {
    await saveClientTrainingWeek(clientId, updatedWeek);
    setWeeks((previous) =>
      previous.map((week) =>
        week.id === currentWeek.id ? updatedWeek : week
      )
    );
    setActiveDay(updatedWeek.days.length - 1);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Nem sikerült hozzáadni az edzésnapot."
    );
  } finally {
    setLoading(false);
  }
}

async function deleteTrainingDay() {
  const currentWeek = weeks[activeWeek];
  const day = currentWeek?.days[activeDay];

  if (!currentWeek || !day || loading) return;

  if (activeDay !== currentWeek.days.length - 1) {
    setError("Csak a hét utolsó edzésnapja törölhető, hogy a korábbi napok eredményei megmaradjanak.");
    return;
  }

  const confirmed = window.confirm(
    `Biztosan törlöd a(z) „${day.name}” edzésnapot?\n\n` +
      "A naphoz tartozó gyakorlatok és rögzített eredmények is végleg törlődnek."
  );

  if (!confirmed) return;

  setLoading(true);
  setError("");

  try {
    for (const exercise of day.exercises) {
      const { error: deleteError } = await supabase.rpc(
        "coach_delete_client_exercise",
        {
          p_client_id: clientId,
          p_week_number: currentWeek.number,
          p_day_index: activeDay,
          p_exercise_id: exercise.id,
        }
      );

      if (deleteError) throw deleteError;
    }

    const updatedWeek = {
      ...currentWeek,
      days: currentWeek.days.slice(0, -1),
    };

    await saveClientTrainingWeek(clientId, updatedWeek);
    setWeeks((previous) =>
      previous.map((week) =>
        week.id === currentWeek.id ? updatedWeek : week
      )
    );
    setActiveDay(Math.max(0, updatedWeek.days.length - 1));
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Nem sikerült törölni az edzésnapot."
    );

    // Ha a gyakorlatok törlése közben hiba történt, a felhőből
    // visszatöltjük az aktuális állapotot.
    try {
      const updatedWeeks = await loadClientTrainingWeeks(clientId);
      setWeeks(updatedWeeks);
    } catch {
      // Az eredeti mentési hiba maradjon látható.
    }
  } finally {
    setLoading(false);
  }
}

async function moveTrainingDay(direction: -1 | 1) {
  const currentWeek = weeks[activeWeek];
  const targetIndex = activeDay + direction;

  if (
    !currentWeek ||
    loading ||
    selectedWeekHasResults ||
    targetIndex < 0 ||
    targetIndex >= currentWeek.days.length
  ) {
    return;
  }

  const updatedDays = [...currentWeek.days];
  [updatedDays[activeDay], updatedDays[targetIndex]] = [
    updatedDays[targetIndex],
    updatedDays[activeDay],
  ];
  const updatedWeek = { ...currentWeek, days: updatedDays };

  setLoading(true);
  setError("");

  try {
    await saveClientTrainingWeek(clientId, updatedWeek);
    setWeeks((previous) =>
      previous.map((week) =>
        week.id === currentWeek.id ? updatedWeek : week
      )
    );
    setActiveDay(targetIndex);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Nem sikerült módosítani az edzésnapok sorrendjét."
    );
  } finally {
    setLoading(false);
  }
}
async function addSet(exerciseId: string) {
  const currentWeek = weeks[activeWeek];

  if (!currentWeek || loading) return;

  setLoading(true);
  setError("");

  try {
    await addClientTrainingSet(
      clientId,
      currentWeek.number,
      activeDay,
      exerciseId
    );

    const updatedWeeks = await loadClientTrainingWeeks(clientId);
    const results = await loadClientTrainingResults(clientId);
    setTrainingResults(results);

    setWeeks(
      updatedWeeks.map((week) => ({
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
      }))
    );
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Nem sikerült hozzáadni a sorozatot."
    );
  } finally {
    setLoading(false);
  }
}

async function deleteSet(
  exerciseId: string,
  setIndex: number
) {
  const currentWeek = weeks[activeWeek];
  const exercise = currentWeek?.days[activeDay]
    ?.exercises.find((item) => item.id === exerciseId);

  if (!currentWeek || !exercise || loading) return;

  const currentSet = exercise.sets[setIndex];
  if (!currentSet) return;

  const hasResults = Object.values(currentSet).some(
    (value) => value.trim() !== ""
  );

  
const confirmed = window.confirm(
  `Biztosan törlöd a(z) ${setIndex + 1}. sorozatot?\n\n` +
  "A törlés után a vendégnek frissítenie kell " +
  "a megnyitott edzésnaplóját.\n\n" +
  "Lehetőleg ne törölj sorozatot, miközben " +
  "a vendég éppen az edzését rögzíti."
);

  if (!confirmed) return;

  if (hasResults) {
    const confirmedResults = window.confirm(
      "FIGYELEM! Ez a sorozat már tartalmaz eredményeket.\n\n" +
      "A törléssel ezek az eredmények végleg elvesznek.\n" +
      "A többi sorozat eredménye megmarad.\n\n" +
      "Biztosan folytatod?"
    );

    if (!confirmedResults) return;
  }

  setLoading(true);
  setError("");

  try {
    await deleteClientTrainingSet(
      clientId,
      currentWeek.number,
      activeDay,
      exerciseId,
      setIndex
    );

    const [updatedWeeks, results] = await Promise.all([
      loadClientTrainingWeeks(clientId),
      loadClientTrainingResults(clientId),
    ]);
    setTrainingResults(results);

    setWeeks(
      updatedWeeks.map((week) => ({
        ...week,
        days: week.days.map((day, dayIndex) => ({
          ...day,
          exercises: day.exercises.map((item) => ({
            ...item,
            sets: item.sets.map((set, index) => {
              const saved = results.find(
                (result) =>
                  result.week_number === week.number &&
                  result.day_index === dayIndex &&
                  result.exercise_id === item.id &&
                  result.set_index === index
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
      }))
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Nem sikerült törölni a sorozatot."
    );
  } finally {
    setLoading(false);
  }
}
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { data: auth } = await supabase.auth.getUser();

        if (!auth.user) {
          router.replace("/belepes");
          return;
        }

        const { data: coach } = await supabase
          .from("coaches")
          .select("user_id")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        if (!coach) {
          throw new Error("Ehhez az oldalhoz edzői jogosultság szükséges.");
        }

        const { data: connection } = await supabase
          .from("coach_clients")
          .select("id")
          .eq("coach_id", auth.user.id)
          .eq("client_id", clientId)
          .eq("status", "accepted")
          .maybeSingle();

        if (!connection) {
          throw new Error("Ez a vendég nincs hozzád kapcsolva.");
        }

        
const [trainingWeeks, results] = await Promise.all([
  loadClientTrainingWeeks(clientId),
  loadClientTrainingResults(clientId),
]);

const weeksWithResults = trainingWeeks.map((week) => ({
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

if (active) {
  setWeeks(weeksWithResults);
  setTrainingResults(results);
}
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Betöltési hiba."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [clientId, router]);

  async function addClientExercise() {
    if (!selectedWeek || !selectedDay) return;

    const name = window.prompt("Új gyakorlat neve:");
    if (name === null) return;

    if (!name.trim()) {
      window.alert("Add meg a gyakorlat nevét!");
      return;
    }

    const range = window.prompt(
      "Ismétléstartomány (például 8-12):",
      "8-12"
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

    const countInput = window.prompt(
      "Sorozatok száma:",
      "3"
    );
    if (countInput === null) return;

    const setCount = Number(countInput);

    if (
      !Number.isInteger(setCount) ||
      setCount < 1 ||
      setCount > 20
    ) {
      window.alert("A sorozatok száma 1 és 20 között lehet.");
      return;
    }

    const exerciseId = crypto.randomUUID();

    const { error: saveError } = await supabase.rpc(
      "coach_add_client_exercise",
      {
        p_client_id: clientId,
        p_week_number: selectedWeek.number,
        p_day_index: activeDay,
        p_exercise_id: exerciseId,
        p_name: name.trim(),
        p_min_reps: minReps,
        p_max_reps: maxReps,
        p_set_count: setCount,
      }
    );

    if (saveError) {
      window.alert("Mentési hiba: " + saveError.message);
      return;
    }

    const newExercise = {
      id: exerciseId,
      name: name.trim(),
      minReps,
      maxReps,
      sets: Array.from({ length: setCount }, () => ({
        kg: "",
        reps: "",
        rir: "",
      })),
    };

    setWeeks((previous) =>
      previous.map((week) =>
        week.id !== selectedWeek.id
          ? week
          : {
              ...week,
              days: week.days.map((day, dayIndex) =>
                dayIndex !== activeDay
                  ? day
                  : {
                      ...day,
                      exercises: [
                        ...day.exercises,
                        newExercise,
                      ],
                    }
              ),
            }
      )
    );
  }
  
  async function deleteClientExercise(
    weekId: string,
    dayIndex: number,
    exerciseId: string
  ) {
    const week = weeks.find((item) => item.id === weekId);
    const exercise = week?.days[dayIndex]?.exercises.find(
      (item) => item.id === exerciseId
    );

    if (!week || !exercise) return;

    const confirmed = window.confirm(
      `Biztosan törölni szeretnéd ezt a gyakorlatot?\n\n${exercise.name}`
    );

    if (!confirmed) return;

    const hasResults = exercise.sets.some(
      (set) => set.kg || set.reps || set.rir
    );

    if (hasResults) {
      const confirmedResults = window.confirm(
        "FIGYELEM! A vendéged már rögzített eredményeket " +
          "ehhez a gyakorlathoz.\n\n" +
          "A törléssel ezek az adatok is végleg elvesznek.\n\n" +
          "Biztosan folytatod?"
      );

      if (!confirmedResults) return;
    }

    const { error: deleteError } = await supabase.rpc(
      "coach_delete_client_exercise",
      {
        p_client_id: clientId,
        p_week_number: week.number,
        p_day_index: dayIndex,
        p_exercise_id: exerciseId,
      }
    );

    if (deleteError) {
      window.alert("Törlési hiba: " + deleteError.message);
      return;
    }

    // Újratöltjük a legfrissebb felhőadatokat.
    try {
      const updatedWeeks = await loadClientTrainingWeeks(clientId);
      setWeeks(updatedWeeks);
    } catch {
      window.alert(
        "A törlés sikerült, de az oldal frissítése nem. " +
          "Frissítsd az oldalt!"
      );
    }
  }
  async function editClientExercise(
    weekId: string,
    dayIndex: number,
    exerciseId: string
  ) {
    const week = weeks.find((item) => item.id === weekId);
if (!week) return;
    const exercise = week?.days[dayIndex]?.exercises.find(
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

    const { error: saveError } = await supabase.rpc(
      "coach_edit_client_exercise",
      {
        p_client_id: clientId,
        p_week_number: week.number,
        p_day_index: dayIndex,
        p_exercise_id: exerciseId,
        p_name: name.trim(),
        p_min_reps: minReps,
        p_max_reps: maxReps,
      }
    );

    if (saveError) {
      window.alert("Mentési hiba: " + saveError.message);
      return;
    }
    setWeeks((previous) =>
      previous.map((item) =>
        item.id !== weekId
          ? item
          : {
              ...item,
              days: item.days.map((day, index) =>
                index !== dayIndex
                  ? day
                  : {
                      ...day,
                      exercises: day.exercises.map((current) =>
                        current.id !== exerciseId
                          ? current
                          : {
                              ...current,
                              name: name.trim(),
                              minReps,
                              maxReps,
                            }
                      ),
                    }
              ),
            }
      )
    );
  }
  return (
    <main className="brand-shell min-h-screen p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/edzoi" className="text-[#d8b96e]">
          ← Vissza a vendégeimhez
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-[#d8b96e]">
          Vendég edzéstervének szerkesztése
        </h1>

        {loading && <p className="mt-6">Betöltés...</p>}

        {error && (
          <p className="mt-6 text-red-400">{error}</p>
        )}

        {!loading && !error && weeks.length === 0 && (
          <p className="mt-6 text-[#aaa]">
            A vendégnek még nincs felhőbe mentett edzésterve.
          </p>
        )}

        
{!loading && !error && selectedWeek && (
  <>
    {/* Hetek */}
    <section className="mt-8 rounded-2xl border border-[#363636] bg-[#1c1c1c] p-4">
      
<div className="mb-5 flex items-center justify-between gap-4">
  <h2 className="text-lg font-bold">
    Edzéshetek
  </h2>

  <button
    type="button"
    onClick={() => void addNewWeek()}
    disabled={loading}
    className="shrink-0 rounded-lg bg-[#d8b96e] px-5 py-3 font-bold text-black hover:bg-[#e8ca84] disabled:opacity-50"
  >
    + Új hét hozzáadása
  </button>
</div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {weeks.map((week, index) => (
          <button
            key={week.id}
            type="button"
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
            {week.number}. hét
          </button>
        ))}
      </div>
    </section>

    {/* Napok */}
    <div className="my-7 flex items-center gap-2">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-2">
      {selectedWeek.days.map((day, index) => (
        <button
          key={index}
          type="button"
          onClick={() => setActiveDay(index)}
          className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold ${
            activeDay === index
              ? "border-[#d8b96e] bg-[#d8b96e] text-black"
              : "border-[#393939] bg-[#202020] text-[#ccc]"
          }`}
        >
          {day.name}
        </button>
      ))}
      </div>
      <button
        type="button"
        onClick={() => void addTrainingDay()}
        disabled={loading}
        className="shrink-0 rounded-xl border border-[#d8b96e] px-4 py-3 text-sm font-semibold text-[#d8b96e] hover:bg-[#d8b96e]/10 disabled:opacity-50"
      >
        + Új edzésnap
      </button>
      <button
        type="button"
        onClick={() => void deleteTrainingDay()}
        disabled={loading || activeDay !== selectedWeek.days.length - 1}
        title={
          activeDay !== selectedWeek.days.length - 1
            ? "A korábbi napok eredményeinek megőrzéséhez csak az utolsó nap törölhető."
            : undefined
        }
        className="shrink-0 rounded-xl border border-red-500 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Edzésnap törlése
      </button>
    </div>
    {activeDay !== selectedWeek.days.length - 1 && (
      <p className="-mt-5 mb-7 text-xs text-[#999]">
        A napok törlése csak az utolsó napnál érhető el, így a korábbi edzésnapok eredményei a helyükön maradnak.
      </p>
    )}
    <div className="-mt-4 mb-7 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void moveTrainingDay(-1)}
        disabled={loading || selectedWeekHasResults || activeDay === 0}
        className="rounded-lg border border-[#555] px-3 py-2 text-sm text-white hover:border-[#d8b96e] disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Nap előrébb
      </button>
      <button
        type="button"
        onClick={() => void moveTrainingDay(1)}
        disabled={loading || selectedWeekHasResults || activeDay === selectedWeek.days.length - 1}
        className="rounded-lg border border-[#555] px-3 py-2 text-sm text-white hover:border-[#d8b96e] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Nap hátrébb →
      </button>
      {selectedWeekHasResults && (
        <p className="text-xs text-[#999]">
          A sorrend rögzített eredményeket tartalmazó héten nem módosítható.
        </p>
      )}
    </div>

    {/* Kiválasztott nap */}
    {selectedDay && (
      <>
        <p className="text-sm text-[#d8b96e]">
          {selectedWeek.number}. hét
        </p>

        <h2 className="mt-1 mb-6 text-xl font-bold">
          {selectedDay.name}
        </h2>

        <div className="space-y-5">
          {selectedDay.exercises.map((exercise) => (
            <section
              key={exercise.id}
              className="overflow-hidden rounded-2xl border border-[#363636] bg-[#1c1c1c]"
            >
              <div className="border-b border-[#333] p-5">
                
<div className="flex items-center justify-between gap-3">
  <h3 className="text-lg font-bold">
    {exercise.name}
  </h3>

<div className="flex items-center gap-2">
  <button
    type="button"
    onClick={() =>
      editClientExercise(
        selectedWeek.id,
        activeDay,
        exercise.id
      )
    }
    className="rounded-lg border border-[#d8b96e] px-3 py-2 text-xs font-semibold text-[#d8b96e] hover:bg-[#d8b96e]/10"
  >
    Szerkesztés
  </button>

  <button
    type="button"
    onClick={() =>
      deleteClientExercise(
        selectedWeek.id,
        activeDay,
        exercise.id
      )
    }
    className="rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10"
  >
    Törlés
  </button>
</div>
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
                  
{exercise.sets.map((set, setIndex) => (
  <div key={setIndex}>
    <div className="grid grid-cols-[36px_1fr_1fr_1fr] items-center gap-2">
      <span className="text-center text-sm font-bold text-[#d8b96e]">
        {setIndex + 1}.
      </span>

      {(["kg", "reps", "rir"] as const).map((field) => (
        <div
          key={field}
          className="min-w-0 rounded-lg border border-[#444] bg-[#292929] px-2 py-3 text-center text-base text-white"
        >
          {set[field] || "—"}
        </div>
      ))}
    </div>

    <div className="mt-2 flex justify-end">
      <button
        type="button"
        onClick={() => void deleteSet(exercise.id, setIndex)}
        disabled={loading}
        className="rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-40"
      >
        Sorozat törlése
      </button>
    </div>
  </div>
))}
                </div>
                
<button
  type="button"
  onClick={() => void addSet(exercise.id)}
  disabled={loading}
  className="mt-5 w-full rounded-xl border border-dashed border-[#d8b96e] py-3 text-sm font-semibold text-[#d8b96e] hover:bg-[#d8b96e]/10 disabled:opacity-40"
>
  + Új sorozat
</button>
              </div>
            </section>
          ))}
        </div>
        
        <button
          type="button"
          onClick={addClientExercise}
          className="mt-5 w-full rounded-xl border border-[#d8b96e] bg-[#d8b96e]/10 px-5 py-4 font-bold text-[#d8b96e] hover:bg-[#d8b96e]/20"
        >
          + Gyakorlat hozzáadása
        </button>
      </>
    )}
  </>
)}
      </div>
    </main>
  );
}
