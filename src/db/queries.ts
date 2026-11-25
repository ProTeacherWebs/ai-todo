import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import {
  db,
  ensureDatabaseInitialized,
  subtasks,
  tasks,
  type SubtaskRow,
  type TaskRow,
} from "@/db";
import type { Quadrant, Subtask, Task } from "@/types/task";

export function mapSubtaskRow(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    taskId: row.taskId,
    title: row.title,
    completed: Boolean(row.completed),
    position: row.position,
    createdAt: row.createdAt,
  };
}

export function mapTaskRow(row: TaskRow, taskSubtasks: Subtask[]): Task {
  return {
    id: row.id,
    title: row.title,
    quadrant: row.quadrant as Quadrant,
    category: row.category,
    priorityReason: row.priorityReason,
    deadline: row.deadline ?? null,
    completed: Boolean(row.completed),
    completedAt: row.completedAt ?? null,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    subtasks: taskSubtasks,
  };
}

export async function getAllTasksWithSubtasks(): Promise<Task[]> {
  await ensureDatabaseInitialized();

  const [taskRows, subtaskRows] = await Promise.all([
    db
      .select()
      .from(tasks)
      .orderBy(asc(tasks.position), desc(tasks.createdAt)),
    db
      .select()
      .from(subtasks)
      .orderBy(asc(subtasks.position), asc(subtasks.createdAt)),
  ]);

  const subtasksByTaskId = new Map<string, Subtask[]>();
  for (const row of subtaskRows) {
    const mapped = mapSubtaskRow(row);
    const list = subtasksByTaskId.get(mapped.taskId);
    if (list) {
      list.push(mapped);
    } else {
      subtasksByTaskId.set(mapped.taskId, [mapped]);
    }
  }

  return taskRows.map((row) =>
    mapTaskRow(row, subtasksByTaskId.get(row.id) ?? [])
  );
}

export async function getTaskWithSubtasks(taskId: string): Promise<Task | null> {
  await ensureDatabaseInitialized();

  const [taskRow] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!taskRow) return null;

  const subtaskRows = await db
    .select()
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId))
    .orderBy(asc(subtasks.position), asc(subtasks.createdAt));

  return mapTaskRow(taskRow, subtaskRows.map(mapSubtaskRow));
}
