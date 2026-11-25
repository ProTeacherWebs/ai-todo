import "server-only";
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { z } from "zod";
import type { Quadrant } from "@/types/task";

export const GEMINI_FLASH_CANDIDATES = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
] as const;

export const GROQ_MODEL_CANDIDATES = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.1-8b-instant",
] as const;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_REQUEST_TIMEOUT_MS = 10_000;
const GROQ_REQUEST_TIMEOUT_MS = 15_000;

let cachedWorkingGeminiModel: string | null = null;
let cachedWorkingGroqModel: string | null = null;
let cachedActiveModelLabel: string | null = null;

export class GeminiConfigError extends Error {
  readonly status = 503;

  constructor(
    message = "Не задан ни GEMINI_API_KEY, ни GROQ_API_KEY. Добавьте хотя бы один ключ в .env.local и перезапустите сервер."
  ) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

export class GeminiApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function isAiConfigured(): boolean {
  return isGeminiConfigured() || isGroqConfigured();
}

export function getActiveAiModel(): string | null {
  if (cachedActiveModelLabel) {
    return cachedActiveModelLabel;
  }
  if (isGeminiConfigured()) {
    return process.env.GEMINI_MODEL?.trim() || null;
  }
  if (isGroqConfigured()) {
    return `groq/${process.env.GROQ_MODEL?.trim() || GROQ_MODEL_CANDIDATES[0]}`;
  }
  return null;
}

export function getActiveGeminiModel(): string | null {
  return getActiveAiModel();
}

function deduplicateNonEmpty(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const trimmed = item?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }

  return result;
}

function getGeminiCandidateModels(): string[] {
  return deduplicateNonEmpty([
    process.env.GEMINI_MODEL,
    cachedWorkingGeminiModel,
    ...GEMINI_FLASH_CANDIDATES,
  ]);
}

function getGroqCandidateModels(): string[] {
  return deduplicateNonEmpty([
    process.env.GROQ_MODEL,
    cachedWorkingGroqModel,
    ...GROQ_MODEL_CANDIDATES,
  ]);
}

function getErrorStatusAndMessage(err: unknown): {
  status?: number;
  name?: string;
  message: string;
} {
  if (!err || typeof err !== "object") {
    return { message: String(err ?? "") };
  }

  const record = err as Record<string, unknown>;
  const status =
    typeof record.status === "number"
      ? record.status
      : typeof record.code === "number"
      ? record.code
      : undefined;
  const name = typeof record.name === "string" ? record.name : undefined;
  const message =
    typeof record.message === "string" ? record.message : JSON.stringify(record);

  return { status, name, message };
}

function isInvalidApiKeyError(status: number | undefined, message: string): boolean {
  if (status === 401) return true;
  if (/API_KEY_INVALID|invalid api key|api key not valid|invalid_api_key/i.test(message)) {
    return true;
  }
  return false;
}

function isRetryableModelError(
  status: number | undefined,
  message: string,
  name?: string
): boolean {
  if (
    status === 404 ||
    status === 429 ||
    status === 500 ||
    status === 503
  ) {
    return true;
  }
  if (name === "AbortError" || name === "TimeoutError") {
    return true;
  }
  return /NOT_FOUND|not found|unsupported|is not supported|RESOURCE_EXHAUSTED|quota|UNAVAILABLE|high demand|overloaded|model.*unavailable|does not exist|aborted|timed out/i.test(
    message
  );
}

function stripJsonCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

interface StructuredPromptParams<T> {
  prompt: string;
  systemInstruction: string;
  responseSchema: Schema;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  validator: z.ZodType<T>;
}

