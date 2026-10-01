"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type DayType = "Edzésnap" | "Pihenőnap";

type Supplement = {
  id: string;
  client_id: string;
  when_label: string;
  day_type: DayType;
  supplement_name: string;
  brand: string;
  form: string;
  dose: string;
  unit: string;
  purpose: string;
};

type SupplementDraft = Omit<Supplement, "id"> & { id: string | null; rowKey: string };

const columns: { key: keyof Omit<Supplement, "id" | "client_id">; label: string; width: string }[] = [
  { key: "when_label", label: "Mikor?", width: "min-w-36" },
  { key: "day_type", label: "Edzés nap vagy Pihenőnap", width: "min-w-48" },
  { key: "supplement_name", label: "Kiegészítő neve", width: "min-w-44" },
  { key: "brand", label: "Márkája", width: "min-w-36" },
  { key: "form", label: "Formája", width: "min-w-36" },
  { key: "dose", label: "Adag", width: "min-w-28" },
  { key: "unit", label: "Mértékegység", width: "min-w-36" },
  { key: "purpose", label: "Célja", width: "min-w-48" },
];

const inputClass =
  "w-full rounded-lg border border-[#444] bg-[#111] px-3 py-2 text-sm text-white outline-none transition focus:border-[#d8b96e]";

function newDraft(clientId: string): SupplementDraft {
  return {
    id: null,
    rowKey: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    client_id: clientId,
    when_label: "",
    day_type: "Edzésnap",
    supplement_name: "",
    brand: "",
    form: "",
    dose: "",
    unit: "",
    purpose: "",
  };
}

