import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, ensureDatabaseInitialized, tasks } from "@/db";
import { mapTaskRow } from "@/db/queries";
import {
  GeminiApiError,
  GeminiConfigError,
  parseBrainDumpWithGemini,
} from "@/lib/gemini";

export const dynamic = "force-dynamic";

const BrainDumpRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(2, "Введите хотя бы пару слов для разбора")
    .max(4000, "Текст слишком длинный (максимум 4000 символов)"),
  clientDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  timeZone: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BrainDumpRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Некорректный формат запроса Brain Dump.",
        },
        { status: 400 }
      );
    }

    const fallbackDate = new Date().toISOString().slice(0, 10);
    const clientDate = parsed.data.clientDate ?? fallbackDate;
    const timeZone = parsed.data.timeZone ?? "UTC";

    const { tasks: extractedTasks, model } = await parseBrainDumpWithGemini(
      parsed.data.text,
      clientDate,
      timeZone
    );

    await ensureDatabaseInitialized();

    const nowMs = Date.now();
    const rowsToInsert = extractedTasks.map((item, index) => {
      const stamp = new Date(nowMs + (extractedTasks.length - index)).toISOString();
      return {
        id: randomUUID(),
        title: item.title,
        quadrant: item.quadrant,
        category: item.category,
        priorityReason: item.priorityReason,
        deadline: item.deadline,
        completed: false,
        completedAt: null,
        position: index,
        createdAt: stamp,
        updatedAt: stamp,
      };
    });

    const insertedRows = await db.transaction(async (tx) => {
      return tx.insert(tasks).values(rowsToInsert).returning();
    });

    const createdTasks = insertedRows.map((row) => mapTaskRow(row, []));

    return NextResponse.json(
      {
        tasks: createdTasks,
        model,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof GeminiConfigError || err instanceof GeminiApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/ai/brain-dump]", err);
    return NextResponse.json(
      { error: "Не удалось разобрать и сохранить задачи." },
      { status: 500 }
    );
  }
}
