import { ArrowRight, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FollowUpComposerProps {
  disabled?: boolean;
  isStreaming?: boolean;
  onSubmit: (question: string) => void;
  suggestedQuestions: string[];
}

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

  return (
    <div className="flex flex-col gap-3">
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
          <ArrowRight />
        </Button>
      </form>
      {suggestedQuestions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            <Sparkles aria-hidden="true" className="size-3" />
            Suggested
          </p>
          <ul className="flex flex-col gap-1">
            {suggestedQuestions.map((question) => (
              <li key={question}>
                <button
                  className="w-full rounded-md border bg-card px-3 py-1.5 text-left text-xs text-foreground hover:border-primary/40 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => submit(question)}
                  type="button"
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
