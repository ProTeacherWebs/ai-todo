export type Quadrant =
  | "urgent_important"
  | "not_urgent_important"
  | "urgent_not_important"
  | "not_urgent_not_important";

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  position: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  quadrant: Quadrant;
  category: string;
  priorityReason: string;
  deadline: string | null;
  completed: boolean;
  completedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  subtasks: Subtask[];
}

export interface DailyProgressItem {
  date: string;
  dayNumber: string;
  shortWeekday: string;
  fullLabel: string;
  isToday: boolean;
  total: number;
  completed: number;
  percentage: number;
}

export interface QuadrantMeta {
  id: Quadrant;
  title: string;
  subtitle: string;
  badgeClass: string;
  ringClass: string;
  emptyHint: string;
}

export const QUADRANTS: QuadrantMeta[] = [
  {
    id: "urgent_important",
    title: "Срочно и важно",
    subtitle: "Сделать сейчас",
    badgeClass: "bg-[var(--heat-bg)] text-[var(--heat)]",
    ringClass: "ring-2 ring-[var(--accent)]/70 bg-[#f8fbff]",
    emptyHint: "Критичных задач на сейчас нет",
  },
  {
    id: "not_urgent_important",
    title: "Не срочно и важно",
    subtitle: "Запланировать",
    badgeClass: "bg-[rgba(0,113,227,0.08)] text-[var(--accent-link)]",
    ringClass: "ring-2 ring-[var(--accent)]/70 bg-[#f8fbff]",
    emptyHint: "Перетащите сюда стратегические задачи",
  },
  {
    id: "urgent_not_important",
    title: "Срочно и не важно",
    subtitle: "Делегировать",
    badgeClass: "bg-black/[0.05] text-[var(--text-2)]",
    ringClass: "ring-2 ring-[var(--accent)]/70 bg-[#f8fbff]",
    emptyHint: "Рутинные срочные дела отсутствуют",
  },
  {
    id: "not_urgent_not_important",
    title: "Не срочно и не важно",
    subtitle: "Позже",
    badgeClass: "bg-black/[0.04] text-[var(--text-3)]",
    ringClass: "ring-2 ring-[var(--accent)]/70 bg-[#f8fbff]",
    emptyHint: "Отложенные и второстепенные задачи",
  },
];

export const QUADRANT_IDS: Quadrant[] = QUADRANTS.map((q) => q.id);
