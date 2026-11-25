"use client";

import { useMemo, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { BrainDumpPanel } from "@/components/brain-dump/brain-dump-panel";
import { DailyProgress } from "@/components/header/daily-progress";
import { WorkspaceHeader } from "@/components/header/workspace-header";
import { MacSidebar, type SmartFilter } from "@/components/layout/mac-sidebar";
import { EisenhowerMatrix } from "@/components/matrix/eisenhower-matrix";
import { useTasks } from "@/hooks/use-tasks";
import { extractDateKey, toLocalDateKey } from "@/lib/utils";
import { QUADRANTS, type Quadrant } from "@/types/task";

function WorkspaceSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-6 px-4 py-6 sm:px-7">
      <div className="apple-panel h-36 animate-pulse" />
      <div className="apple-panel h-40 animate-pulse" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="apple-panel h-56 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

const SMART_FILTER_TITLES: Record<SmartFilter, string> = {
  all: "Матрица приоритетов",
  today: "На сегодня",
  active: "Активные задачи",
  completed: "Выполненные",
};

export function TaskWorkspace() {
  const {
    tasks,
    meta,
    isHydrated,
    isRefreshing,
    isParsingBrainDump,
    generatingSubtaskIds,
    refreshTasks,
    runBrainDump,
    toggleTaskCompleted,
    moveTaskToQuadrant,
    deleteTask,
    generateTaskSubtasks,
    toggleSubtaskCompleted,
    deleteSubtask,
  } = useTasks();

  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [selectedQuadrant, setSelectedQuadrant] = useState<"all" | Quadrant>(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const filteredTasks = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    const q = searchQuery.trim().toLowerCase();

    return tasks.filter((task) => {
      if (smartFilter === "active" && task.completed) return false;
      if (smartFilter === "completed" && !task.completed) return false;
      if (smartFilter === "today") {
        const dKey = extractDateKey(task.deadline);
        const cKey = extractDateKey(task.createdAt);
        if (dKey !== todayKey && !(!dKey && cKey === todayKey)) {
          return false;
        }
      }

      if (q) {
        const inTitle = task.title.toLowerCase().includes(q);
        const inCategory = task.category.toLowerCase().includes(q);
        const inReason = task.priorityReason.toLowerCase().includes(q);
        const inSubtasks = task.subtasks.some((s) =>
          s.title.toLowerCase().includes(q)
        );
        if (!inTitle && !inCategory && !inReason && !inSubtasks) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, smartFilter, searchQuery]);

  const visibleCount = useMemo(() => {
    if (selectedQuadrant === "all") return filteredTasks.length;
    return filteredTasks.filter((t) => t.quadrant === selectedQuadrant).length;
  }, [filteredTasks, selectedQuadrant]);

  const currentTitle = useMemo(() => {
    if (selectedQuadrant !== "all") {
      return (
        QUADRANTS.find((q) => q.id === selectedQuadrant)?.title ??
        "Матрица приоритетов"
      );
    }
    return SMART_FILTER_TITLES[smartFilter];
  }, [selectedQuadrant, smartFilter]);

  const handleOpenSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsMobileSidebarOpen(true);
    } else {
      setIsDesktopSidebarOpen(true);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] lg:h-screen lg:overflow-hidden">
      <MacSidebar
        tasks={tasks}
        meta={meta}
        smartFilter={smartFilter}
        selectedQuadrant={selectedQuadrant}
        searchQuery={searchQuery}
        isDesktopOpen={isDesktopSidebarOpen}
        isMobileOpen={isMobileSidebarOpen}
        onSelectSmartFilter={setSmartFilter}
        onSelectQuadrant={setSelectedQuadrant}
        onSearchChange={setSearchQuery}
        onCloseDesktop={() => setIsDesktopSidebarOpen(false)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div
        ref={scrollContainerRef}
        className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto"
      >
        <WorkspaceHeader
          title={currentTitle}
          visibleCount={visibleCount}
          smartFilter={smartFilter}
          isDesktopSidebarOpen={isDesktopSidebarOpen}
          isRefreshing={isRefreshing}
          scrollContainerRef={scrollContainerRef}
          onOpenSidebar={handleOpenSidebar}
          onSelectSmartFilter={setSmartFilter}
          onRefresh={() => void refreshTasks()}
        />

        {!isHydrated ? (
          <WorkspaceSkeleton />
        ) : (
          <main className="mx-auto w-full max-w-[1080px] space-y-6 px-4 py-5 sm:px-7 sm:py-6">
            <BrainDumpPanel
              isParsing={isParsingBrainDump}
              onParse={runBrainDump}
            />

            {!meta.aiConfigured && (
              <div className="flex items-start gap-3 rounded-[var(--r-card)] border border-[var(--hairline)] bg-[var(--surface)] px-5 py-4 text-[13px] text-[var(--text-body)] shadow-[var(--sh-card)]">
                <KeyRound
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--heat)]"
                  strokeWidth={1.75}
                />
                <p className="leading-[1.55]">
                  Серверные ключи ИИ (Gemini или Groq) не заданы. Добавьте ключ
                  в файл{" "}
                  <code className="rounded-[var(--r-chip)] bg-black/[0.05] px-1.5 py-0.5 font-mono text-[12px] text-[var(--text)]">
                    ai-tasks-manager/.env.local
                  </code>{" "}
                  и перезапустите сервер, чтобы включить AI Brain Dump и
                  генерацию подзадач.
                </p>
              </div>
            )}

            <DailyProgress tasks={tasks} />

            <EisenhowerMatrix
              tasks={filteredTasks}
              hideCompleted={false}
              selectedQuadrant={selectedQuadrant}
              generatingSubtaskIds={generatingSubtaskIds}
              onMoveTask={moveTaskToQuadrant}
              onToggleComplete={toggleTaskCompleted}
              onDelete={deleteTask}
              onGenerateSubtasks={generateTaskSubtasks}
              onToggleSubtask={toggleSubtaskCompleted}
              onDeleteSubtask={deleteSubtask}
            />
          </main>
        )}
      </div>
    </div>
  );
}
