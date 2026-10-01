
import { supabase } from "./supabase";

export type DailyEntry = {
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

export async function loadDailyEntries(): Promise<
  Record<string, DailyEntry>
> {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Először jelentkezz be!");
  }

  const { data, error } = await supabase
    .from("daily_entries")
    .select("*")
    .eq("user_id", authData.user.id);

  if (error) throw new Error(error.message);

  const entries: Record<string, DailyEntry> = {};

  for (const row of data ?? []) {
    entries[row.entry_date] = {
      weight: String(row.weight ?? ""),
      calories: String(row.calories ?? ""),
      protein: String(row.protein ?? ""),
      carbs: String(row.carbs ?? ""),
      fat: String(row.fat ?? ""),
      sleep: String(row.sleep ?? ""),
      steps: String(row.steps ?? ""),
      cardio: String(row.cardio ?? ""),
      notes: row.notes ?? "",
    };
  }

  return entries;
}

export async function saveDailyEntry(
  date: string,
  entry: DailyEntry
): Promise<void> {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Először jelentkezz be!");
  }

  const toNumber = (value: string) =>
    value.trim() === ""
      ? null
      : Number(value.replace(",", "."));

  const { error } = await supabase
    .from("daily_entries")
    .upsert(
      {
        user_id: authData.user.id,
        entry_date: date,
        weight: toNumber(entry.weight),
        calories: toNumber(entry.calories),
        protein: toNumber(entry.protein),
        carbs: toNumber(entry.carbs),
        fat: toNumber(entry.fat),
        sleep: toNumber(entry.sleep),
        steps: toNumber(entry.steps),
        cardio: toNumber(entry.cardio),
        notes: entry.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entry_date" }
    );

  if (error) throw new Error(error.message);
}