"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Subtask } from "@/types/task";

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
}

export function SubtaskList({
  taskId,
  subtasks,
  onToggleSubtask,
  onDeleteSubtask,
}: SubtaskListProps) {
  if (subtasks.length === 0) return null;

  const completedCount = subtasks.filter((s) => s.completed).length;

  return (
    <div className="mt-3 border-t border-[var(--hairline)] pt-3">
      <div className="mb-2 flex items-center justify-between text-[11.5px] font-medium text-[var(--text-3)]">
        <span>Подзадачи</span>
        <span className="tabular-nums">
          {completedCount}/{subtasks.length}
        </span>
      </div>

      <ul className="space-y-1.5 border-l border-[var(--hairline)] pl-3">
        {subtasks.map((subtask) => (
          <li
            key={subtask.id}
            className="group/sub flex items-start justify-between gap-2 py-0.5 text-[13px]"
          >
            <button
              type="button"
              onClick={() => onToggleSubtask(taskId, subtask.id)}
              className="flex min-h-[28px] flex-1 items-start gap-2.5 text-left"
            >
              <span
                className={cn(
                  "apple-press mt-[2px] flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
                  subtask.completed
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--faint)] bg-transparent group-hover/sub:border-[var(--text-3)]"
                )}
              >
                {subtask.completed && (
                  <Check className="h-2.5 w-2.5 stroke-[2.5]" strokeWidth={2.5} />
                )}
              </span>
              <span
                className={cn(
                  "leading-[1.45] transition-colors",
                  subtask.completed
                    ? "text-[var(--text-3)] line-through"
                    : "text-[var(--text-body)] group-hover/sub:text-[var(--text)]"
                )}
              >
                {subtask.title}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onDeleteSubtask(taskId, subtask.id)}
              className="mt-0.5 flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[var(--text-3)] opacity-0 transition-opacity hover:bg-[var(--heat-bg)] hover:text-[var(--heat)] group-hover/sub:opacity-100 focus:opacity-100"
              title="Удалить подзадачу"
              aria-label="Удалить подзадачу"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
