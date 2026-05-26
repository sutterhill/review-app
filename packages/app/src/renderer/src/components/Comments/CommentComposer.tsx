import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface CommentComposerProps {
  className?: string;
  focusOnMount?: boolean;
  initialValue?: string;
  onCancel?: () => void;
  onSubmit: (body: string) => void;
  placeholder?: string;
  submitLabel?: string;
}

export const CommentComposer = ({
  className,
  focusOnMount = false,
  initialValue = "",
  onCancel,
  onSubmit,
  placeholder = "Add a comment…",
  submitLabel = "Ask agent",
}: CommentComposerProps): React.JSX.Element => {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusOnMount) {
      textareaRef.current?.focus();
    }
  }, [focusOnMount]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }, [onSubmit, value]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleSubmit();
        return;
      }
      if (event.key === "Escape" && onCancel) {
        event.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel],
  );

  const isEmpty = value.trim().length === 0;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <textarea
        className="min-h-[60px] w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-[0.8rem] leading-snug text-foreground outline-none focus:border-foreground/40"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={textareaRef}
        value={value}
      />
      <div className="flex items-center justify-end gap-1.5">
        {onCancel ? (
          <button
            className="cursor-pointer rounded-md px-2 py-1 text-[0.75rem] text-muted-foreground hover:text-foreground"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
        <button
          className={cn(
            "cursor-pointer rounded-md bg-foreground px-2.5 py-1 text-[0.75rem] font-medium text-background",
            isEmpty && "cursor-not-allowed opacity-50",
          )}
          disabled={isEmpty}
          onClick={handleSubmit}
          type="button"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
};
