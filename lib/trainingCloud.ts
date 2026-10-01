
import { supabase } from "./supabase";

export type TrainingSet = {
  kg: string;
  reps: string;
  rir: string;
};

export type TrainingExercise = {
  id: string;
  name: string;
  minReps: number;
  maxReps: number;
  sets: TrainingSet[];
};

export type TrainingDay = {
  name: string;
  exercises: TrainingExercise[];
};


export type TrainingWeek = {
  id: string;
  number: number;
  days: TrainingDay[];
  structureVersion?: number;
};

// A bejelentkezett felhasználó azonosítója.
async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Először jelentkezz be!");
  }

  return data.user.id;
}

// A felhasználó edzésheteinek letöltése.
export async function loadTrainingWeeks(): Promise<TrainingWeek[]> {
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("training_weeks")
    .select("id, week_number, days, structure_version")
    .eq("user_id", userId)
    .order("week_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  
return (data ?? []).map((row) => ({
  id: row.id,
  number: row.week_number,
  days: row.days as TrainingDay[],
  structureVersion: row.structure_version,
}));
}

// Egyetlen edzéshét mentése.
export async function saveTrainingWeek(
  week: TrainingWeek
): Promise<void> {
  const userId = await getUserId();

  const { error } = await supabase
    .from("training_weeks")
    .upsert(
      {
        user_id: userId,
        week_number: week.number,
        days: week.days,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,week_number",
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadClientTrainingWeeks(
  clientId: string
): Promise<TrainingWeek[]> {
  const { data, error } = await supabase
    .from("training_weeks")
    .select("id, week_number, days")
    .eq("user_id", clientId)
    .order("week_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    number: row.week_number,
    days: row.days as TrainingDay[],
  }));
}

// Több edzéshét mentése.
export async function saveTrainingWeeks(
  weeks: TrainingWeek[]
): Promise<void> {
  for (const week of weeks) {
    await saveTrainingWeek(week);
  }
}

export async function saveClientTrainingWeek(
  clientId: string,
  week: TrainingWeek
): Promise<void> {
  const coachId = await getUserId();

  // Ellenőrizzük, hogy a vendég hozzád van-e rendelve.
  const { data: connection, error: connectionError } =
    await supabase
      .from("coach_clients")
      .select("id")
      .eq("coach_id", coachId)
      .eq("client_id", clientId)
      .eq("status", "accepted")
      .maybeSingle();

  if (connectionError) {
    throw new Error(connectionError.message);
  }

  if (!connection) {
    throw new Error(
      "Nincs jogosultságod ennek a vendégnek az edzéstervét szerkeszteni."
    );
  }

  const { error } = await supabase
    .from("training_weeks")
    .upsert(
      {
        user_id: clientId,
        week_number: week.number,
        days: week.days,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,week_number",
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function saveClientExerciseDetails(
  clientId: string,
  weekNumber: number,
  dayIndex: number,
  exerciseId: string,
  changes: {
    name: string;
    minReps: number;
    maxReps: number;
  }
): Promise<void> {
  const coachId = await getUserId();

  const { data: connection, error: connectionError } =
    await supabase
      .from("coach_clients")
      .select("id")
      .eq("coach_id", coachId)
      .eq("client_id", clientId)
      .eq("status", "accepted")
      .maybeSingle();

  if (connectionError) {
    throw new Error(connectionError.message);
  }

  if (!connection) {
    throw new Error("Nincs jogosultságod ehhez a vendéghez.");
  }

  const { data: week, error: loadError } = await supabase
    .from("training_weeks")
    .select("days")
    .eq("user_id", clientId)
    .eq("week_number", weekNumber)
    .single();

  if (loadError) {
    throw new Error(loadError.message);
  }

  const days = week.days as TrainingDay[];

  const updatedDays = days.map((day, index) => {
    if (index !== dayIndex) return day;

    return {
      ...day,
      exercises: day.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              name: changes.name,
              minReps: changes.minReps,
              maxReps: changes.maxReps,
            }
          : exercise
      ),
    };
  });

  const { error: saveError } = await supabase
    .from("training_weeks")
    .update({
      days: updatedDays,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", clientId)
    .eq("week_number", weekNumber);

  if (saveError) {
    throw new Error(saveError.message);
  }
}


export async function saveTrainingResult(
  weekNumber: number,
  dayIndex: number,
  exerciseId: string,
  setIndex: number,
  values: {
    kg: string;
    reps: string;
    rir: string;
  },
  structureVersion: number
): Promise<void> {
  const { error } = await supabase.rpc(
    "save_my_training_result",
    {
      p_week_number: weekNumber,
      p_day_index: dayIndex,
      p_exercise_id: exerciseId,
      p_set_index: setIndex,
      p_structure_version: structureVersion,
      p_kg: values.kg,
      p_reps: values.reps,
      p_rir: values.rir,
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export type TrainingResult = {
  week_number: number;
  day_index: number;
  exercise_id: string;
  set_index: number;
  kg: string;
  reps: string;
  rir: string;
};

export async function loadTrainingResults(): Promise<
  TrainingResult[]
> {
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("training_results")
    .select(
      "week_number, day_index, exercise_id, set_index, kg, reps, rir"
    )
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TrainingResult[];
}

export async function loadClientTrainingResults(
  clientId: string
): Promise<TrainingResult[]> {
  const { data, error } = await supabase
    .from("training_results")
    .select(
      "week_number, day_index, exercise_id, set_index, kg, reps, rir"
    )
    .eq("user_id", clientId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TrainingResult[];
}

export async function saveExerciseOrder(
  weekNumber: number,
  dayIndex: number,
  exerciseIds: string[]
): Promise<void> {
  const { error } = await supabase.rpc(
    "reorder_my_training_exercises",
    {
      p_week_number: weekNumber,
      p_day_index: dayIndex,
      p_exercise_ids: exerciseIds,
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function addClientTrainingSet(
  clientId: string,
  weekNumber: number,
  dayIndex: number,
  exerciseId: string
): Promise<void> {
  const { error } = await supabase.rpc(
    "coach_add_client_set",
    {
      p_client_id: clientId,
      p_week_number: weekNumber,
      p_day_index: dayIndex,
      p_exercise_id: exerciseId,
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteClientTrainingSet(
  clientId: string,
  weekNumber: number,
  dayIndex: number,
  exerciseId: string,
  setIndex: number
): Promise<void> {
  const { error } = await supabase.rpc(
    "coach_delete_client_set",
    {
      p_client_id: clientId,
      p_week_number: weekNumber,
      p_day_index: dayIndex,
      p_exercise_id: exerciseId,
      p_set_index: setIndex,
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}