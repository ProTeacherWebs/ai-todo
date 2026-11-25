"use client";

import { useEffect, useState, type RefObject } from "react";
import { PanelLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SmartFilter } from "@/components/layout/mac-sidebar";

interface WorkspaceHeaderProps {
  title: string;
  visibleCount: number;
  smartFilter: SmartFilter;
  isDesktopSidebarOpen: boolean;
  isRefreshing: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onOpenSidebar: () => void;
  onSelectSmartFilter: (filter: SmartFilter) => void;
  onRefresh: () => void;
}

export function WorkspaceHeader({
  title,
  visibleCount,
  smartFilter,
  isDesktopSidebarOpen,
  isRefreshing,
  scrollContainerRef,
  onOpenSidebar,
  onSelectSmartFilter,
  onRefresh,
}: WorkspaceHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef.current;

    const updateScroll = () => {
      const containerTop = container ? container.scrollTop : 0;
      setIsScrolled(containerTop > 6 || window.scrollY > 6);
    };

    updateScroll();
    container?.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("scroll", updateScroll, { passive: true });

    return () => {
      container?.removeEventListener("scroll", updateScroll);
      window.removeEventListener("scroll", updateScroll);
    };
  }, [scrollContainerRef]);

  return (
    <header
      className={cn(
        "mac-toolbar sticky top-0 z-30 shrink-0",
        isScrolled && "scrolled"
      )}
    >
      <div className="flex h-[52px] items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: Sidebar trigger + current macOS view title */}
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenSidebar}
            className={cn(
              "apple-press flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-black/[0.06] hover:text-[var(--text)]",
              isDesktopSidebarOpen && "lg:hidden"
            )}
            title="Показать боковую панель"
            aria-label="Показать боковую панель"
          >
            <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>

          <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)]">
            {title}
          </h1>
          <span className="shrink-0 font-mono text-[12px] text-[var(--text-3)] tabular-nums">
            {visibleCount}
          </span>
        </div>

        {/* Right: Segmented quick filter + Refresh */}
        <div className="flex shrink-0 items-center gap-2">
          <div
            role="group"
            aria-label="Быстрый фильтр"
            className="inline-flex items-center gap-[2px] rounded-full bg-black/[0.05] p-[3px]"
          >
            <button
              type="button"
              onClick={() => onSelectSmartFilter("all")}
              className={cn(
                "apple-press min-h-[30px] rounded-full px-3 text-[12px] transition-all duration-200",
                smartFilter !== "active"
                  ? "bg-[var(--surface)] font-semibold text-[var(--text)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                  : "font-medium text-[var(--text-2)] hover:text-[var(--text)]"
              )}
            >
              Все
            </button>

            <button
              type="button"
              onClick={() => onSelectSmartFilter("active")}
              className={cn(
                "apple-press min-h-[30px] rounded-full px-3 text-[12px] transition-all duration-200",
                smartFilter === "active"
                  ? "bg-[var(--surface)] font-semibold text-[var(--text)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                  : "font-medium text-[var(--text-2)] hover:text-[var(--text)]"
              )}
            >
              Активные
            </button>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="apple-press inline-flex h-[36px] w-[36px] items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-black/[0.06] hover:text-[var(--text)] disabled:opacity-50"
            title="Обновить задачи из базы"
            aria-label="Обновить задачи"
          >
            <RefreshCw
              className={cn("h-[16px] w-[16px]", isRefreshing && "animate-spin")}
              strokeWidth={1.75}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
