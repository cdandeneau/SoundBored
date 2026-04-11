
// VinylPlayer component: renders a customizable vinyl or CD player UI with Spotify integration.
// Allows users to pick tracks, customize colors, and play previews using the Spotify IFrame API.
"use client";

import { useState, useRef, useEffect, useCallback } from "react";


// Represents a track that can be played in the vinyl/CD player
type VinylTrack = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  image_url: string | null;
  preview_url?: string | null;
};


// Color palette for the player UI
type PlayerColors = {
  body: string;
  bodyshadow: string;
  accent: string;
  toneArm: string;
  button: string;
  buttonBorder: string;
};

// Default color scheme for vinyl player
const DEFAULT_COLORS: PlayerColors = {
  body: "#d52f31",
  bodyshadow: "#be272a",
  accent: "#ff8e00",
  toneArm: "#ffffff",
  button: "#ed5650",
  buttonBorder: "#be272a",
};

// Default color scheme for CD player
const CD_DEFAULT_COLORS: PlayerColors = {
  body: "#e8e4e0",
  bodyshadow: "#c8c4c0",
  accent: "#2c2c2c",
  toneArm: "#1a1a1a",
  button: "#3a3a3a",
  buttonBorder: "#555555",
};


// Props for the VinylPlayer component
type Props = {
  title: string;
  track: VinylTrack | null;
  variant?: "vinyl" | "cd";
  colors?: Partial<PlayerColors>;
  isOwnProfile: boolean;
  canCustomize?: boolean;
  outerBackgroundColor?: string;
  onSelectTrack?: (track: VinylTrack) => void;
  onUpdateColors?: (colors: PlayerColors) => void;
};

