import { CpuChipIcon } from "@heroicons/react/16/solid";

import { cn } from "@/lib/utils";

import type { CommentAuthor } from "../../store/comments/comments-types";

interface CommentAuthorAvatarProps {
  author: CommentAuthor;
  className?: string;
  size?: "lg" | "sm";
}

export const CommentAuthorAvatar = ({
  author,
  className,
  size = "sm",
}: CommentAuthorAvatarProps): React.JSX.Element => {
  const sizeClass = size === "lg" ? "size-6" : "size-5";
  const iconSize = size === "lg" ? "size-3.5" : "size-3";

  if (author.kind === "agent") {
    return (
      <span
        aria-label={`Agent ${author.login}`}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-foreground text-background",
          sizeClass,
          className,
        )}
        title={author.login}
      >
        <CpuChipIcon className={iconSize} />
      </span>
    );
  }

  if (author.avatarUrl) {
    return (
      <img
        alt={author.login}
        className={cn("inline-block shrink-0 rounded-full object-cover", sizeClass, className)}
        src={author.avatarUrl}
        title={author.login}
      />
    );
  }

  const initial = author.login.charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-label={author.login}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-[0.65rem] font-medium text-foreground",
        sizeClass,
        className,
      )}
      title={author.login}
    >
      {initial}
    </span>
  );
};
