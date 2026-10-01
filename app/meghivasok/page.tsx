
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Invitation = {
  id: string;
  coach_id: string;
  status: string;
};

export default function InvitationsPage() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [coachNames, setCoachNames] = useState<
  Record<string, string>
>({});
  
const [inviteCode, setInviteCode] = useState("");
const [joining, setJoining] = useState(false);
const [joinMessage, setJoinMessage] = useState("");
  

async function joinCoach() {
  const code = inviteCode.trim();

  if (!code) {
    setJoinMessage("Először add meg a meghívókódot!");
    return;
  }

  setJoining(true);
  setJoinMessage("");

  try {
    const { data, error } = await supabase.rpc(
      "redeem_coach_invite",
      { invite_code: code }
    );

    if (error) {
      throw error;
    }

    setJoinMessage(data ?? "Sikeres csatlakozás!");
    setInviteCode("");

    // Frissítjük a meghívások listáját.
    
const {
  data: { user },
  error: authError,
} = await supabase.auth.getUser();

if (authError || !user) {
  throw new Error("Jelentkezz be újra!");
}

const { data: updatedInvitations, error: refreshError } =
  await supabase
    .from("coach_clients")
    .select("id, coach_id, status")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

if (refreshError) {
  throw refreshError;
}

setInvitations(updatedInvitations ?? []);
  } catch (error) {
    setJoinMessage(
      error instanceof Error
        ? error.message
        : "Nem sikerült csatlakozni."
    );
  } finally {
    setJoining(false);
  }
}
async function revokeCoachAccess(id: string) {
  const confirmed = window.confirm(
    "Biztosan megszünteted az edzői kapcsolatot? Az edző ezután nem fér hozzá a naplóidhoz."
  );

  if (!confirmed) return;

  setBusyId(id);
  setMessage("");

  try {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Jelentkezz be újra!");
    }

    const { data, error } = await supabase
      .from("coach_clients")
      .delete()
      .eq("id", id)
      .eq("client_id", authData.user.id)
      .select("id")
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error("A kapcsolat nem található.");
    }

    setInvitations((previous) =>
      previous.filter((item) => item.id !== id)
    );

    setMessage("Az edzői kapcsolat sikeresen megszűnt.");
  } catch (error) {
    setMessage(
      "Hiba: " +
        (error instanceof Error
          ? error.message
          : "Ismeretlen hiba")
    );
  } finally {
    setBusyId("");
  }
}

  useEffect(() => {
    async function loadInvitations() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/belepes");
        return;
      }

      const { data, error } = await supabase
        .from("coach_clients")
        .select("id, coach_id, status")
        .eq("client_id", authData.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setMessage("Betöltési hiba: " + error.message);
      } else {
        setInvitations(data ?? []);
        const coachIds = [
  ...new Set((data ?? []).map((invitation) => invitation.coach_id)),
];

if (coachIds.length > 0) {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", coachIds);

  if (profilesError) {
    console.error("Edzők neveinek betöltése:", profilesError);
  } else {
    const names: Record<string, string> = {};

    for (const profile of profiles ?? []) {
      names[profile.user_id] = profile.full_name;
    }

    setCoachNames(names);
  }
}
      }

      setLoading(false);
    }

    void loadInvitations();
  }, [router]);

  async function acceptInvitation(id: string) {
    setBusyId(id);
    setMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Jelentkezz be újra!");
      }

      const { data, error } = await supabase
        .from("coach_clients")
        .update({ status: "accepted" })
        .eq("id", id)
        .eq("client_id", authData.user.id)
        .eq("status", "pending")
        .select("id")
        .single();

      if (error) throw error;
      if (!data) throw new Error("A meghívás nem található.");

      setInvitations((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, status: "accepted" }
            : item
        )
      );

      setMessage("Meghívás sikeresen elfogadva!");
    } catch (error) {
      setMessage(
        "Hiba: " +
          (error instanceof Error
            ? error.message
            : "Ismeretlen hiba")
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="brand-shell min-h-screen p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-[#d8b96e]">
          ZSL COACHING
        </h1>

        <h2 className="mt-8 text-2xl font-bold">
          Edzői meghívásaim
        </h2>

<section className="mt-6 rounded-2xl border border-[#d8b96e] bg-[#1c1c1c] p-6">
  <h2 className="text-xl font-bold text-[#d8b96e]">
    Csatlakozás edzőhöz
  </h2>

  <p className="mt-2 text-sm text-[#aaa]">
    Add meg az edződtől kapott meghívókódot.
  </p>

  <form
    onSubmit={(event) => {
      event.preventDefault();
      if (!joining) joinCoach();
    }}
    className="mt-5 flex flex-wrap gap-3"
  >
    <input
      type="text"
      value={inviteCode}
      onChange={(event) =>
        setInviteCode(event.target.value.toUpperCase())
      }
      placeholder="Meghívókód"
      maxLength={30}
      required
      className="min-w-0 flex-1 rounded-lg border border-[#555] bg-[#111] px-4 py-3 text-white outline-none focus:border-[#d8b96e]"
    />

    <button
      type="submit"
      disabled={joining}
      className="rounded-lg bg-[#d8b96e] px-6 py-3 font-bold text-black disabled:opacity-50"
    >
      {joining ? "Csatlakozás..." : "Csatlakozás"}
    </button>
  </form>

  {joinMessage && (
    <p role="status" className="mt-4 text-sm text-[#d8b96e]">
      {joinMessage}
    </p>
  )}
</section>

        {loading ? (
          <p className="mt-5 text-[#aaa]">Betöltés...</p>
        ) : invitations.length === 0 ? (
          <p className="mt-5 text-[#aaa]">
            Jelenleg nincs edzői meghívásod.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="rounded-xl border border-[#444] bg-[#1c1c1c] p-5"
              >
                <p className="text-sm text-[#aaa]">
                  Edző neve
                </p>

                <p className="mt-1 break-all text-sm">
                  {coachNames[invitation.coach_id] || invitation.coach_id}
                </p>

                {invitation.status === "pending" ? (
                  <button
                    type="button"
                    disabled={busyId !== ""}
                    onClick={() =>
                      void acceptInvitation(invitation.id)
                    }
                    className="mt-4 rounded-lg bg-[#d8b96e] px-5 py-3 font-semibold text-black disabled:opacity-50"
                  >
                    {busyId === invitation.id
                      ? "Elfogadás..."
                      : "Meghívás elfogadása"}
                  </button>
                ) : (
                  
<div className="mt-4">
  <p className="text-green-400">
    Elfogadott meghívás
  </p>

  <button
    type="button"
    disabled={busyId !== ""}
    onClick={() => void revokeCoachAccess(invitation.id)}
    className="mt-3 rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-400 disabled:opacity-50"
  >
    {busyId === invitation.id
      ? "Feldolgozás..."
      : "Kapcsolat megszüntetése"}
  </button>
</div>
                )}
              </div>
            ))}
          </div>
        )}

        {message && (
          <p role="status" className="mt-5 text-[#d8b96e]">
            {message}
          </p>
        )}

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
