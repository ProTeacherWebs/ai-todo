"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { toLocalDateKey } from "@/lib/utils";
import type { Quadrant, Subtask, Task } from "@/types/task";

export interface WorkspaceMeta {
  aiConfigured: boolean;
  activeModel: string | null;
  dbMode: "turso" | "local";
}

async function readErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data?.error && typeof data.error === "string") {
      return data.error;
    }
  } catch {
    // Ignore non-JSON error bodies
  }
  return fallback;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meta, setMeta] = useState<WorkspaceMeta>({
    aiConfigured: true,
    activeModel: null,
    dbMode: "local",
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isParsingBrainDump, setIsParsingBrainDump] = useState(false);
  const [generatingSubtaskIds, setGeneratingSubtaskIds] = useState<Set<string>>(
    () => new Set()
  );

  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;

  const fetchTasks = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      if (!response.ok) {
        const msg = await readErrorMessage(
          response,
          "Не удалось загрузить задачи с сервера."
        );
        throw new Error(msg);
      }

      const data = (await response.json()) as {
        tasks: Task[];
        meta?: WorkspaceMeta;
      };

      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      if (data.meta) {
        setMeta(data.meta);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Ошибка загрузки задач."
      );
    } finally {
      setIsHydrated(true);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks(false);
  }, [fetchTasks]);

  const refreshTasks = useCallback(async () => {
    await fetchTasks(true);
  }, [fetchTasks]);

  const runBrainDump = useCallback(async (rawText: string): Promise<number> => {
    const trimmed = rawText.trim();
    if (!trimmed) return 0;

    setIsParsingBrainDump(true);
    try {
      const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      const response = await fetch("/api/ai/brain-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          clientDate: toLocalDateKey(new Date()),
          timeZone,
        }),
      });

      if (!response.ok) {
        const msg = await readErrorMessage(
          response,
          "Не удалось разобрать текст с помощью ИИ."
        );
        toast.error(msg);
        return 0;
      }

      const data = (await response.json()) as {
        tasks: Task[];
        model?: string;
      };

      const created = Array.isArray(data.tasks) ? data.tasks : [];
      if (created.length === 0) {
        toast.info("Не удалось извлечь задачи из текста.");
        return 0;
      }

      setTasks((prev) => [...created, ...prev]);
      if (data.model) {
        setMeta((prev) => ({
          ...prev,
          aiConfigured: true,
          activeModel: data.model ?? prev.activeModel,
        }));
      }

      const modelSuffix = data.model ? ` (${data.model})` : "";
      toast.success(
        created.length === 1
          ? `Добавлена 1 задача${modelSuffix}`
          : `Добавлено задач: ${created.length}${modelSuffix}`
      );
      return created.length;
    } catch {
      toast.error("Сетевая ошибка при обращении к серверу.");
      return 0;
    } finally {
      setIsParsingBrainDump(false);
    }
  }, []);

  const toggleTaskCompleted = useCallback(async (taskId: string) => {
    const previousTasks = tasksRef.current;
    const target = previousTasks.find((t) => t.id === taskId);
    if (!target) return;

    const nextCompleted = !target.completed;
    const nowIso = new Date().toISOString();

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: nextCompleted,
              completedAt: nextCompleted ? nowIso : null,
              updatedAt: nowIso,
            }
          : task
      )
    );

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      });

      if (!response.ok) {
        const msg = await readErrorMessage(
          response,
          "Не удалось обновить статус задачи."
        );
        throw new Error(msg);
      }

      const data = (await response.json()) as { task: Task };
      if (data.task) {
        setTasks((prev) =>
          prev.map((task) => (task.id === taskId ? data.task : task))
        );
      }
    } catch (err) {
      setTasks(previousTasks);
      toast.error(
        err instanceof Error ? err.message : "Ошибка сохранения статуса."
      );
    }
  }, []);

  const moveTaskToQuadrant = useCallback(
    async (taskId: string, quadrant: Quadrant) => {
      const previousTasks = tasksRef.current;
      const target = previousTasks.find((t) => t.id === taskId);
      if (!target || target.quadrant === quadrant) return;

      const nowIso = new Date().toISOString();

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, quadrant, updatedAt: nowIso } : task
        )
      );

      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quadrant }),
        });

        if (!response.ok) {
          const msg = await readErrorMessage(
            response,
            "Не удалось перенести задачу."
          );
          throw new Error(msg);
        }

        const data = (await response.json()) as { task: Task };
        if (data.task) {
          setTasks((prev) =>
            prev.map((task) => (task.id === taskId ? data.task : task))
          );
        }
      } catch (err) {
        setTasks(previousTasks);
        toast.error(
          err instanceof Error ? err.message : "Ошибка переноса задачи."
        );
      }
    },
    []
  );

  const deleteTask = useCallback(async (taskId: string) => {
    const previousTasks = tasksRef.current;
    setTasks((prev) => prev.filter((task) => task.id !== taskId));

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const msg = await readErrorMessage(
          response,
          "Не удалось удалить задачу."
        );
        throw new Error(msg);
      }

      toast.success("Задача удалена");
    } catch (err) {
      setTasks(previousTasks);
      toast.error(
        err instanceof Error ? err.message : "Ошибка при удалении задачи."
      );
    }
  }, []);

  const generateTaskSubtasks = useCallback(
    async (taskId: string) => {
      if (generatingSubtaskIds.has(taskId)) return;

      setGeneratingSubtaskIds((prev) => {
        const next = new Set(prev);
        next.add(taskId);
        return next;
      });

      try {
        const response = await fetch(`/api/tasks/${taskId}/subtasks/generate`, {
          method: "POST",
        });

        if (!response.ok) {
          const msg = await readErrorMessage(
            response,
            "Не удалось разбить задачу на подзадачи."
          );
          toast.error(msg);
          return;
        }

        const data = (await response.json()) as {
          subtasks: Subtask[];
          model?: string;
        };

        const nowIso = new Date().toISOString();
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  subtasks: Array.isArray(data.subtasks) ? data.subtasks : [],
                  updatedAt: nowIso,
                }
              : task
          )
        );

        if (data.model) {
          setMeta((prev) => ({
            ...prev,
            aiConfigured: true,
            activeModel: data.model ?? prev.activeModel,
          }));
        }

        toast.success(`Создано подзадач: ${data.subtasks?.length ?? 0}`);
      } catch {
        toast.error("Ошибка соединения при генерации подзадач.");
      } finally {
        setGeneratingSubtaskIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [generatingSubtaskIds]
  );

  const toggleSubtaskCompleted = useCallback(
    async (taskId: string, subtaskId: string) => {
      const previousTasks = tasksRef.current;
      const parent = previousTasks.find((t) => t.id === taskId);
      const targetSub = parent?.subtasks.find((s) => s.id === subtaskId);
      if (!targetSub) return;

      const nextCompleted = !targetSub.completed;
      const nowIso = new Date().toISOString();

      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) return task;
          return {
            ...task,
            updatedAt: nowIso,
            subtasks: task.subtasks.map((sub) =>
              sub.id === subtaskId ? { ...sub, completed: nextCompleted } : sub
            ),
          };
        })
      );

      try {
        const response = await fetch(`/api/subtasks/${subtaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: nextCompleted }),
        });

        if (!response.ok) {
          const msg = await readErrorMessage(
            response,
            "Не удалось обновить подзадачу."
          );
          throw new Error(msg);
        }
      } catch (err) {
        setTasks(previousTasks);
        toast.error(
          err instanceof Error ? err.message : "Ошибка обновления подзадачи."
        );
      }
    },
    []
  );

  const deleteSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      const previousTasks = tasksRef.current;
      const nowIso = new Date().toISOString();

      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) return task;
          return {
            ...task,
            updatedAt: nowIso,
            subtasks: task.subtasks.filter((sub) => sub.id !== subtaskId),
          };
        })
      );

      try {
        const response = await fetch(`/api/subtasks/${subtaskId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const msg = await readErrorMessage(
            response,
            "Не удалось удалить подзадачу."
          );
          throw new Error(msg);
        }
      } catch (err) {
        setTasks(previousTasks);
        toast.error(
          err instanceof Error ? err.message : "Ошибка удаления подзадачи."
        );
      }
    },
    []
  );

  return {
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
  };
}
