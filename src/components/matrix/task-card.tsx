"use client";

import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import {
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Trash2,
} from "lucide-react";
import { SubtaskList } from "@/components/matrix/subtask-list";
import { cn, formatDeadline, getCategoryStyle } from "@/lib/utils";
import type { Task } from "@/types/task";

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  isGeneratingSubtasks?: boolean;
  onToggleComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onGenerateSubtasks: (taskId: string) => Promise<void> | void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
}

export function TaskCard({
  task,
  isOverlay = false,
  isGeneratingSubtasks = false,
  onToggleComplete,
  onDelete,
  onGenerateSubtasks,
  onToggleSubtask,
  onDeleteSubtask,
}: TaskCardProps) {
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(
    task.subtasks.length > 0
  );
  const prevSubtaskCountRef = useRef(task.subtasks.length);

  useEffect(() => {
    if (prevSubtaskCountRef.current === 0 && task.subtasks.length > 0) {
      setIsSubtasksExpanded(true);
    }
    prevSubtaskCountRef.current = task.subtasks.length;
  }, [task.subtasks.length]);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: isOverlay ? `${task.id}__overlay` : task.id,
    data: { task },
    disabled: isOverlay,
  });

  const deadlineInfo = formatDeadline(task.deadline);
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;

  const deadlineToneClasses: Record<typeof deadlineInfo.tone, string> = {
    overdue: "bg-[var(--heat-bg)] text-[var(--heat)] font-semibold",
    today: "bg-[rgba(0,113,227,0.08)] text-[var(--accent-link)] font-medium",
    tomorrow: "bg-[rgba(0,113,227,0.06)] text-[var(--accent-link)]",
    upcoming: "bg-black/[0.05] text-[var(--text-2)]",
    none: "bg-transparent text-[var(--text-3)]",
  };

  return (
    <article
      ref={isOverlay ? undefined : setNodeRef}
      className={cn(
        "group relative px-5 py-4",
        !isOverlay && "apple-row",
        task.completed && !isOverlay && "opacity-65",
        isDragging && !isOverlay && "opacity-35",
        isOverlay &&
          "cursor-grabbing rounded-[var(--r-card)] bg-[var(--surface)] shadow-[var(--sh-overlay)]"
      )}
    >
      {/* Top row: circular Apple checkbox + title + actions */}
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => onToggleComplete(task.id)}
          aria-label={
            task.completed ? "Снять отметку выполнения" : "Отметить выполненной"
          }
          className="-ml-2 -mt-1.5 flex h-[40px] w-[36px] shrink-0 items-start justify-center pt-2"
        >
          <span
            className={cn(
              "apple-press flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] transition-colors",
              task.completed
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--faint)] bg-transparent group-hover:border-[var(--text-3)]"
            )}
          >
            {task.completed && (
              <Check className="h-3 w-3 stroke-[2.5]" strokeWidth={2.5} />
            )}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "text-[15.5px] font-semibold leading-[1.4] tracking-[-0.01em] break-words",
              task.completed
                ? "text-[var(--text-3)] line-through"
                : "text-[var(--text)]"
            )}
          >
            {task.title}
          </h3>

          {/* Concise AI priority justification */}
          <p className="mt-1 text-[13px] leading-[1.5] text-[var(--text-2)]">
            {task.priorityReason}
          </p>
        </div>

        {/* Row actions: Drag Handle + Delete */}
        <div className="-mr-1.5 -mt-1 flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            {...(isOverlay ? {} : listeners)}
            {...(isOverlay ? {} : attributes)}
            className="apple-press flex h-[38px] w-[38px] touch-none items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text)] cursor-grab active:cursor-grabbing"
            title="Перетащить в другой квадрант"
            aria-label="Перетащить задачу"
          >
            <GripVertical className="h-[16px] w-[16px]" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="apple-press flex h-[38px] w-[38px] items-center justify-center rounded-full text-[var(--text-3)] opacity-75 transition-colors hover:bg-[var(--heat-bg)] hover:text-[var(--heat)] group-hover:opacity-100"
            title="Удалить задачу"
            aria-label="Удалить задачу"
          >
            <Trash2 className="h-[16px] w-[16px]" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Metadata footer */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pl-[30px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium",
              getCategoryStyle(task.category)
            )}
          >
            {task.category}
          </span>

          {task.deadline && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] tabular-nums",
                deadlineToneClasses[deadlineInfo.tone]
              )}
            >
              {deadlineInfo.label}
            </span>
          )}
        </div>

        <div>
          {task.subtasks.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsSubtasksExpanded((v) => !v)}
              className="apple-press inline-flex min-h-[32px] items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--accent-link)] transition-colors hover:bg-[rgba(0,113,227,0.08)]"
            >
              {isSubtasksExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              <span>Подзадачи</span>
              <span className="tabular-nums">
                {completedSubtasks}/{task.subtasks.length}
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isGeneratingSubtasks}
              onClick={() => void onGenerateSubtasks(task.id)}
              className="apple-press inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--accent-link)] transition-colors hover:bg-[rgba(0,113,227,0.08)] disabled:cursor-wait disabled:opacity-60"
            >
              {isGeneratingSubtasks ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                  <span>Разбиваю...</span>
                </>
              ) : (
                <span>Разбить на подзадачи</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expandable subtasks */}
      {isSubtasksExpanded && task.subtasks.length > 0 && (
        <div className="pl-[30px]">
          <SubtaskList
            taskId={task.id}
            subtasks={task.subtasks}
            onToggleSubtask={onToggleSubtask}
            onDeleteSubtask={onDeleteSubtask}
          />
        </div>
      )}
    </article>
  );
}
