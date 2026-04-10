"use client";

import { useState } from "react";

type VinylTrack = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  image_url: string | null;
};

type Props = {
  title: string;
  track: VinylTrack | null;
  isOwnProfile: boolean;
  onSelectTrack?: (track: VinylTrack) => void;
};

export default function VinylPlayer({
  title,
  track,
  isOwnProfile,
  onSelectTrack,
}: Props) {
  const [isSpinning, setIsSpinning] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VinylTrack[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(searchQuery)}&type=track`
      );
      const data = await res.json();
      setSearchResults(data.tracks || []);
    } catch {
      setSearchResults([]);
    }
    setSearchLoading(false);
  }

  function selectTrack(t: VinylTrack) {
    onSelectTrack?.(t);
    setSearching(false);
    setSearchQuery("");
    setSearchResults([]);
  }

  return (
    <div className="rounded-2xl bg-zinc-900 p-5 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {isOwnProfile && (
          <button
            onClick={() => setSearching(!searching)}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {searching ? "Close" : track ? "Change" : "Pick Song"}
          </button>
        )}
      </div>

      {searching && (
        <div className="mb-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a song..."
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none"
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="rounded-lg bg-green-500 px-3 py-2 text-sm font-semibold text-black hover:bg-green-600 disabled:opacity-60"
            >
              {searchLoading ? "..." : "Search"}
            </button>
          </form>
          {searchResults.length > 0 && (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {searchResults.map((t) => (
                <button
                  key={t.spotify_track_id}
                  onClick={() => selectTrack(t)}
                  className="flex w-full items-center gap-3 rounded-lg bg-zinc-800/60 p-2 text-left hover:bg-zinc-800"
                >
                  {t.image_url && (
                    <img
                      src={t.image_url}
                      alt={t.track_name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {t.track_name}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {t.artist_name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {track ? (
        <div className="flex flex-col items-center">
          <div
            className="relative cursor-pointer"
            onClick={() => setIsSpinning(!isSpinning)}
            title={isSpinning ? "Click to pause" : "Click to spin"}
          >
            <div
              className="relative h-48 w-48 rounded-full bg-zinc-950 shadow-2xl"
              style={
                isSpinning
                  ? { animation: "spin-vinyl 4s linear infinite" }
                  : undefined
              }
            >
              <div className="absolute inset-2 rounded-full border border-zinc-800/50" />
              <div className="absolute inset-5 rounded-full border border-zinc-800/30" />
              <div className="absolute inset-8 rounded-full border border-zinc-800/50" />
              <div className="absolute inset-11 rounded-full border border-zinc-800/30" />

              <div className="absolute inset-[3rem] overflow-hidden rounded-full ring-1 ring-zinc-700">
                {track.image_url ? (
                  <img
                    src={track.image_url}
                    alt={track.track_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-2xl font-bold text-green-400">
                    ♪
                  </div>
                )}
              </div>

              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-950 ring-1 ring-zinc-600" />
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="font-semibold text-white">{track.track_name}</p>
            <p className="text-sm text-zinc-400">{track.artist_name}</p>
          </div>

          {track.spotify_track_id && (
            <a
              href={`https://open.spotify.com/track/${track.spotify_track_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-xs text-green-400 hover:underline"
            >
              Listen on Spotify
            </a>
          )}
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400">
          {isOwnProfile
            ? "Pick a song to display vinyl"
            : "No song selected"}
        </div>
      )}
    </div>
  );
}
