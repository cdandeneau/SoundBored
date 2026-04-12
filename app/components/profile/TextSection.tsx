"use client";

/**
 * TextSection
 *
 * A freeform text block that appears as a profile grid section.
 * In view mode it renders the title and content as-is (whitespace preserved).
 * In edit mode (isOwnProfile is true and the ✎ Edit button is clicked) it
 * shows an inline form where the user can change both the title and the content.
 *
 * Props:
 *  title                — section heading
 *  content              — body text (supports newlines via whitespace-pre-wrap)
 *  isOwnProfile         — shows the Edit button when true
 *  outerBackgroundColor — CSS background for the card wrapper
 *  accentTextColor      — text color for the body content
 *  onSave               — called with (title, content) when the user saves edits
 */
import { useState } from "react";

type Props = {
  title: string;
  content: string;
  isOwnProfile: boolean;
  outerBackgroundColor?: string;
  accentTextColor?: string;
  onSave?: (title: string, content: string) => void;
};

export default function TextSection({
  title,
  content,
  isOwnProfile,
  outerBackgroundColor,
  accentTextColor,
  onSave,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [contentDraft, setContentDraft] = useState(content);

  function handleSave() {
    onSave?.(titleDraft.trim(), contentDraft.trim());
    setIsEditing(false);
  }

  return (
    <div className="h-full rounded-2xl p-5 shadow-lg" style={outerBackgroundColor ? { backgroundColor: outerBackgroundColor } : { backgroundColor: "#18181b" }}>
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-lg font-bold text-white outline-none"
            placeholder="Section title"
          />
          <textarea
            value={contentDraft}
            onChange={(e) => setContentDraft(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none"
            placeholder="Write something..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded-lg bg-green-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-green-600"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            {isOwnProfile && (
              <button
                onClick={() => {
                  setTitleDraft(title);
                  setContentDraft(content);
                  setIsEditing(true);
                }}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                ✎ Edit
              </button>
            )}
          </div>
          <p
            className="whitespace-pre-wrap text-sm leading-6"
            style={accentTextColor ? { color: accentTextColor } : { color: "#d4d4d8" }}
          >
            {content ||
              (isOwnProfile
                ? "Click edit to add content."
                : "No content yet.")}
          </p>
        </>
      )}
    </div>
  );
}
