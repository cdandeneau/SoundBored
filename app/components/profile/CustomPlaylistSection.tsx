"use client";

import { useState } from "react";

type PlaylistTrack = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  image_url: string | null;
};

type Props = {
  title: string;
  tracks: PlaylistTrack[];
  isOwnProfile: boolean;
  onUpdateTitle?: (title: string) => void;
  onAddTrack?: (track: PlaylistTrack) => void;
  onRemoveTrack?: (spotifyTrackId: string) => void;
};

export default function CustomPlaylistSection({
  title,
  tracks,
  isOwnProfile,
  onUpdateTitle,
  onAddTrack,
  onRemoveTrack,
}: Props) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaylistTrack[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

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

  function selectTrack(t: PlaylistTrack) {
    onAddTrack?.(t);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
  }

  return (
    <div className="rounded-2xl bg-zinc-900 p-5 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-lg font-bold text-white outline-none"
              autoFocus
            />
            <button
              onClick={() => {
                onUpdateTitle?.(titleDraft.trim());
                setEditingTitle(false);
              }}
              className="rounded bg-green-500 px-2 py-1 text-xs font-semibold text-black"
            >
              Save
            </button>
            <button
              onClick={() => setEditingTitle(false)}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{title}</h2>
            {isOwnProfile && (
              <button
                onClick={() => {
                  setTitleDraft(title);
                  setEditingTitle(true);
                }}
                className="text-zinc-400 hover:text-zinc-200"
              >
                ✎
              </button>
            )}
          </div>
        )}

        {isOwnProfile && !editingTitle && (
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {showSearch ? "Close" : "Add Song"}
          </button>
        )}
      </div>

      {showSearch && (
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

      <div className="space-y-2">
        {tracks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-4 text-center text-sm text-zinc-400">
            {isOwnProfile
              ? "Add songs to this playlist."
              : "No songs in this playlist yet."}
          </div>
        ) : (
          tracks.map((track, idx) => (
            <div
              key={`${track.spotify_track_id}-${idx}`}
              className="flex items-center gap-3 rounded-lg bg-zinc-800/60 p-3"
            >
              {track.image_url ? (
                <img
                  src={track.image_url}
                  alt={track.track_name}
                  className="h-12 w-12 rounded object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded bg-zinc-700" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {track.track_name}
                </p>
                <p className="truncate text-xs text-zinc-400">
                  {track.artist_name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {track.spotify_track_id && (
                  <a
                    href={`https://open.spotify.com/track/${track.spotify_track_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-400 hover:underline"
                  >
                    Spotify
                  </a>
                )}
                {isOwnProfile && (
                  <button
                    onClick={() => onRemoveTrack?.(track.spotify_track_id)}
                    className="rounded border border-red-700 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
