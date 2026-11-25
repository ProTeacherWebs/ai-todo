import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, ensureDatabaseInitialized, subtasks, tasks } from "@/db";
import { getTaskWithSubtasks } from "@/db/queries";

export const dynamic = "force-dynamic";

const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    quadrant: z
      .enum([
        "urgent_important",
        "not_urgent_important",
        "urgent_not_important",
        "not_urgent_not_important",
      ])
      .optional(),
    category: z.string().trim().min(1).max(40).optional(),
    priorityReason: z.string().trim().min(1).max(120).optional(),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/)
      .nullable()
      .optional(),
    completed: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Не переданы поля для обновления.",
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = UpdateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Некорректные данные для обновления задачи.",
        },
        { status: 400 }
      );
    }

    await ensureDatabaseInitialized();

    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Задача не найдена." },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Partial<typeof tasks.$inferInsert> = {
      updatedAt: nowIso,
    };

    if (parsed.data.title !== undefined) {
      updatePayload.title = parsed.data.title;
    }
    if (parsed.data.quadrant !== undefined) {
      updatePayload.quadrant = parsed.data.quadrant;
    }
    if (parsed.data.category !== undefined) {
      updatePayload.category = parsed.data.category;
    }
    if (parsed.data.priorityReason !== undefined) {
      updatePayload.priorityReason = parsed.data.priorityReason;
    }
    if (parsed.data.deadline !== undefined) {
      updatePayload.deadline = parsed.data.deadline;
    }
    if (parsed.data.position !== undefined) {
      updatePayload.position = parsed.data.position;
    }
    if (parsed.data.completed !== undefined) {
      updatePayload.completed = parsed.data.completed;
      updatePayload.completedAt = parsed.data.completed ? nowIso : null;
    }

    await db.update(tasks).set(updatePayload).where(eq(tasks.id, id));

    const updatedTask = await getTaskWithSubtasks(id);
    if (!updatedTask) {
      return NextResponse.json(
        { error: "Задача не найдена." },
        { status: 404 }
      );
    }

    return NextResponse.json({ task: updatedTask });
  } catch (err) {
    console.error("[PATCH /api/tasks/[id]]", err);
    return NextResponse.json(
      { error: "Не удалось обновить задачу." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await ensureDatabaseInitialized();

    const [existing] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Задача не найдена." },
        { status: 404 }
      );
    }

    // Explicitly delete child subtasks first inside transaction so stateless HTTP Turso never leaves orphans
    await db.transaction(async (tx) => {
      await tx.delete(subtasks).where(eq(subtasks.taskId, id));
      await tx.delete(tasks).where(eq(tasks.id, id));
    });

    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error("[DELETE /api/tasks/[id]]", err);
    return NextResponse.json(
      { error: "Не удалось удалить задачу." },
      { status: 500 }
    );
  }
}
