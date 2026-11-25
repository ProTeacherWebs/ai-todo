"use client";

import { useDroppable } from "@dnd-kit/core";
import { TaskCard } from "@/components/matrix/task-card";
import { cn } from "@/lib/utils";
import type { QuadrantMeta, Task } from "@/types/task";

interface QuadrantColumnProps {
  meta: QuadrantMeta;
  tasks: Task[];
  hideCompleted: boolean;
  generatingSubtaskIds: Set<string>;
  onToggleComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onGenerateSubtasks: (taskId: string) => Promise<void> | void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
}

export function QuadrantColumn({
  meta,
  tasks,
  hideCompleted,
  generatingSubtaskIds,
  onToggleComplete,
  onDelete,
  onGenerateSubtasks,
  onToggleSubtask,
  onDeleteSubtask,
}: QuadrantColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: meta.id,
  });

  const sortedTasks = [...tasks]
    .filter((task) => (hideCompleted ? !task.completed : true))
    .sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return a.position - b.position;
    });

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <section
      ref={setNodeRef}
      aria-label={meta.title}
      className={cn(
        "apple-panel flex flex-col overflow-hidden transition-all duration-200",
        isOver && meta.ringClass
      )}
    >
      {/* Unified Panel Header */}
      <header className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate text-[16px] font-semibold tracking-[-0.015em] text-[var(--text)]">
            {meta.title}
          </h2>
          <span
            className={cn(
              "hidden shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium sm:inline-flex",
              meta.badgeClass
            )}
          >
            {meta.subtitle}
          </span>
        </div>

        <span className="shrink-0 font-mono text-[12.5px] text-[var(--text-3)] tabular-nums">
          {completedCount}/{tasks.length}
        </span>
      </header>

      {/* Hairline-separated rows */}
      <div>
        {sortedTasks.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p
              className={cn(
                "text-[13.5px]",
                isOver
                  ? "font-medium text-[var(--accent-link)]"
                  : "text-[var(--text-3)]"
              )}
            >
              {isOver ? "Отпустите для переноса сюда" : meta.emptyHint}
            </p>
          </div>
        ) : (
          sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isGeneratingSubtasks={generatingSubtaskIds.has(task.id)}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onGenerateSubtasks={onGenerateSubtasks}
              onToggleSubtask={onToggleSubtask}
              onDeleteSubtask={onDeleteSubtask}
            />
          ))
        )}
      </div>
    </section>
  );
}
