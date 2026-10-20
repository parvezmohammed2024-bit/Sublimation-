"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-fetches the page when jobs or notifications change (Supabase Realtime).
 * Realtime respects Row Level Security, so each user is only told about rows they may see.
 */
export function LiveRefresh({ tables = "jobs,notifications" }: { tables?: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400); // coalesce bursts
    };
    let channel = supabase.channel("live-" + tables.replace(/,/g, "-"));
    for (const table of tables.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router, tables]);
  return null;
}
