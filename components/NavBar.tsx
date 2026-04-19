"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../utils/supabase/supabaseClient";
import { getCurrentUserSafe } from "../utils/supabase/auth";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      try {
        const user = await getCurrentUserSafe();
        if (isMounted) {
          if (user) {
            setIsAuthenticated(true);
            const { data: profile } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", user.id)
              .single();
            setCurrentUsername(profile?.username || null);
          } else {
            setIsAuthenticated(false);
            setCurrentUsername(null);
          }
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      }
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isMounted) {
        if (session?.user) {
          setIsAuthenticated(true);
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", session.user.id)
            .single();
          setCurrentUsername(profile?.username || null);
        } else {
          setIsAuthenticated(false);
          setCurrentUsername(null);
        }
      }
    });
    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-[50] bg-black/50 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center justify-between px-8 py-4 max-w-full gap-6">
        <Link
          href="/"
          className="flex-shrink-0 overflow-hidden hover:opacity-80 transition"
        >
          <Image
            src="/SBLOGO (1).png"
            alt="SoundBored logo"
            width={60}
            height={60}
            className="h-16 w-16 object-contain"
            priority
          />
        </Link>
        {isAuthenticated && !isLoading && (
          <div className="flex items-center gap-4 flex-1 justify-between">
            <Link
              href="/feed"
              className="nav-chip rounded-lg border border-zinc-700 px-4 py-3 text-sm sm:text-base font-semibold text-zinc-300 transition hover:bg-zinc-800 flex-1 text-center"
            >
              Feed
            </Link>
            <Link
              href="/users"
              className="nav-chip rounded-lg border border-zinc-700 px-4 py-3 text-sm sm:text-base font-semibold text-zinc-300 transition hover:bg-zinc-800 flex-1 text-center"
            >
              Find Users
            </Link>
            <Link
              href="/rate"
              className="nav-chip rounded-lg border border-zinc-700 px-4 py-3 text-sm sm:text-base font-semibold text-zinc-300 transition hover:bg-zinc-800 flex-1 text-center"
            >
              Rate a Song
            </Link>
            {currentUsername && (
              <Link
                href={`/profile/${currentUsername}`}
                className="nav-chip rounded-lg border border-zinc-700 px-4 py-3 text-sm sm:text-base font-semibold text-zinc-300 transition hover:bg-zinc-800 flex-1 text-center"
              >
                Profile
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="rounded-lg bg-green-400 px-4 py-3 text-sm sm:text-base font-semibold text-black shadow-[0_10px_24px_rgba(74,222,128,0.22)] transition hover:bg-green-300 flex-1 text-center"
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
