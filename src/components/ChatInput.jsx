import { useState, useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";

export default function ChatInput({ onSend, disabled, onStop, streaming, draft }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  // 一键引用：把文献内容填入输入框并聚焦，用户可继续补充问题后发送
  useEffect(() => {
    if (draft?.text) {
      setValue(draft.text);
      textareaRef.current?.focus();
    }
  }, [draft]);

  const submit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <form onSubmit={submit} className="px-4 sm:px-6 pb-5 pt-2">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-background px-3 py-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          rows={1}
          placeholder="Ask your SciencePal agent anything…"
          className="max-h-40 min-h-6 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        {streaming ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : (
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background transition hover:opacity-80 disabled:opacity-30"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Powered by SciencePal · conversations are stored on your SciencePal account
      </p>
    </form>
  );
}