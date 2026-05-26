import {
  ChatBubbleLeftIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  HandThumbUpIcon,
  NoSymbolIcon,
  SparklesIcon,
} from "@heroicons/react/16/solid";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";

import type { CommentCategory } from "../../store/comments/comments-types";
import { GithubIcon } from "./GithubIcon";

type HeroIcon = ComponentType<SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;

const CATEGORY_ICON: Record<CommentCategory, HeroIcon> = {
  blocker: NoSymbolIcon,
  comment: ChatBubbleLeftIcon,
  concern: ExclamationCircleIcon,
  nit: SparklesIcon,
  praise: HandThumbUpIcon,
  warning: ExclamationTriangleIcon,
};

const CATEGORY_TITLE: Record<CommentCategory, string> = {
  blocker: "Blocker",
  comment: "Comment",
  concern: "Concern",
  nit: "Nit",
  praise: "Praise",
  warning: "Warning",
};

export type IconKind = CommentCategory | "github";

export const iconKindFor = (input: {
  category?: CommentCategory;
  isGithub?: boolean;
}): IconKind => {
  if (input.isGithub) return "github";
  return input.category ?? "comment";
};

interface CommentCategoryIconProps {
  category?: CommentCategory;
  className?: string;
  isGithub?: boolean;
}

export const CommentCategoryIcon = ({
  category,
  className,
  isGithub,
}: CommentCategoryIconProps): React.JSX.Element => {
  if (isGithub) {
    return <GithubIcon className={className} />;
  }
  const Icon = category ? CATEGORY_ICON[category] : ChatBubbleLeftIcon;
  const title = category ? `${CATEGORY_TITLE[category]} comment` : "Comment";
  return <Icon aria-label={title} className={className} />;
};

interface CommentCategoryIconStackProps {
  className?: string;
  items: Array<{ category?: CommentCategory; isGithub?: boolean }>;
  max?: number;
}

export const CommentCategoryIconStack = ({
  className,
  items,
  max = 3,
}: CommentCategoryIconStackProps): React.JSX.Element | null => {
  if (items.length === 0) return null;
  const seen = new Set<IconKind>();
  const unique: CommentCategoryIconStackProps["items"] = [];
  for (const item of items) {
    const key = iconKindFor(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  const shown = unique.slice(0, max);
  const extra = unique.length - shown.length;
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center", className)}>
      {shown.map((item, index) => (
        <span
          className={cn(
            "inline-flex size-4 items-center justify-center rounded-full border border-border bg-background text-foreground/80",
            index > 0 && "-ml-1.5",
          )}
          key={iconKindFor(item)}
        >
          <CommentCategoryIcon
            category={item.category}
            className="size-2.5"
            isGithub={item.isGithub}
          />
        </span>
      ))}
      {extra > 0 ? (
        <span className="ml-1 text-[0.65rem] font-medium text-muted-foreground">+{extra}</span>
      ) : null}
    </span>
  );
};
