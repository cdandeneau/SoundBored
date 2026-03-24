"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabase/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    async function loadUserData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email || "");

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (!error && profileData) {
        setUsername(profileData.username);
      }
    }

    loadUserData();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-lg bg-zinc-900 p-8 rounded-2xl shadow-lg text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to SoundBored</h1>
        <p className="text-zinc-300 mb-2">Username: {username}</p>
        <p className="text-zinc-400 mb-6">Email: {email}</p>
        
        <h2 className="text-xl mt-6 text-zinc-300">
        Your music activity will appear here soon 🎧
        </h2>
        <button
          onClick={handleLogout}
          className="bg-green-500 hover:bg-green-600 px-6 py-3 rounded-lg font-semibold transition"
        >
          Log Out
        </button>
      </div>
    </main>
  );
}