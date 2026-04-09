"use client";

import Link from "next/link";

type TopNavProps = {
  showMyProfile?: boolean;
  myProfileUsername?: string | null;
  showFeed?: boolean;
  showUsers?: boolean;
  showRate?: boolean;
  showProfile?: boolean;
  profileUsername?: string | null;
  showLogout?: boolean;
  onLogout?: () => void | Promise<void>;
  myProfileLabel?: string;
};

export default function TopNav({
  showMyProfile = false,
  myProfileUsername = null,
  showFeed = true,
  showUsers = true,
  showRate = true,
  showProfile = false,
  profileUsername = null,
  showLogout = false,
  onLogout,
  myProfileLabel = "My Profile",
}: TopNavProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {showMyProfile && myProfileUsername && (
        <Link
          href={`/profile/${myProfileUsername}`}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          {myProfileLabel}
        </Link>
      )}

      {showFeed && (
        <Link
          href="/feed"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          Feed
        </Link>
      )}

      {showUsers && (
        <Link
          href="/users"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          Find Users
        </Link>
      )}

      {showRate && (
        <Link
          href="/rate"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          Rate a Song
        </Link>
      )}

      {showProfile && profileUsername && (
        <Link
          href={`/profile/${profileUsername}`}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          View Profile
        </Link>
      )}

      {showLogout && onLogout && (
        <button
          onClick={onLogout}
          className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-green-600"
        >
          Log Out
        </button>
      )}
    </div>
  );
}