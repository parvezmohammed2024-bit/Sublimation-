import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type AdminState = "loading" | "out" | "admin";

/** Signed in with Supabase Auth AND listed in subli_admins. */
export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>("loading");
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) { if (alive) setState("out"); return; }
      const { data: row } = await supabase.from("subli_admins").select("user_id").eq("user_id", uid).maybeSingle();
      if (alive) setState(row ? "admin" : "out");
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { setTimeout(check, 0); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return state;
}
