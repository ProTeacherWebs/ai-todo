import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DailyProgressItem, Task } from "@/types/task";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Formats a Date into local YYYY-MM-DD without UTC timezone drift.
 */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Extracts local YYYY-MM-DD from an ISO date or YYYY-MM-DD string.
 */
export function extractDateKey(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const datePrefixMatch = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (datePrefixMatch) {
    return datePrefixMatch[1];
  }
  // If string includes local time without timezone offset (YYYY-MM-DDTHH:mm)
  const localDateTimeMatch = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2})?$/.exec(trimmed);
  if (localDateTimeMatch) {
    return localDateTimeMatch[1];
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return toLocalDateKey(parsed);
}

export type DeadlineTone = "overdue" | "today" | "tomorrow" | "upcoming" | "none";

export function formatDeadline(deadline: string | null): {
  label: string;
  tone: DeadlineTone;
} {
  if (!deadline) {
    return { label: "Без срока", tone: "none" };
  }

  const dateKey = extractDateKey(deadline);
  if (!dateKey) {
    return { label: deadline, tone: "upcoming" };
  }

  const now = new Date();
  const todayKey = toLocalDateKey(now);

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowKey = toLocalDateKey(tomorrowDate);

  const timeMatch = /T(\d{2}:\d{2})/.exec(deadline);
  const timeSuffix = timeMatch ? `, ${timeMatch[1]}` : "";

  const [y, m, d] = dateKey.split("-").map(Number);
  const targetDate = new Date(y, m - 1, d);
  const shortDate = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  })
    .format(targetDate)
    .replace(".", "");

  if (dateKey === todayKey) {
    return { label: `Сегодня${timeSuffix}`, tone: "today" };
  }

  if (dateKey === tomorrowKey) {
    return { label: `Завтра${timeSuffix}`, tone: "tomorrow" };
  }

  if (dateKey < todayKey) {
    return { label: `Просрочено · ${shortDate}`, tone: "overdue" };
  }

  return { label: `${shortDate}${timeSuffix}`, tone: "upcoming" };
}

const WEEKDAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function computeDailyProgress(
  tasks: Task[],
  daysCount: number = 7
): DailyProgressItem[] {
  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const items: DailyProgressItem[] = [];

  for (let offset = daysCount - 1; offset >= 0; offset--) {
    const day = new Date(now);
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - offset);

    const dateKey = toLocalDateKey(day);
    const matchingTasks = tasks.filter((task) => {
      const deadlineKey = extractDateKey(task.deadline);
      const createdKey = extractDateKey(task.createdAt);
      const completedKey = extractDateKey(task.completedAt);

      return (
        deadlineKey === dateKey ||
        (!deadlineKey && createdKey === dateKey) ||
        completedKey === dateKey
      );
    });

    const total = matchingTasks.length;
    const completed = matchingTasks.filter((t) => t.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    const fullLabel = new Intl.DateTimeFormat("ru-RU", {
      weekday: "short",
      day: "numeric",
      month: "long",
    }).format(day);

    items.push({
      date: dateKey,
      dayNumber: String(day.getDate()),
      shortWeekday: WEEKDAY_SHORT[day.getDay()],
      fullLabel: dateKey === todayKey ? `Сегодня, ${fullLabel}` : fullLabel,
      isToday: dateKey === todayKey,
      total,
      completed,
      percentage,
    });
  }

  return items;
}

export function getCategoryStyle(_category: string): string {
  return "bg-black/[0.05] text-[var(--text-2)]";
}