export default function ClientSupplementsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const [viewerRole, setViewerRole] = useState<"client" | "coach" | "">("");
  const [clientName, setClientName] = useState("");
  const [rows, setRows] = useState<SupplementDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pendingSaves = useRef(new Map<string, Promise<void>>());
  const persistedIds = useRef(new Map<string, string>());

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.replace("/belepes");
        return;
      }

      const user = authData.user;
      const isClient = user.id === clientId;
      if (!isClient) {
        const { data: connection, error: connectionError } = await supabase
          .from("coach_clients")
          .select("id")
          .eq("coach_id", user.id)
          .eq("client_id", clientId)
          .eq("status", "accepted")
          .maybeSingle();
        if (connectionError) throw connectionError;
        if (!connection) throw new Error("Ehhez a vendéghez nincs aktív hozzáférésed.");
      }

      const [profileResult, supplementsResult] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", clientId).maybeSingle(),
        supabase
          .from("client_supplements")
          .select("id, client_id, when_label, day_type, supplement_name, brand, form, dose, unit, purpose")
          .eq("client_id", clientId)
          .order("created_at", { ascending: true }),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (supplementsResult.error) throw supplementsResult.error;

      setViewerRole(isClient ? "client" : "coach");
      setClientName(profileResult.data?.full_name?.trim() || "Vendég");
      setRows(((supplementsResult.data ?? []) as Supplement[]).map((row) => ({ ...row, rowKey: row.id })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nem sikerült betölteni a listát.");
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  function updateRow(rowKey: string, key: keyof SupplementDraft, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.rowKey === rowKey ? { ...row, [key]: value } : row
      )
    );
  }

  function handleFieldChange(rowKey: string, key: keyof SupplementDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      updateRow(rowKey, key, event.target.value);
  }

  async function saveRow(row: SupplementDraft) {
    setSavingId(row.rowKey);
    setError("");
    setMessage("");
    const { id: _id, rowKey: _rowKey, ...values } = row;
    const normalized = {
      ...values,
      when_label: values.when_label.trim(),
      supplement_name: values.supplement_name.trim(),
      brand: values.brand.trim(),
      form: values.form.trim(),
      dose: values.dose.trim(),
      unit: values.unit.trim(),
      purpose: values.purpose.trim(),
    };

    try {
      const rowId = row.id ?? persistedIds.current.get(row.rowKey) ?? null;
      if (rowId) {
        const { error: saveError } = await supabase
          .from("client_supplements")
          .update(normalized)
          .eq("id", rowId)
          .eq("client_id", clientId);
        if (saveError) throw saveError;
      } else {
        const { data, error: saveError } = await supabase
          .from("client_supplements")
          .insert(normalized)
          .select("id, client_id, when_label, day_type, supplement_name, brand, form, dose, unit, purpose")
          .single();
        if (saveError) throw saveError;
        persistedIds.current.set(row.rowKey, data.id);
        setRows((current) => current.map((item) => item.rowKey === row.rowKey ? { ...data as Supplement, rowKey: data.id } : item));
      }
      setMessage("A módosítás automatikusan elmentve.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nem sikerült elmenteni a sort.");
    } finally {
      setSavingId((current) => current === row.rowKey ? null : current);
    }
  }

  function autoSaveRow(row: SupplementDraft) {
    const previous = pendingSaves.current.get(row.rowKey) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => saveRow(row));
    pendingSaves.current.set(row.rowKey, next);
    void next.finally(() => {
      if (pendingSaves.current.get(row.rowKey) === next) {
        pendingSaves.current.delete(row.rowKey);
      }
    });
  }

  async function deleteRow(row: SupplementDraft) {
    const pendingSave = pendingSaves.current.get(row.rowKey);
    if (pendingSave) await pendingSave;
    const rowId = row.id ?? persistedIds.current.get(row.rowKey) ?? null;

    if (!rowId) {
      setRows((current) => current.filter((item) => item.rowKey !== row.rowKey));
      return;
    }
    if (!window.confirm("Biztosan törlöd ezt a kiegészítőt?")) return;

    setDeletingId(rowId);
    setError("");
    setMessage("");
    const { error: deleteError } = await supabase
      .from("client_supplements")
      .delete()
      .eq("id", rowId)
      .eq("client_id", clientId);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message || "Nem sikerült törölni a sort.");
      return;
    }
    persistedIds.current.delete(row.rowKey);
    setRows((current) => current.filter((item) => item.rowKey !== row.rowKey));
    setMessage("A sor törölve.");
  }

  return (
    <main className="brand-shell min-h-screen p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <Link
          href={viewerRole === "coach" ? "/edzoi" : "/naplo"}
          className="inline-block text-[#d8b96e] hover:underline"
        >
          {viewerRole === "coach" ? "← Vissza a vendégeimhez" : "← Vissza a naplóhoz"}
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold text-[#d8b96e]">Táplálékkiegészítők</h1>
          {clientName && <p className="mt-2 text-[#bbb]">{clientName} listája</p>}
          <p className="mt-2 text-sm text-[#aaa]">A vendég és az edző közösen szerkesztheti ezt a listát.</p>
        </header>

        <section className="mt-6 rounded-3xl border border-[#d8b96e]/25 bg-[#1c1c1c]/95 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[#d8b96e]">Kiegészítők listája</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessage("");
                  setError("");
                  setRows((current) => [...current, newDraft(clientId)]);
                }}
                disabled={loading || !viewerRole}
                className="rounded-lg bg-[#d8b96e] px-4 py-2 font-semibold text-black transition hover:bg-[#e7ca80] disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Új sor
              </button>
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-center text-[#aaa]">Lista betöltése...</p>
          ) : error && !rows.length ? (
            <p role="alert" className="py-8 text-center text-red-400">{error}</p>
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-[#444] p-6 text-center text-[#aaa]">
              Még nincs felvett táplálékkiegészítő. Az „Új sor” gombbal hozzáadhatsz egyet.
            </p>
          ) : (
            <div className="supplements-table-scroll overflow-x-auto rounded-xl border border-[#444]">
              <table className="w-full min-w-[1450px] border-collapse text-left text-sm">
                <thead className="bg-[#29261e] text-[#d8b96e]">
                  <tr>
                    {columns.map((column) => (
                      <th key={column.key} className={`px-3 py-3 font-semibold ${column.width}`}>
                        {column.label}
                      </th>
                    ))}
                    <th className="min-w-44 px-3 py-3 font-semibold">Műveletek</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rowKey} className="border-t border-[#444] align-top">
                      {columns.map((column) => (
                        <td key={column.key} className="px-2 py-2">
                          {column.key === "day_type" ? (
                            <select
                              value={row.day_type}
                              onChange={handleFieldChange(row.rowKey, column.key)}
                              onBlur={() => autoSaveRow(row)}
                              className={inputClass}
                              aria-label={column.label}
                            >
                              <option>Edzésnap</option>
                              <option>Pihenőnap</option>
                            </select>
                          ) : (
                            <input
                              value={row[column.key]}
                              onChange={handleFieldChange(row.rowKey, column.key)}
                              onBlur={() => autoSaveRow(row)}
                              className={inputClass}
                              aria-label={column.label}
                              placeholder={column.label}
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        <div className="flex gap-2">
                          <span role="status" className="self-center whitespace-nowrap text-xs text-[#aaa]">
                            {savingId === row.rowKey ? "Mentés..." : row.id ? "Elmentve" : "Automatikus mentés"}
                          </span>
                          <button
                            type="button"
                            onClick={() => void deleteRow(row)}
                            disabled={savingId !== null || deletingId !== null}
                            className="rounded-lg border border-red-400/70 px-3 py-2 font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
                          >
                            {row.id !== null && deletingId === row.id ? "Törlés..." : "Törlés"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(error && rows.length > 0) && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
          {message && <p role="status" className="mt-4 text-sm text-emerald-400">{message}</p>}
        </section>
      </div>
    </main>
  );
}
