"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabase/supabaseClient";

export default function SignupPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const user = data.user;

    if (user) {
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: user.id,
          username,
        },
      ]);

      if (profileError) {
        setMessage(profileError.message);
        return;
      }
    }

    setMessage("Account created successfully.");

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center">Sign Up</h1>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <button
            type="submit"
            className="bg-green-500 hover:bg-green-600 px-4 py-3 rounded-lg font-semibold transition"
          >
            Create Account
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-center text-zinc-300">{message}</p>
        )}

        <p className="mt-6 text-sm text-zinc-400 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-green-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}