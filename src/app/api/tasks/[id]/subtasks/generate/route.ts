import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureDatabaseInitialized, subtasks, tasks } from "@/db";
import { mapSubtaskRow } from "@/db/queries";
import {
  GeminiApiError,
  GeminiConfigError,
  generateSubtasksWithGemini,
} from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await ensureDatabaseInitialized();

    const [taskRow] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!taskRow) {
      return NextResponse.json(
        { error: "Задача не найдена." },
        { status: 404 }
      );
    }

    const { subtasks: generatedTitles, model } =
      await generateSubtasksWithGemini({
        title: taskRow.title,
        category: taskRow.category,
        priorityReason: taskRow.priorityReason,
        deadline: taskRow.deadline ?? null,
      });

    const nowIso = new Date().toISOString();
    const rowsToInsert = generatedTitles.map((title, index) => ({
      id: randomUUID(),
      taskId: id,
      title,
      completed: false,
      position: index,
      createdAt: nowIso,
    }));

    const insertedRows = await db.transaction(async (tx) => {
      await tx.delete(subtasks).where(eq(subtasks.taskId, id));
      const inserted = await tx
        .insert(subtasks)
        .values(rowsToInsert)
        .returning();
      await tx
        .update(tasks)
        .set({ updatedAt: nowIso })
        .where(eq(tasks.id, id));
      return inserted;
    });

    return NextResponse.json(
      {
        subtasks: insertedRows.map(mapSubtaskRow),
        model,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof GeminiConfigError || err instanceof GeminiApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/tasks/[id]/subtasks/generate]", err);
    return NextResponse.json(
      { error: "Не удалось сгенерировать подзадачи." },
      { status: 500 }
    );
  }
}
