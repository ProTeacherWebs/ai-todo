import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, ensureDatabaseInitialized, isTursoCloud, tasks } from "@/db";
import { getAllTasksWithSubtasks, mapTaskRow } from "@/db/queries";
import { getActiveAiModel, isAiConfigured } from "@/lib/gemini";

export const dynamic = "force-dynamic";

const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, "Название задачи обязательно").max(240),
  quadrant: z.enum([
    "urgent_important",
    "not_urgent_important",
    "urgent_not_important",
    "not_urgent_not_important",
  ]),
  category: z.string().trim().min(1).max(40).default("Личное"),
  priorityReason: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .default("Добавлено пользователем вручную"),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/)
    .nullable()
    .optional(),
});

export async function GET() {
  try {
    const taskList = await getAllTasksWithSubtasks();

    return NextResponse.json({
      tasks: taskList,
      meta: {
        aiConfigured: isAiConfigured(),
        activeModel: getActiveAiModel(),
        dbMode: isTursoCloud ? "turso" : "local",
      },
    });
  } catch (err) {
    console.error("[GET /api/tasks]", err);
    return NextResponse.json(
      { error: "Не удалось загрузить задачи из базы данных." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = CreateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Некорректные данные задачи.",
        },
        { status: 400 }
      );
    }

    await ensureDatabaseInitialized();

    const nowIso = new Date().toISOString();
    const id = randomUUID();
    const newRow = {
      id,
      title: parsed.data.title,
      quadrant: parsed.data.quadrant,
      category: parsed.data.category,
      priorityReason: parsed.data.priorityReason,
      deadline: parsed.data.deadline ?? null,
      completed: false,
      completedAt: null,
      position: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const [inserted] = await db.insert(tasks).values(newRow).returning();

    return NextResponse.json(
      { task: mapTaskRow(inserted, []) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/tasks]", err);
    return NextResponse.json(
      { error: "Не удалось создать задачу в базе данных." },
      { status: 500 }
    );
  }
}
