
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function ProfilePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/belepes");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (error) {
        setMessage("Betöltési hiba: " + error.message);
      } else {
        setName(data?.full_name ?? "");
      }

      setLoading(false);
    }

    void loadProfile();
  }, [router]);

  async function saveProfile() {
    const fullName = name.trim();

    if (!fullName) {
      setMessage("Add meg a neved!");
      return;
    }

    if (fullName.length > 100) {
      setMessage("A név legfeljebb 100 karakter lehet.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Jelentkezz be újra!");
      }

      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: authData.user.id,
            full_name: fullName,
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      setName(fullName);
      setMessage("A profilod sikeresen elmentve!");
    } catch (error) {
      setMessage(
        "Mentési hiba: " +
          (error instanceof Error
            ? error.message
            : "Ismeretlen hiba")
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="brand-shell min-h-screen p-6 text-white">
        Profil betöltése...
      </main>
    );
  }

  return (
      <main className="brand-shell min-h-screen p-6 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold text-[#d8b96e]">
          ZSL COACHING
        </h1>

        <section className="mt-8 rounded-2xl border border-[#444] bg-[#1c1c1c] p-6">
          <h2 className="text-2xl font-bold">Profilom</h2>

          <p className="mt-2 text-sm text-[#aaa]">
            Az itt megadott nevedet az elfogadott
            edződ is láthatja.
          </p>

          <label
            htmlFor="fullName"
            className="mt-6 block text-sm text-[#ddd]"
          >
            Teljes név
          </label>

          <input
            id="fullName"
            type="text"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Például: Kovács Péter"
            className="mt-2 w-full rounded-lg border border-[#555] bg-[#292929] p-3 text-white outline-none focus:border-[#d8b96e]"
          />

          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={saving}
            className="mt-5 rounded-lg bg-[#d8b96e] px-6 py-3 font-semibold text-black disabled:opacity-50"
          >
            {saving ? "Mentés..." : "Profil mentése"}
          </button>

          {message && (
            <p role="status" className="mt-4 text-sm text-[#d8b96e]">
              {message}
            </p>
          )}
        </section>

        <Link
          href="/"
          className="mt-8 inline-block text-[#d8b96e]"
        >
          ← Vissza az edzésnaplóhoz
        </Link>
      </div>
    </main>
  );
}
