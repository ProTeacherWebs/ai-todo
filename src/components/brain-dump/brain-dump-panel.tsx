"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";

interface BrainDumpPanelProps {
  isParsing: boolean;
  onParse: (text: string) => Promise<number>;
}

export function BrainDumpPanel({ isParsing, onParse }: BrainDumpPanelProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleFinalTranscript = useCallback((chunk: string) => {
    setText((prev) => {
      const trimmedPrev = prev.trimEnd();
      if (!trimmedPrev) return chunk;
      return `${trimmedPrev} ${chunk}`;
    });
  }, []);

  const {
    isSupported,
    isListening,
    interimTranscript,
    error: speechError,
    stopListening,
    toggleListening,
  } = useSpeechRecognition({
    lang: "ru-RU",
    onFinalTranscript: handleFinalTranscript,
  });

  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 72), 200)}px`;
  }, [text, interimTranscript]);

  const handleSubmit = async () => {
    const combined = [text.trim(), interimTranscript.trim()]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!combined || isParsing) return;

    if (isListening) {
      stopListening();
    }

    const addedCount = await onParse(combined);
    if (addedCount > 0) {
      setText("");
    }
  };

  const handleMicClick = () => {
    if (!isSupported) {
      toast.error(
        "Голосовой ввод недоступен в этом браузере. Используйте Chrome, Edge или Safari."
      );
      return;
    }
    toggleListening();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const hasContent =
    text.trim().length > 0 || interimTranscript.trim().length > 0;

  return (
    <section
      aria-label="Brain Dump — умный ввод задач"
      className={cn(
        "apple-panel p-4 sm:p-5 transition-shadow duration-200",
        "focus-within:ring-2 focus-within:ring-[var(--accent)]/30",
        isListening && "ring-2 ring-[var(--heat)]/45"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
          Brain Dump
        </span>

        {isListening && (
          <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--heat)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--heat)]" />
            <span>Слушаю · RU</span>
          </div>
        )}
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isParsing}
        rows={2}
        placeholder="Срочно сдать квартальный отчёт сегодня к 18:00, записаться к стоматологу на следующей неделе, разобрать закладки позже..."
        className="w-full resize-none bg-transparent text-[15.5px] leading-[1.6] text-[var(--text)] placeholder:text-[var(--text-4)] focus:outline-none disabled:opacity-60"
      />

      {interimTranscript && (
        <div className="mt-2 rounded-[var(--r-thumb)] bg-[var(--bg)] px-3.5 py-2 text-[13px] text-[var(--text-body)]">
          <span className="mr-2 font-mono text-[11px] uppercase tracking-wide text-[var(--heat)]">
            Речь:
          </span>
          {interimTranscript}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isParsing}
            aria-pressed={isListening}
            className={cn(
              "apple-press inline-flex h-[44px] items-center gap-2 rounded-full px-4 text-[13.5px] font-medium transition-colors",
              isListening
                ? "bg-[var(--heat-bg)] text-[var(--heat)]"
                : isSupported
                ? "bg-black/[0.05] text-[var(--text)] hover:bg-black/[0.08]"
                : "bg-black/[0.04] text-[var(--text-3)]"
            )}
            title={
              isSupported
                ? isListening
                  ? "Остановить голосовой ввод"
                  : "Голосовой ввод (русский)"
                : "Web Speech API не поддерживается в этом браузере"
            }
          >
            {isListening ? (
              <>
                <MicOff className="h-[17px] w-[17px]" strokeWidth={1.75} />
                <span>Остановить</span>
              </>
            ) : (
              <>
                <Mic
                  className="h-[17px] w-[17px] text-[var(--text-2)]"
                  strokeWidth={1.75}
                />
                <span>Голосовой ввод</span>
              </>
            )}
          </button>

          <span className="hidden font-mono text-[11.5px] text-[var(--text-3)] sm:inline">
            ⌘ / Ctrl + Enter
          </span>
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!hasContent || isParsing}
          className={cn(
            "apple-press inline-flex h-[44px] items-center justify-center gap-2 rounded-full px-[22px] text-[14px] font-semibold transition-all",
            "bg-[var(--accent)] text-white shadow-[0_6px_20px_rgba(0,113,227,0.22)] hover:bg-[var(--accent-link)]",
            "disabled:cursor-not-allowed disabled:bg-black/[0.06] disabled:text-[var(--text-4)] disabled:shadow-none"
          )}
        >
          {isParsing ? (
            <>
              <Loader2 className="h-[17px] w-[17px] animate-spin" strokeWidth={1.75} />
              <span>Разбираю задачи...</span>
            </>
          ) : (
            <span>Разобрать с помощью ИИ</span>
          )}
        </button>
      </div>
    </section>
  );
}
