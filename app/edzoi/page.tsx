
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function CoachPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");
const [inviteCodeError, setInviteCodeError] = useState("");

async function loadInviteCode(userId: string) {
  setInviteCodeError("");

  const { data, error } = await supabase
    .from("coach_invite_codes")
    .select("code")
    .eq("coach_id", userId)
    .maybeSingle();

  if (error) {
    setInviteCodeError(error.message);
    return;
  }

  if (data) {
    setInviteCode(data.code);
    return;
  }

  const { data: newCode, error: createError } = await supabase
    .from("coach_invite_codes")
    .insert({ coach_id: userId })
    .select("code")
    .single();

  if (createError) {
    setInviteCodeError(createError.message);
    return;
  }

  setInviteCode(newCode.code);
}
type ClientConnection = {
  id: string;
  client_id: string;
  status: "pending" | "accepted";
};

const [clients, setClients] = useState<ClientConnection[]>([]);
const [clientNames, setClientNames] = useState<
  Record<string, string>
>({});

const [clientUid, setClientUid] = useState("");
const [inviteMessage, setInviteMessage] = useState("");
const [inviting, setInviting] = useState(false);
  useEffect(() => {
    async function checkCoach() {
      const { data: authData } =
        await supabase.auth.getUser();

      if (!authData.user) {
        router.replace("/belepes");
        return;
      }

      const { data, error: coachError } =
        await supabase
          .from("coaches")
          .select("user_id")
          .eq("user_id", authData.user.id)
          .maybeSingle();

      if (coachError) {
        setError(coachError.message);
      } else if (!data) {
        setError("Ehhez az oldalhoz edzői jogosultság szükséges.");
      }

else {
    await loadInviteCode(authData.user.id);
  const { data: connections, error: clientsError } =
    await supabase
      .from("coach_clients")
      .select("id, client_id, status")
      .eq("coach_id", authData.user.id)
      .order("created_at", { ascending: false });

  if (clientsError) {
    setError(clientsError.message);
  } else {
    setClients(
      (connections ?? []) as ClientConnection[]
    );
    
const acceptedClientIds = (connections ?? [])
  .filter((client) => client.status === "accepted")
  .map((client) => client.client_id);

if (acceptedClientIds.length > 0) {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", acceptedClientIds);

  const names: Record<string, string> = {};

  for (const profile of profiles ?? []) {
    names[profile.user_id] = profile.full_name;
  }

  setClientNames(names);
  
}
  }
}
      setLoading(false);
    }

    checkCoach();
  }, [router]);

async function inviteClient() {
  const uid = clientUid.trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid)) {
    setInviteMessage("Adj meg egy érvényes vendég UID-t.");
    return;
  }

  setInviting(true);
  setInviteMessage("");

  try {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Jelentkezz be újra!");
    }

    if (uid === authData.user.id) {
      throw new Error("Saját magadat nem hívhatod meg.");
    }

    const { data, error: inviteError } = await supabase
      .from("coach_clients")
      .insert({
        coach_id: authData.user.id,
        client_id: uid,
        status: "pending",
      })
      .select("id, client_id, status")
      .single();

    if (inviteError) throw inviteError;

    setClients((previous) => [
      data as ClientConnection,
      ...previous,
    ]);

    setClientUid("");
    setInviteMessage("Meghívó sikeresen elküldve!");
  } catch (error) {
    setInviteMessage(
      "Meghívási hiba: " +
        (error instanceof Error
          ? error.message
          : "Ismeretlen hiba")
    );
  } finally {
    setInviting(false);
  }
}

  if (loading) {
    return (
      <main className="brand-shell min-h-screen p-8 text-white">
        Jogosultság ellenőrzése...
      </main>
    );
  }

  if (error) {
    return (
      <main className="brand-shell min-h-screen p-8 text-white">
        <p className="text-red-400">{error}</p>
        <Link href="/" className="mt-4 block text-[#d8b96e]">
          Vissza az edzésnaplóhoz
        </Link>
      </main>
    );
  }

  return (
    <main className="brand-shell min-h-screen p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold text-[#d8b96e]">
          ZSL COACHING
        </h1>

        <p className="mt-2 text-[#aaa]">
          Edzői felület
        </p>

        <section className="mt-6 rounded-3xl border border-[#d8b96e]/25 bg-[#1a1a1a]/95 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
  <h2 className="text-xl font-bold text-[#d8b96e]">
    Saját meghívókódom
  </h2>

  <p className="mt-2 text-sm text-[#aaa]">
    Ezt a kódot küldd el a vendégednek, hogy
    csatlakozhasson hozzád.
  </p>

  {inviteCodeError ? (
    <p className="mt-4 text-red-400">
      {inviteCodeError}
    </p>
  ) : inviteCode ? (
    <div className="mt-5 flex flex-wrap items-center gap-4">
      <span className="rounded-lg border border-[#555] bg-[#111] px-5 py-3 text-2xl font-bold tracking-widest text-white">
        {inviteCode}
      </span>

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(inviteCode);
            alert("Meghívókód kimásolva!");
          } catch {
            alert("Nem sikerült kimásolni a kódot.");
          }
        }}
        className="rounded-lg bg-[#d8b96e] px-5 py-3 font-bold text-black hover:bg-[#e8ca84]"
      >
        Másolás
      </button>
    </div>
  ) : (
    <p className="mt-4 text-[#aaa]">
      Meghívókód betöltése...
    </p>
  )}
