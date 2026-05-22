import { ChevronDownIcon } from "@heroicons/react/16/solid";

import { cn } from "@/lib/utils";

interface CollapseChevronProps {
  className?: string;
  collapsed: boolean;
}

export const CollapseChevron = ({
  className,
  collapsed,
}: CollapseChevronProps): React.JSX.Element => (
  <ChevronDownIcon
    aria-hidden
    className={cn(
      "transition-transform duration-200 ease-out motion-reduce:transition-none",
      collapsed && "rotate-90",
      className,
    )}
    data-collapsed={collapsed ? "" : undefined}
  />
);
