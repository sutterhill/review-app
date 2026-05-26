import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/16/solid";

import { cn } from "@/lib/utils";

interface AddCommentButtonProps {
  className?: string;
  onClick: () => void;
}

export const AddCommentButton = ({
  className,
  onClick,
}: AddCommentButtonProps): React.JSX.Element => (
  <button
    aria-label="Add comment"
    className={cn(
      "inline-flex size-4 cursor-pointer items-center justify-center rounded-sm bg-foreground text-background opacity-80 hover:opacity-100",
      className,
    )}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    type="button"
  >
    <ChatBubbleLeftEllipsisIcon className="size-3" />
  </button>
);