</section>
        <section className="mt-8 rounded-3xl border border-[#d8b96e]/20 bg-[#1a1a1a]/95 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <h2 className="text-xl font-bold">
            Vendégeim
          </h2>

<div className="mt-5 rounded-xl border border-[#6e6041] bg-[#29251b] p-4">
  <h3 className="text-lg font-semibold text-[#d8b96e]">
    Új vendég meghívása
  </h3>

  <p className="mt-2 text-sm text-[#aaa]">
    Add meg a már regisztrált vendég felhasználói
    azonosítóját (UID).
  </p>

  <form
    onSubmit={(event) => {
      event.preventDefault();
      void inviteClient();
    }}
    className="mt-4 flex flex-col gap-3 sm:flex-row"
  >
    <input
      type="text"
      value={clientUid}
      onChange={(event) => setClientUid(event.target.value)}
      placeholder="Vendég UID"
      aria-label="Vendég UID"
      required
      className="min-w-0 flex-1 rounded-lg border border-[#555] bg-[#1c1c1c] px-4 py-3 text-white outline-none focus:border-[#d8b96e]"
    />

    <button
      type="submit"
      disabled={inviting}
      className="rounded-lg bg-[#d8b96e] px-5 py-3 font-semibold text-black disabled:opacity-50"
    >
      {inviting ? "Meghívás..." : "Meghívó küldése"}
    </button>
  </form>

  {inviteMessage && (
    <p role="status" className="mt-3 text-sm text-[#d8b96e]">
      {inviteMessage}
    </p>
  )}
</div>
          
{clients.length === 0 ? (
  <p className="mt-4 text-[#aaa]">
    Még nincsenek hozzád kapcsolódó vendégek.
  </p>
) : (
  <div className="mt-5 space-y-3">
    {clients.map((client) => (
      <div
        key={client.id}
        className="rounded-xl border border-[#444] bg-[#292929] p-4"
      >
        <p className="text-sm text-[#aaa]">
          Vendég azonosítója
        </p>

        <p className="mt-1 break-all text-sm">
          
{client.status === "accepted" ? (
  <Link
    href={`/vendeg/${client.client_id}`}
    className="font-semibold text-[#d8b96e] hover:underline"
  >
    {clientNames[client.client_id]?.trim() || client.client_id}
  </Link>
) : (
  client.client_id
)}
        </p>

        <p
          className={
            client.status === "accepted"
              ? "mt-3 text-sm text-green-400"
              : "mt-3 text-sm text-[#d8b96e]"
          }
        >
          {client.status === "accepted"
            ? "Elfogadott meghívás"
            : "Meghívás elfogadásra vár"}
        </p>
        
{client.status === "accepted" && (
  <Link
    href={`/edzoi/edzesterv/${client.client_id}`}
    className="ml-2 mt-4 inline-block rounded-lg border border-[#d8b96e] bg-[#d8b96e]/10 px-4 py-2 font-semibold text-[#d8b96e] hover:bg-[#d8b96e]/20"
  >
    Edzésterv szerkesztése
  </Link>
)}
{client.status === "accepted" && (
  <Link
    href={`/edzoi/naplo/${client.client_id}`}
    className="ml-2 mt-4 inline-block rounded-lg border border-[#d8b96e] bg-[#d8b96e]/10 px-4 py-2 font-semibold text-[#d8b96e] hover:bg-[#d8b96e]/20"
  >
    Napi napló megtekintése
  </Link>
)}
{client.status === "accepted" && (
  <Link
    href={`/edzoi/taplalekkiegeszitok/${client.client_id}`}
    className="ml-2 mt-4 inline-block rounded-lg border border-[#d8b96e] bg-[#d8b96e]/10 px-4 py-2 font-semibold text-[#d8b96e] hover:bg-[#d8b96e]/20"
  >
    Táplálékkiegészítők
  </Link>
)}
      </div>
    ))}
  </div>
)}
        </section>


      </div>
    </main>
  );
}
