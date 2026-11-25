"use client";

import { useEffect, useMemo, useState } from "react";
import { cn, computeDailyProgress } from "@/lib/utils";
import type { Task } from "@/types/task";

interface DailyProgressProps {
  tasks: Task[];
}

export function DailyProgress({ tasks }: DailyProgressProps) {
  const dailyItems = useMemo(() => computeDailyProgress(tasks, 7), [tasks]);
  const todayItem = dailyItems[dailyItems.length - 1];

  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    if (!todayItem) return;
    setSelectedDate((prev) => {
      if (prev && dailyItems.some((d) => d.date === prev)) return prev;
      return todayItem.date;
    });
  }, [dailyItems, todayItem]);

  const activeDay =
    dailyItems.find((item) => item.date === selectedDate) ?? todayItem;

  if (!activeDay) return null;

  const isCompleteDay = activeDay.percentage === 100 && activeDay.total > 0;

  return (
    <section aria-label="Прогресс выполнения задач по дням">
      <h2 className="mb-2.5 px-1 text-[13px] font-semibold text-[var(--text-2)]">
        Прогресс за день
      </h2>

      <div className="apple-panel p-5 sm:p-6">
        {/* Headline row */}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--text)] tabular-nums">
              Выполнено {activeDay.percentage}%
            </span>
            <span className="text-[13px] capitalize text-[var(--text-2)]">
              {activeDay.fullLabel}
            </span>
          </div>

          <span className="text-[13px] text-[var(--text-2)] tabular-nums">
            {activeDay.completed} из {activeDay.total}
          </span>
        </div>

        {/* Apple meter track */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--track)]">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              isCompleteDay ? "bg-[var(--live)]" : "bg-[var(--accent)]"
            )}
            style={{ width: `${activeDay.percentage}%` }}
          />
        </div>

        {/* 7-day segmented selector */}
        <div className="mt-5 border-t border-[var(--hairline)] pt-4">
          <div className="grid grid-cols-7 gap-1 rounded-[var(--r-card)] bg-black/[0.04] p-1">
            {dailyItems.map((day) => {
              const isSelected = day.date === activeDay.date;
              const isDone = day.percentage === 100 && day.total > 0;

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={cn(
                    "apple-press flex min-h-[54px] flex-col items-center justify-center rounded-[14px] px-1.5 py-2 text-center transition-all duration-200",
                    isSelected
                      ? "bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                      : "hover:bg-white/60"
                  )}
                  title={`${day.fullLabel}: ${day.completed}/${day.total} (${day.percentage}%)`}
                >
                  <span
                    className={cn(
                      "text-[10.5px] font-medium uppercase tracking-wide",
                      day.isToday
                        ? "text-[var(--accent-link)]"
                        : "text-[var(--text-3)]"
                    )}
                  >
                    {day.shortWeekday}
                  </span>

                  <span className="mt-0.5 text-[13.5px] font-semibold text-[var(--text)] tabular-nums">
                    {day.dayNumber}
                  </span>

                  <div className="mt-1.5 h-[3px] w-full max-w-[36px] overflow-hidden rounded-full bg-[var(--track)]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        isDone ? "bg-[var(--live)]" : "bg-[var(--accent)]"
                      )}
                      style={{ width: `${day.percentage}%` }}
                    />
                  </div>

                  <span className="mt-1 text-[10.5px] text-[var(--text-3)] tabular-nums">
                    {day.total > 0 ? `${day.percentage}%` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
