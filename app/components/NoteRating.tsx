/**
 * NoteRating
 *
 * Renders a rating as music-note symbols (♪) instead of stars.
 * Accepts a numeric rating (0.5–5) and displays:
 *  - One ♪ per whole point
 *  - A superscript "½" when the rating has a fractional .5
 *
 * Example: rating=3.5 → ♪♪♪½
 */
export default function NoteRating({ rating }: { rating: number }) {
  const fullNotes = Math.floor(rating);
  // True when the rating is e.g. 3.5, 4.5 — any non-integer value
  const hasHalf = rating % 1 !== 0;

  return (
    <span className="inline-flex items-center leading-none">
      {Array.from({ length: fullNotes }, (_, i) => (
        <span key={i}>♪</span>
      ))}
      {hasHalf && <span className="text-[0.6em] ml-0.5">½</span>}
    </span>
  );
}
