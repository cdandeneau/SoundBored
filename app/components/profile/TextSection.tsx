"use client";

import { useState } from "react";

type Props = {
  title: string;
  content: string;
  isOwnProfile: boolean;
  onSave?: (title: string, content: string) => void;
};

export default function TextSection({
  title,
  content,
  isOwnProfile,
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
    <div className="rounded-2xl bg-zinc-900 p-5 shadow-lg">
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
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">
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