// Main component function
export default function VinylPlayer({
  title,
  track,
  variant = "vinyl",
  colors: colorsProp,
  isOwnProfile,
  canCustomize = false,
  outerBackgroundColor,
  onSelectTrack,
  onUpdateColors,
}: Props) {

  // Merge default and custom colors
  const defaults = variant === "cd" ? CD_DEFAULT_COLORS : DEFAULT_COLORS;
  const colors = { ...defaults, ...colorsProp };

  // Player state
  const [isPlaying, setIsPlaying] = useState(false); // Is the track currently playing
  const [isSpinning, setIsSpinning] = useState(false); // Is the vinyl/CD spinning (for animation)
  const [speed, setSpeed] = useState(0.7); // Animation speed
  const [searching, setSearching] = useState(false); // Show track search UI
  const [showColors, setShowColors] = useState(false); // Show color customizer
  const [searchQuery, setSearchQuery] = useState(""); // Track search input
  const [searchResults, setSearchResults] = useState<VinylTrack[]>([]); // Track search results
  const [searchLoading, setSearchLoading] = useState(false); // Track search loading state

  // Refs for Spotify IFrame API and current track
  const embedRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<{ togglePlay: () => void; loadUri: (uri: string) => void } | null>(null);
  const apiReadyRef = useRef(false);
  const trackIdRef = useRef(track?.spotify_track_id);

  // Keep trackIdRef in sync with current track
  trackIdRef.current = track?.spotify_track_id;

  // Create the Spotify embed controller for a given track
  const createEmbed = useCallback((trackId: string) => {
    if (!embedRef.current) return;
    const win = window as unknown as Record<string, unknown>;
    const IFrameAPI = win.SpotifyIframeApi as {
      createController: (
        el: HTMLElement,
        opts: { uri: string; height: number; theme: number },
        cb: (ctrl: { togglePlay: () => void; loadUri: (uri: string) => void }) => void
      ) => void;
    } | undefined;
    if (!IFrameAPI) return;
    embedRef.current.innerHTML = "";
    controllerRef.current = null;
    IFrameAPI.createController(
      embedRef.current,
      { uri: `spotify:track:${trackId}`, height: 80, theme: 0 },
      (ctrl) => {
        controllerRef.current = ctrl;
      }
    );
  }, []);

  // Load the Spotify IFrame API script once on mount
  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;
    if (win.SpotifyIframeApi) {
      apiReadyRef.current = true;
      if (trackIdRef.current) createEmbed(trackIdRef.current);
      return;
    }
    if (document.getElementById("spotify-iframe-api")) {
      const prev = win.onSpotifyIframeApiReady as ((api: unknown) => void) | undefined;
      win.onSpotifyIframeApiReady = (api: unknown) => {
        win.SpotifyIframeApi = api;
        apiReadyRef.current = true;
        prev?.(api);
        if (trackIdRef.current) createEmbed(trackIdRef.current);
      };
      return;
    }
    win.onSpotifyIframeApiReady = (api: unknown) => {
      win.SpotifyIframeApi = api;
      apiReadyRef.current = true;
      if (trackIdRef.current) createEmbed(trackIdRef.current);
    };
    const script = document.createElement("script");
    script.id = "spotify-iframe-api";
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    document.body.appendChild(script);
  }, [createEmbed]);

  // Update embed when the track changes
  useEffect(() => {
    if (!apiReadyRef.current || !track) return;
    if (controllerRef.current) {
      controllerRef.current.loadUri(`spotify:track:${track.spotify_track_id}`);
    } else {
      createEmbed(track.spotify_track_id);
    }
    setIsPlaying(false);
  }, [track?.spotify_track_id, createEmbed]);

  // Toggle play/pause for the current track
  function togglePlay() {
    if (controllerRef.current) {
      controllerRef.current.togglePlay();
      setIsPlaying((p) => !p);
    }
  }

  // Search for tracks using the Spotify search API route
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

  // Select a track from search results
  function selectTrack(t: VinylTrack) {
    onSelectTrack?.(t);
    setSearching(false);
    setSearchQuery("");
    setSearchResults([]);
  }

  // Update a color in the player palette
  function updateColor(key: keyof PlayerColors, value: string) {
    onUpdateColors?.({ ...colors, [key]: value });
  }

  // UI helpers
  const isVinyl = variant === "vinyl";
  const shouldSpin = isSpinning || isPlaying;
  // Only show customization controls if the user owns the profile and can customize
  const showCustomizeControls = isOwnProfile && canCustomize;

  // Hide customization UIs when not allowed
  useEffect(() => {
    if (!showCustomizeControls) {
      setShowColors(false);
      setSearching(false);
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [showCustomizeControls]);

  return (
    <div className="h-full rounded-2xl p-5 shadow-lg" style={outerBackgroundColor ? { backgroundColor: outerBackgroundColor } : { backgroundColor: "#18181b" }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="flex gap-2">
          {showCustomizeControls && (
            <>
              <button
                onClick={() => { setShowColors(!showColors); setSearching(false); }}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {showColors ? "Close" : "Colors"}
              </button>
              <button
                onClick={() => { setSearching(!searching); setShowColors(false); }}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {searching ? "Close" : track ? "Change" : "Pick Song"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Color customizer */}
      {showColors && showCustomizeControls && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {(isVinyl
            ? ([
                ["body", "Body"],
                ["bodyshadow", "Shadow"],
                ["accent", "Label"],
                ["toneArm", "Tone Arm"],
                ["button", "Button"],
                ["buttonBorder", "Btn Border"],
              ] as [keyof PlayerColors, string][])
            : ([
                ["body", "Case"],
                ["bodyshadow", "Border"],
                ["accent", "Mechanism"],
                ["toneArm", "Lid"],
                ["button", "Buttons"],
                ["buttonBorder", "Btn Ring"],
              ] as [keyof PlayerColors, string][])
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="color"
                value={(colors as Record<string, string>)[key]}
                onChange={(e) => updateColor(key, e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-zinc-600 bg-transparent"
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {/* Search */}
      {searching && showCustomizeControls && (
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
        <div className="flex flex-col items-center gap-4">
          {isVinyl ? (
            /* ───── Record Player ───── */
            <div
              className="relative mx-auto rounded-lg"
              style={{
                width: 300,
                height: 165,
                backgroundColor: colors.body,
                boxShadow: `0 6px 0 0 ${colors.bodyshadow}`,
              }}
            >
              {/* Record disc */}
              <div
                className="absolute flex items-center justify-center rounded-full"
                style={{
                  width: 145,
                  height: 145,
                  backgroundColor: "#181312",
                  top: 10,
                  left: 16,
                  animation: shouldSpin ? `spin-vinyl ${3 / Math.max(speed, 0.1)}s linear infinite` : undefined,
                }}
              >
                {/* grooves */}
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 115,
                    height: 115,
                    border: "4px solid transparent",
                    borderTopColor: "#2c2424",
                    borderBottomColor: "#2c2424",
                  }}
                />
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 80,
                    height: 80,
                    border: "4px solid transparent",
                    borderTopColor: "#2c2424",
                    borderBottomColor: "#2c2424",
                  }}
                />

                {/* label — album art or colored circle */}
                <div
                  className="relative z-10 overflow-hidden rounded-full"
                  style={{
                    width: 55,
                    height: 55,
                    backgroundColor: colors.accent,
                  }}
                >
                  {track.image_url ? (
                    <img
                      src={track.image_url}
                      alt={track.track_name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  {/* center hole */}
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: 12,
                      height: 12,
                      backgroundColor: "#181312",
                    }}
                  />
                </div>
              </div>

              {/* Tone arm */}
              <div
                className="absolute"
                style={{
                  width: 5,
                  height: 75,
                  backgroundColor: colors.toneArm,
                  top: 20,
                  right: 90,
                  transformOrigin: "top",
                  transform: isPlaying ? "rotate(30deg)" : "rotate(0deg)",
                  transition: "transform 1s",
                }}
              >
                {/* pivot knob — outer ring */}
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: "#2c2c2c",
                    top: -15,
                    left: -12.5,
                  }}
                >
                  {/* pivot knob — inner circle */}
                  <div
                    className="absolute rounded-full"
                    style={{
                      width: 14,
                      height: 14,
                      backgroundColor: "#181312",
                      top: 8,
                      left: 8,
                    }}
                  />
                </div>
                {/* lower arm segment */}
                <div
                  className="absolute"
                  style={{
                    width: 5,
                    height: 35,
                    backgroundColor: colors.toneArm,
                    transformOrigin: "top",
                    transform: "rotate(30deg)",
                    top: 73,
                    left: 0,
                  }}
                >
                  {/* stylus head — at end of lower arm */}
                  <div
                    style={{
                      position: "absolute",
                      width: 10,
                      height: 0,
                      borderTop: "15px solid #b2aea6",
                      borderLeft: "2px solid transparent",
                      borderRight: "2px solid transparent",
                      bottom: -14,
                      left: -4,
                    }}
                  />
                </div>
              </div>

              {/* Play button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="absolute cursor-pointer rounded-full outline-none"
                style={{
                  width: 23,
                  height: 23,
                  backgroundColor: colors.button,
                  border: `3px solid ${colors.buttonBorder}`,
                  bottom: 12,
                  right: 25,
                }}
              />

              {/* Speed slider */}
              <div
                className="absolute flex items-center justify-center rounded"
                style={{
                  left: 249,
                  top: 15,
                  width: 28,
                  height: 100,
                  backgroundColor: colors.button,
                  border: `3px solid ${colors.buttonBorder}`,
                }}
              >
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="record-player-slider"
                  style={{
                    transform: "rotate(-90deg)",
                    width: 75,
                    height: 6,
                    appearance: "none",
                    WebkitAppearance: "none",
                    backgroundColor: colors.bodyshadow,
                    outline: "none",
                    borderRadius: 3,
                    border: `4px solid ${colors.body}`,
                  }}
                />
              </div>
            </div>
          ) : (
            /* ───── Wall-mounted CD Player ───── */
            <div
              className="relative mx-auto cursor-pointer overflow-hidden"
              onClick={() => setIsSpinning((s) => !s)}
              title={shouldSpin ? "Click to stop spinning" : "Click to spin"}
              style={{
                width: 220,
                height: 220,
                backgroundColor: colors.body,
                borderRadius: 20,
                border: `3px solid ${colors.bodyshadow}`,
                boxShadow: `0 4px 12px rgba(0,0,0,0.3)`,
              }}
            >
              {/* Textured dots around edge */}
              <div
                className="absolute inset-2 rounded-2xl"
                style={{
                  backgroundImage: `radial-gradient(${colors.bodyshadow} 1px, transparent 1px)`,
                  backgroundSize: "8px 8px",
                  opacity: 0.3,
                  pointerEvents: "none",
                }}
              />

              {/* CD disc */}
              <div
                className="cd-disc absolute"
                style={{
                  width: 150,
                  height: 150,
                  top: 25,
                  left: 35,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  animation: shouldSpin ? "spin-vinyl 4s linear infinite" : undefined,
                }}
              />

              {/* CD mechanism — wide rounded panel with motor hub */}
              <div
                className="absolute overflow-hidden"
                style={{
                  backgroundColor: colors.accent,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                  top: 68,
                  left: 35,
                  width: 75,
                  height: 60,
                  borderRadius: "6px",
                }}
              >
                {/* Texture on mechanism */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `radial-gradient(${colors.toneArm}33 1px, transparent 1px)`,
                    backgroundSize: "6px 6px",
                    opacity: 0.4,
                    pointerEvents: "none",
                  }}
                />
                {/* Laser lens */}
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: "#111",
                    border: `2px solid ${colors.toneArm}`,
                    top: 25,
                    left: 14,
                  }}
                />
              </div>

              {/* Motor hub / spindle circle — centered over CD hole */}
              <div
                className="absolute rounded-full"
                style={{
                  width: 34,
                  height: 34,
                  backgroundColor: colors.accent,
                  border: `3px solid ${colors.toneArm}`,
                  top: 83,
                  left: 93,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.4), inset 0 1px 3px rgba(0,0,0,0.3)",
                }}
              >
                {/* Inner spindle */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: colors.toneArm,
                  }}
                />
              </div>

              {/* Play button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="absolute cursor-pointer rounded-full outline-none"
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: isPlaying || isSpinning ? colors.button : colors.buttonBorder,
                  border: `2px solid ${colors.buttonBorder}`,
                  bottom: 12,
                  right: 14,
                }}
              />

              {/* Stop button */}
              <div
                className="absolute rounded-full"
                style={{
                  width: 14,
                  height: 14,
                  backgroundColor: colors.button,
                  border: `2px solid ${colors.buttonBorder}`,
                  bottom: 14,
                  right: 42,
                }}
              />
            </div>
          )}

          {/* Spotify embed player */}
          <div className="w-full overflow-hidden rounded-xl" ref={embedRef} />
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400">
          {isOwnProfile
            ? `Pick a song to display ${isVinyl ? "record player" : "CD"}`
            : "No song selected"}
        </div>
      )}
    </div>
  );
}