async function generateStructuredJsonWithGemini<T>(
  params: StructuredPromptParams<T>
): Promise<{ data: T; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiConfigError("Ключ GEMINI_API_KEY не задан на сервере.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const candidates = getGeminiCandidateModels();

  let lastStatus = 502;
  let lastErrorMessage = "Не удалось получить ответ от Gemini API.";

  for (const model of candidates) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.prompt,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
          temperature: 0.2,
          abortSignal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS),
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        throw new GeminiApiError(
          `Модель ${model} вернула пустой ответ.`,
          502
        );
      }

      const parsedJson = JSON.parse(stripJsonCodeFences(rawText));
      const validated = params.validator.parse(parsedJson);

      cachedWorkingGeminiModel = model;
      cachedActiveModelLabel = model;
      return { data: validated, model };
    } catch (err) {
      if (err instanceof z.ZodError || err instanceof SyntaxError) {
        lastStatus = 502;
        lastErrorMessage =
          "Gemini вернул некорректный JSON-формат. Попробуйте повторить запрос.";
        console.warn(`[Gemini] Schema validation error on ${model}:`, err);
        continue;
      }

      const { status, name, message } = getErrorStatusAndMessage(err);

      if (isInvalidApiKeyError(status, message)) {
        throw new GeminiApiError(
          "Недействительный GEMINI_API_KEY. Проверьте ключ в .env.local.",
          401
        );
      }

      if (isRetryableModelError(status, message, name)) {
        lastStatus = status ?? 503;
        lastErrorMessage = `Модель ${model} временно недоступна (${message.slice(0, 120)}).`;
        console.warn(
          `[Gemini] Fallback from model ${model} (${status ?? name ?? "unknown"}): ${message}`
        );
        if (cachedWorkingGeminiModel === model) {
          cachedWorkingGeminiModel = null;
        }
        continue;
      }

      lastStatus = status ?? 502;
      lastErrorMessage = `Ошибка Gemini API: ${message.slice(0, 180)}`;
      console.error(`[Gemini] Unexpected error on ${model}:`, err);
    }
  }

  throw new GeminiApiError(
    `Не удалось выполнить запрос ни к одной из моделей Gemini Flash (${candidates.join(", ")}). ${lastErrorMessage}`,
    lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502
  );
}

async function callGroqCompletion(params: {
  apiKey: string;
  model: string;
  systemMessage: string;
  prompt: string;
  responseFormat:
    | {
        type: "json_schema";
        json_schema: {
          name: string;
          strict: boolean;
          schema: Record<string, unknown>;
        };
      }
    | { type: "json_object" };
}): Promise<{ ok: true; content: string } | { ok: false; status: number; message: string }> {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.2,
      response_format: params.responseFormat,
      messages: [
        { role: "system", content: params.systemMessage },
        { role: "user", content: params.prompt },
      ],
    }),
    signal: AbortSignal.timeout(GROQ_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "");
    let message = rawBody;
    try {
      const parsedErr = JSON.parse(rawBody) as {
        error?: { message?: string };
      };
      if (parsedErr?.error?.message) {
        message = parsedErr.error.message;
      }
    } catch {
      // Keep rawBody if not JSON
    }
    return {
      ok: false,
      status: response.status,
      message: message || `HTTP ${response.status}`,
    };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    return {
      ok: false,
      status: 502,
      message: `Модель Groq ${params.model} вернула пустой ответ.`,
    };
  }

  return { ok: true, content };
}

async function generateStructuredJsonWithGroq<T>(
  params: StructuredPromptParams<T>
): Promise<{ data: T; model: string }> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiConfigError();
  }

  const candidates = getGroqCandidateModels();
  const systemMessage = [
    params.systemInstruction,
    "",
    "ВАЖНО: Ответь СТРОГО одним валидным JSON-объектом без markdown-разметки и пояснений, соответствующим следующей JSON Schema:",
    JSON.stringify(params.jsonSchema),
  ].join("\n");

  let lastStatus = 502;
  let lastErrorMessage = "Не удалось получить ответ от Groq API.";

  for (const model of candidates) {
    try {
      let completion = await callGroqCompletion({
        apiKey,
        model,
        systemMessage,
        prompt: params.prompt,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: params.schemaName,
            strict: false,
            schema: params.jsonSchema,
          },
        },
      });

      // Fallback to json_object mode if a specific Groq model does not support json_schema
      if (
        !completion.ok &&
        completion.status === 400 &&
        /json_schema|response_format|not supported|unsupported/i.test(
          completion.message
        )
      ) {
        completion = await callGroqCompletion({
          apiKey,
          model,
          systemMessage,
          prompt: params.prompt,
          responseFormat: { type: "json_object" },
        });
      }

      if (!completion.ok) {
        if (isInvalidApiKeyError(completion.status, completion.message)) {
          throw new GeminiApiError(
            "Недействительный GROQ_API_KEY. Проверьте ключ в .env.local.",
            401
          );
        }

        if (isRetryableModelError(completion.status, completion.message)) {
          lastStatus = completion.status;
          lastErrorMessage = `Модель Groq ${model} временно недоступна (${completion.message.slice(0, 120)}).`;
          console.warn(
            `[Groq] Fallback from model ${model} (${completion.status}): ${completion.message}`
          );
          if (cachedWorkingGroqModel === model) {
            cachedWorkingGroqModel = null;
          }
          continue;
        }

        lastStatus = completion.status;
        lastErrorMessage = `Ошибка Groq API (${model}): ${completion.message.slice(0, 160)}`;
        console.error(`[Groq] Unexpected API error on ${model}:`, completion);
        continue;
      }

      const parsedJson = JSON.parse(stripJsonCodeFences(completion.content));
      const validated = params.validator.parse(parsedJson);

      cachedWorkingGroqModel = model;
      const modelLabel = `groq/${model}`;
      cachedActiveModelLabel = modelLabel;
      return { data: validated, model: modelLabel };
    } catch (err) {
      if (err instanceof GeminiApiError) {
        throw err;
      }

      if (err instanceof z.ZodError || err instanceof SyntaxError) {
        lastStatus = 502;
        lastErrorMessage =
          "Groq вернул некорректный JSON-формат. Попробуйте повторить запрос.";
        console.warn(`[Groq] Schema validation error on ${model}:`, err);
        continue;
      }

      const { status, name, message } = getErrorStatusAndMessage(err);
      if (isRetryableModelError(status, message, name)) {
        lastStatus = status ?? 503;
        lastErrorMessage = `Модель Groq ${model} не ответила вовремя (${message.slice(0, 120)}).`;
        console.warn(
          `[Groq] Fallback from model ${model} (${status ?? name ?? "unknown"}): ${message}`
        );
        if (cachedWorkingGroqModel === model) {
          cachedWorkingGroqModel = null;
        }
        continue;
      }

      lastStatus = status ?? 502;
      lastErrorMessage = `Ошибка сети при обращении к Groq API: ${message.slice(0, 160)}`;
      console.error(`[Groq] Unexpected error on ${model}:`, err);
    }
  }

  throw new GeminiApiError(
    `Не удалось выполнить запрос через Groq (${candidates.join(", ")}). ${lastErrorMessage}`,
    lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502
  );
}

