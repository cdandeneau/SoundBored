"use client";

import NoteRating from "./NoteRating";

type MusicReviewCardProps = {
  rating: number;
  review?: string | null;
  accentColor?: string;
  compact?: boolean;
};

export default function MusicReviewCard({
  rating,
  review,
  accentColor = "#22c55e",
  compact = false,
}: MusicReviewCardProps) {
  const trimmedReview = review?.trim();

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 shadow-[0_16px_40px_rgba(0,0,0,0.28)] ${
        compact ? "mt-3" : "mt-5"
      }`}
    >
      <div
        className={compact ? "px-4 py-3" : "px-5 py-4"}
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Review
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Music-note diary entry
            </p>
          </div>

          <div
            className={`rounded-full border border-white/10 bg-black/30 ${
              compact ? "px-3 py-1.5" : "px-4 py-2"
            }`}
          >
            <p
              className={compact ? "text-sm font-semibold" : "text-base font-semibold"}
              style={{ color: accentColor }}
            >
              <NoteRating rating={rating} />
            </p>
          </div>
        </div>
      </div>

      <div className={compact ? "px-4 py-3" : "px-5 py-4"}>
        {trimmedReview ? (
          <p
            className={`font-medium italic text-zinc-100 ${
              compact ? "text-sm leading-6" : "text-base leading-7"
            }`}
          >
            &ldquo;{trimmedReview}&rdquo;
          </p>
        ) : (
          <p className="text-sm italic text-zinc-500">
            No written review yet.
          </p>
        )}
      </div>
    </div>
  );
}
