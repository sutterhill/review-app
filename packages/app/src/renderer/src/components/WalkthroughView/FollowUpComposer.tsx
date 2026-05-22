import { ArrowRightIcon, PaperAirplaneIcon } from "@heroicons/react/16/solid";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FollowUpComposerProps {
  disabled?: boolean;
  isStreaming?: boolean;
  onSubmit: (question: string) => void;
  suggestedQuestions: string[];
}

const MAX_SHORTCUTS = 9;

export const FollowUpComposer = ({
  disabled = false,
  isStreaming = false,
  onSubmit,
  suggestedQuestions,
}: FollowUpComposerProps): React.JSX.Element => {
  const [value, setValue] = useState("");

  const submit = (question: string): void => {
    const trimmed = question.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submit(value);
  };

  useEffect(() => {
    if (disabled || suggestedQuestions.length === 0) return;
    const handler = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const digit = Number.parseInt(event.key, 10);
      if (!Number.isInteger(digit) || digit < 1 || digit > MAX_SHORTCUTS) return;
      const question = suggestedQuestions[digit - 1];
      if (!question) return;
      event.preventDefault();
      submit(question);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="flex flex-col gap-3">
      {suggestedQuestions.length > 0 ? (
        <ul className="flex flex-col">
          {suggestedQuestions.slice(0, MAX_SHORTCUTS).map((question, index) => (
            <li key={question}>
              <button
                className="group flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                onClick={() => submit(question)}
                type="button"
              >
                <PaperAirplaneIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="flex-1 truncate">{question}</span>
                <kbd className="shrink-0 font-mono text-xs text-muted-foreground/70">
                  ^{index + 1}
                </kbd>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        aria-label="Ask a follow-up question"
        className={cn(
          "flex items-end gap-2 rounded-lg border bg-card p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30",
          disabled && "opacity-60",
        )}
        onSubmit={handleSubmit}
      >
        <textarea
          aria-label="Follow-up question"
          className="min-h-[2.5rem] flex-1 resize-none border-none bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit(value);
            }
          }}
          placeholder={isStreaming ? "Generating walkthrough…" : "Ask a follow-up question"}
          rows={2}
          value={value}
        />
        <Button
          aria-label="Send follow-up"
          disabled={disabled || value.trim().length === 0}
          size="icon"
          type="submit"
          variant="default"
        >
          <ArrowRightIcon />
        </Button>
      </form>
    </div>
  );
};
