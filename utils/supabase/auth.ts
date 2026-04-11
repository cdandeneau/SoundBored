import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export async function getCurrentUserSafe(): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      return data.user;
    }
  } catch {
    // Fallback below handles transient lock/contention failures.
  }

  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  } catch {
    return null;
  }
}
