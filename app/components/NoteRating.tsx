export default function NoteRating({ rating }: { rating: number }) {
  const fullNotes = Math.floor(rating);
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