async function generateStructuredJson<T>(
  params: StructuredPromptParams<T>
): Promise<{ data: T; model: string }> {
  const hasGemini = isGeminiConfigured();
  const hasGroq = isGroqConfigured();

  if (!hasGemini && !hasGroq) {
    throw new GeminiConfigError();
  }

  if (hasGemini) {
    try {
      return await generateStructuredJsonWithGemini(params);
    } catch (geminiErr) {
      if (!hasGroq) {
        throw geminiErr;
      }

      const { status, message } = getErrorStatusAndMessage(geminiErr);
      console.warn(
        `[AI] Gemini unavailable (${status ?? "error"}: ${message}), falling back to Groq...`
      );
      return await generateStructuredJsonWithGroq(params);
    }
  }

  return await generateStructuredJsonWithGroq(params);
}

function clampToSevenWords(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Приоритет определён ИИ";
  const words = cleaned.split(" ").filter(Boolean);
  return words.slice(0, 7).join(" ");
}

function normalizeDeadline(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(trimmed)) {
    return trimmed;
  }
  const isoPrefix = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(trimmed);
  if (isoPrefix) {
    return `${isoPrefix[1]}T${isoPrefix[2]}`;
  }
  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (dateOnly) {
    return dateOnly[1];
  }
  return null;
}

const QuadrantZod = z.enum([
  "urgent_important",
  "not_urgent_important",
  "urgent_not_important",
  "not_urgent_not_important",
]);

const BrainDumpResponseZod = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(240),
        quadrant: QuadrantZod,
        category: z.string().trim().min(1).max(40),
        priorityReason: z.string().trim().min(1).max(120),
        deadline: z.string().nullable().optional(),
      })
    )
    .min(1)
    .max(15),
});

const brainDumpSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    tasks: {
      type: Type.ARRAY,
      description: "Список извлечённых из текста задач (от 1 до 15).",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Чёткая и лаконичная формулировка задачи на русском.",
          },
          quadrant: {
            type: Type.STRING,
            enum: [
              "urgent_important",
              "not_urgent_important",
              "urgent_not_important",
              "not_urgent_not_important",
            ],
            description: "Квадрант матрицы Эйзенхауэра.",
          },
          category: {
            type: Type.STRING,
            description:
              "Короткая категория на русском (Работа, Здоровье, Учёба, Финансы, Быт, Личное).",
          },
          priorityReason: {
            type: Type.STRING,
            description:
              "Причина приоритета на русском языке (2-7 слов, строго не длиннее 7 слов).",
          },
          deadline: {
            type: Type.STRING,
            nullable: true,
            description:
              "Строгая ISO-дата YYYY-MM-DD или YYYY-MM-DDTHH:mm (например, 2026-11-21 или 2026-11-21T18:00), либо null. Никогда не пиши словами 'Сегодня' или 'Завтра'.",
          },
        },
        required: [
          "title",
          "quadrant",
          "category",
          "priorityReason",
          "deadline",
        ],
      },
    },
  },
  required: ["tasks"],
};

const brainDumpJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    tasks: {
      type: "array",
      minItems: 1,
      maxItems: 15,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          quadrant: {
            type: "string",
            enum: [
              "urgent_important",
              "not_urgent_important",
              "urgent_not_important",
              "not_urgent_not_important",
            ],
          },
          category: { type: "string" },
          priorityReason: { type: "string" },
          deadline: { type: ["string", "null"] },
        },
        required: [
          "title",
          "quadrant",
          "category",
          "priorityReason",
          "deadline",
        ],
      },
    },
  },
  required: ["tasks"],
};

export interface ExtractedBrainDumpTask {
  title: string;
  quadrant: Quadrant;
  category: string;
  priorityReason: string;
  deadline: string | null;
}

export async function parseBrainDumpWithGemini(
  rawText: string,
  clientDate: string,
  timeZone: string
): Promise<{ tasks: ExtractedBrainDumpTask[]; model: string }> {
  const systemInstruction = [
    "Ты — ИИ-ассистент по продуктивности и матрице Эйзенхауэра.",
    "Твоя задача: разобрать неструктурированный текст пользователя (Brain Dump) на отдельные конкретные задачи на русском языке.",
    `Текущая локальная дата пользователя: ${clientDate} (часовой пояс: ${timeZone}).`,
    "Правила:",
    "1) Извлеки от 1 до 15 конкретных задач. Не объединяй разные дела в одну задачу.",
    "2) Определи квадрант Эйзенхауэра: urgent_important (срочно и важно), not_urgent_important (не срочно и важно), urgent_not_important (срочно и не важно), not_urgent_not_important (не срочно и не важно).",
    "3) Определи короткую категорию на русском (например: Работа, Здоровье, Учёба, Финансы, Быт, Личное).",
    "4) Определи deadline относительно текущей даты в формате YYYY-MM-DD или YYYY-MM-DDTHH:mm (если указано время), либо null если срок не указан.",
    "5) Поле priorityReason должно объяснять причину выбранного приоритета на русском языке и содержать СТРОГО не более 7 слов.",
  ].join("\n");

  const { data, model } = await generateStructuredJson({
    prompt: `Разбери следующий поток мыслей в задачи:\n"""\n${rawText}\n"""`,
    systemInstruction,
    responseSchema: brainDumpSchema,
    schemaName: "brain_dump_tasks",
    jsonSchema: brainDumpJsonSchema,
    validator: BrainDumpResponseZod,
  });

  const normalizedTasks: ExtractedBrainDumpTask[] = data.tasks.map((item) => ({
    title: item.title.trim(),
    quadrant: item.quadrant,
    category: item.category.trim(),
    priorityReason: clampToSevenWords(item.priorityReason),
    deadline: normalizeDeadline(item.deadline),
  }));

  return { tasks: normalizedTasks, model };
}

const SubtasksResponseZod = z.object({
  subtasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
      })
    )
    .min(2)
    .max(6),
});

const subtasksSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    subtasks: {
      type: Type.ARRAY,
      description: "Список из 3-6 последовательных конкретных подзадач.",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Формулировка шага на русском языке.",
          },
        },
        required: ["title"],
      },
    },
  },
  required: ["subtasks"],
};

const subtasksJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    subtasks: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  required: ["subtasks"],
};

export async function generateSubtasksWithGemini(task: {
  title: string;
  category: string;
  priorityReason: string;
  deadline: string | null;
}): Promise<{ subtasks: string[]; model: string }> {
  const systemInstruction = [
    "Ты — ИИ-планировщик задач.",
    "Разбей заданную задачу на 3–6 конкретных, последовательных, выполнимых шагов (подзадач) на русском языке.",
    "Каждый шаг должен начинаться с глагола действия и быть коротким и практичным.",
  ].join("\n");

  const prompt = [
    `Задача: ${task.title}`,
    `Категория: ${task.category}`,
    `Причина приоритета: ${task.priorityReason}`,
    task.deadline ? `Дедлайн: ${task.deadline}` : "Дедлайн: не задан",
  ].join("\n");

  const { data, model } = await generateStructuredJson({
    prompt,
    systemInstruction,
    responseSchema: subtasksSchema,
    schemaName: "task_subtasks",
    jsonSchema: subtasksJsonSchema,
    validator: SubtasksResponseZod,
  });

  return {
    subtasks: data.subtasks.map((s) => s.title.trim()),
    model,
  };
}
