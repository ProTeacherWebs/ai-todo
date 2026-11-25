import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, ensureDatabaseInitialized, subtasks, tasks } from "@/db";
import { mapSubtaskRow } from "@/db/queries";

export const dynamic = "force-dynamic";

const UpdateSubtaskSchema = z.object({
  completed: z.boolean(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = UpdateSubtaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные для обновления подзадачи." },
        { status: 400 }
      );
    }

    await ensureDatabaseInitialized();

    const [existing] = await db
      .select()
      .from(subtasks)
      .where(eq(subtasks.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Подзадача не найдена." },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx
        .update(subtasks)
        .set({ completed: parsed.data.completed })
        .where(eq(subtasks.id, id))
        .returning();

      await tx
        .update(tasks)
        .set({ updatedAt: nowIso })
        .where(eq(tasks.id, existing.taskId));

      return rows;
    });

    return NextResponse.json({ subtask: mapSubtaskRow(updated) });
  } catch (err) {
    console.error("[PATCH /api/subtasks/[id]]", err);
    return NextResponse.json(
      { error: "Не удалось обновить подзадачу." },
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
      .select()
      .from(subtasks)
      .where(eq(subtasks.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Подзадача не найдена." },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx.delete(subtasks).where(eq(subtasks.id, id));
      await tx
        .update(tasks)
        .set({ updatedAt: nowIso })
        .where(eq(tasks.id, existing.taskId));
    });

    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error("[DELETE /api/subtasks/[id]]", err);
    return NextResponse.json(
      { error: "Не удалось удалить подзадачу." },
      { status: 500 }
    );
  }
}
