"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function MySupplementsPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function openOwnList() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        router.replace("/belepes");
        return;
      }
      router.replace(`/edzoi/taplalekkiegeszitok/${data.user.id}`);
    }
    void openOwnList();
    return () => {
      active = false;
    };
  }, [router]);

  return <main className="brand-shell min-h-screen p-6 text-white">Táplálékkiegészítők megnyitása...</main>;
}
