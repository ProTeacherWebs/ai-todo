"use client";

import { useEffect, useRef } from "react";
import {
  Calendar,
  CheckCircle2,
  Inbox,
  LayoutGrid,
  ListTodo,
  PanelLeftClose,
  Search,
  X,
} from "lucide-react";
import { cn, computeDailyProgress, extractDateKey, toLocalDateKey } from "@/lib/utils";
import { QUADRANTS, type Quadrant, type Task } from "@/types/task";
import type { WorkspaceMeta } from "@/hooks/use-tasks";

export type SmartFilter = "all" | "today" | "active" | "completed";

interface MacSidebarProps {
  tasks: Task[];
  meta: WorkspaceMeta;
  smartFilter: SmartFilter;
  selectedQuadrant: "all" | Quadrant;
  searchQuery: string;
  isDesktopOpen: boolean;
  isMobileOpen: boolean;
  onSelectSmartFilter: (filter: SmartFilter) => void;
  onSelectQuadrant: (quadrant: "all" | Quadrant) => void;
  onSearchChange: (value: string) => void;
  onCloseDesktop: () => void;
  onCloseMobile: () => void;
}

export function MacSidebar({
  tasks,
  meta,
  smartFilter,
  selectedQuadrant,
  searchQuery,
  isDesktopOpen,
  isMobileOpen,
  onSelectSmartFilter,
  onSelectQuadrant,
  onSearchChange,
  onCloseDesktop,
  onCloseMobile,
}: MacSidebarProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const todayKey = toLocalDateKey(new Date());
  const totalCount = tasks.length;
  const activeCount = tasks.filter((t) => !t.completed).length;
  const completedCount = totalCount - activeCount;
  const todayCount = tasks.filter((t) => {
    const dKey = extractDateKey(t.deadline);
    const cKey = extractDateKey(t.createdAt);
    return dKey === todayKey || (!dKey && cKey === todayKey);
  }).length;

  const daily = computeDailyProgress(tasks, 1);
  const todayPercent = daily[0]?.percentage ?? 0;

  const smartTiles: Array<{
    id: SmartFilter;
    label: string;
    count: number;
    icon: typeof Inbox;
    iconBg: string;
  }> = [
    {
      id: "all",
      label: "Все",
      count: totalCount,
      icon: Inbox,
      iconBg: "bg-[var(--text)] text-white",
    },
    {
      id: "today",
      label: "Сегодня",
      count: todayCount,
      icon: Calendar,
      iconBg: "bg-[var(--accent)] text-white",
    },
    {
      id: "active",
      label: "Активные",
      count: activeCount,
      icon: ListTodo,
      iconBg: "bg-[var(--heat)] text-white",
    },
    {
      id: "completed",
      label: "Готово",
      count: completedCount,
      icon: CheckCircle2,
      iconBg: "bg-[var(--live)] text-white",
    },
  ];

  const handleTileClick = (id: SmartFilter) => {
    onSelectSmartFilter(id);
    onCloseMobile();
  };

  const handleQuadrantClick = (id: "all" | Quadrant) => {
    onSelectQuadrant(id);
    onCloseMobile();
  };

  const sidebarBody = (
    <div className="flex h-full flex-col px-3.5 pb-4">
      {/* Window Titlebar + Traffic Lights */}
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-[7px]" aria-hidden="true">
            <span className="mac-traffic-light bg-[#ff5f57]" />
            <span className="mac-traffic-light bg-[#febc2e]" />
            <span className="mac-traffic-light bg-[#28c840]" />
          </div>
          <span className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)]">
            EisenAI
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isMobileOpen) {
              onCloseMobile();
            } else {
              onCloseDesktop();
            }
          }}
          className="apple-press flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-[var(--text-3)] transition-colors hover:bg-black/[0.06] hover:text-[var(--text)]"
          title="Скрыть боковую панель"
          aria-label="Скрыть боковую панель"
        >
          <PanelLeftClose className="h-[16px] w-[16px]" strokeWidth={1.75} />
        </button>
      </div>

      {/* macOS Spotlight-style Search */}
      <div className="mt-1">
        <div className="flex h-[34px] items-center gap-2 rounded-[10px] bg-black/[0.055] px-2.5 focus-within:bg-[var(--surface)] focus-within:ring-2 focus-within:ring-[var(--accent)]/30">
          <Search
            className="h-[14px] w-[14px] shrink-0 text-[var(--text-3)]"
            strokeWidth={1.75}
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск задач"
            className="w-full min-w-0 bg-transparent text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-3)] hover:bg-black/[0.08] hover:text-[var(--text)]"
              aria-label="Очистить поиск"
            >
              <X className="h-3 w-3" strokeWidth={2} />
            </button>
          ) : (
            <kbd className="hidden shrink-0 rounded-[5px] bg-black/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--text-3)] sm:inline-block">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* 2x2 Apple Reminders Smart Filter Tiles */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {smartTiles.map((tile) => {
          const Icon = tile.icon;
          const isActive = smartFilter === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => handleTileClick(tile.id)}
              className={cn(
                "apple-press flex flex-col justify-between rounded-[14px] p-2.5 text-left transition-all duration-150",
                isActive
                  ? "bg-[var(--accent)] text-white shadow-[0_6px_16px_rgba(0,113,227,0.22)]"
                  : "bg-[var(--surface)] text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-[var(--hover)]"
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className={cn(
                    "flex h-[26px] w-[26px] items-center justify-center rounded-full",
                    isActive ? "bg-white/20 text-white" : tile.iconBg
                  )}
                >
                  <Icon className="h-[14px] w-[14px]" strokeWidth={2} />
                </span>
                <span
                  className={cn(
                    "text-[18px] font-bold leading-none tabular-nums",
                    isActive ? "text-white" : "text-[var(--text)]"
                  )}
                >
                  {tile.count}
                </span>
              </div>
              <span
                className={cn(
                  "mt-2 text-[12px] font-semibold leading-tight",
                  isActive ? "text-white/95" : "text-[var(--text-2)]"
                )}
              >
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Quadrant Navigation Section */}
      <div className="mt-5 flex-1 overflow-y-auto">
        <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">
          Матрица
        </div>

        <nav className="space-y-0.5" aria-label="Квадранты матрицы">
          <button
            type="button"
            onClick={() => handleQuadrantClick("all")}
            className={cn(
              "apple-press flex w-full items-center justify-between gap-2 rounded-[9px] px-2.5 py-2 text-[13px] transition-colors",
              selectedQuadrant === "all"
                ? "bg-[var(--accent)] font-medium text-white"
                : "text-[var(--text-body)] hover:bg-black/[0.05]"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <LayoutGrid className="h-[15px] w-[15px] shrink-0" strokeWidth={1.75} />
              <span className="truncate">Все квадранты</span>
            </span>
            <span
              className={cn(
                "font-mono text-[11.5px] tabular-nums",
                selectedQuadrant === "all" ? "text-white/85" : "text-[var(--text-3)]"
              )}
            >
              {totalCount}
            </span>
          </button>

          {QUADRANTS.map((q) => {
            const count = tasks.filter((t) => t.quadrant === q.id).length;
            const isSelected = selectedQuadrant === q.id;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => handleQuadrantClick(q.id)}
                className={cn(
                  "apple-press flex w-full items-center justify-between gap-2 rounded-[9px] px-2.5 py-2 text-[13px] transition-colors",
                  isSelected
                    ? "bg-[var(--accent)] font-medium text-white"
                    : "text-[var(--text-body)] hover:bg-black/[0.05]"
                )}
              >
                <span className="truncate">{q.title}</span>
                <span
                  className={cn(
                    "font-mono text-[11.5px] tabular-nums",
                    isSelected ? "text-white/85" : "text-[var(--text-3)]"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom macOS Status Footer */}
      <div className="mt-auto border-t border-[var(--hairline)] pt-3">
        <div className="rounded-[12px] bg-black/[0.04] px-3 py-2.5">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-medium text-[var(--text-2)]">Сегодня</span>
            <span className="font-semibold text-[var(--text)] tabular-nums">
              {todayPercent}%
            </span>
          </div>
          <div className="mt-1.5 h-[5px] w-full overflow-hidden rounded-full bg-[var(--track)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${todayPercent}%` }}
            />
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
            <span
              className={cn(
                "h-[6px] w-[6px] shrink-0 rounded-full",
                meta.aiConfigured ? "bg-[var(--live)]" : "bg-[var(--heat)]"
              )}
            />
            <span className="truncate">
              {meta.dbMode === "turso" ? "Turso Cloud" : "libSQL"} ·{" "}
              {meta.aiConfigured
                ? meta.activeModel ?? "Gemini / Groq"
                : "Нет ключа ИИ"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent / collapsible macOS vibrancy sidebar */}
      <aside
        aria-label="Боковая панель"
        className={cn(
          "mac-sidebar hidden shrink-0 lg:block transition-all duration-300 ease-out overflow-hidden",
          isDesktopOpen ? "lg:w-[264px] opacity-100" : "lg:w-0 lg:border-r-0 opacity-0"
        )}
      >
        <div className="h-full w-[264px]">{sidebarBody}</div>
      </aside>

      {/* Mobile slide-over sheet + scrim */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-opacity duration-200",
          isMobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <div
          aria-hidden="true"
          onClick={onCloseMobile}
          className="absolute inset-0 bg-black/25"
        />
        <aside
          aria-label="Мобильное меню"
          className={cn(
            "mac-sidebar relative h-full w-[280px] max-w-[85vw] shadow-[var(--sh-overlay)] transition-transform duration-300",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ transitionTimingFunction: "var(--ease-spring)" }}
        >
          {sidebarBody}
        </aside>
      </div>
    </>
  );
}
