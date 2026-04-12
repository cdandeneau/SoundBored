"use client";

/**
 * SortableSection
 *
 * A drag-and-drop wrapper built on @dnd-kit/sortable.
 * Wraps any profile section child in a grid column that:
 *  - Supports drag-to-reorder via the ⠿ handle (edit mode only)
 *  - Shows resize buttons (⅓ / ½ / Full) to change column width
 *  - Shows a ✕ remove button to delete the section
 *
 * NOTE: This component is a legacy artifact from when profiles used @dnd-kit.
 * The profile page now uses react-grid-layout for its section grid, so
 * SortableSection may no longer be actively used in the main layout.
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode } from "react";

type SectionWidth = "full" | "half" | "third";

type Props = {
  id: string;
  children: ReactNode;
  width: SectionWidth;
  isEditMode: boolean;
  onRemove?: () => void;
  onResize?: (width: SectionWidth) => void;
};

const widthClass: Record<SectionWidth, string> = {
  full: "col-span-6",
  half: "col-span-6 lg:col-span-3",
  third: "col-span-6 lg:col-span-2",
};

export default function SortableSection({
  id,
  children,
  width,
  isEditMode,
  onRemove,
  onResize,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${widthClass[width]} ${isDragging ? "z-50 opacity-60" : ""}`}
    >
      {isEditMode && (
        <div className="mb-1 flex items-center gap-1 rounded-t-lg bg-zinc-800/80 px-2 py-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab rounded p-1 text-zinc-500 hover:text-zinc-300 active:cursor-grabbing"
            title="Drag to reorder"
          >
            ⠿
          </button>
          <div className="ml-auto flex gap-1">
            {(["third", "half", "full"] as const).map((w) => (
              <button
                key={w}
                onClick={() => onResize?.(w)}
                className={`rounded px-2 py-0.5 text-xs transition ${
                  width === w
                    ? "bg-green-500 font-semibold text-black"
                    : "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                {w === "third" ? "⅓" : w === "half" ? "½" : "Full"}
              </button>
            ))}
            <button
              onClick={onRemove}
              className="rounded border border-red-700 px-2 py-0.5 text-xs text-red-300 hover:bg-red-950/40"
              title="Remove section"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
