import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CollapseContentProps {
  children: ReactNode;
  className?: string;
  collapsed: boolean;
  durationMs?: number;
}

/**
 * Animates the height of `children` between 0 and auto using the
 * `grid-template-rows` trick. Heavy children stay mounted for the duration of
 * the collapse transition and are unmounted afterwards so the DOM stays light
 * once a file has been fully collapsed.
 */
export const CollapseContent = ({
  children,
  className,
  collapsed,
  durationMs = 200,
}: CollapseContentProps): React.JSX.Element => {
  const [renderChildren, setRenderChildren] = useState(!collapsed);

  useEffect(() => {
    if (!collapsed) {
      setRenderChildren(true);
      return;
    }
    const id = window.setTimeout(() => setRenderChildren(false), durationMs);
    return () => window.clearTimeout(id);
  }, [collapsed, durationMs]);

  return (
    <div
      aria-hidden={collapsed || undefined}
      className={cn(
        "grid transition-[grid-template-rows] ease-out motion-reduce:transition-none",
        collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
        className,
      )}
      data-collapsed={collapsed ? "" : undefined}
      style={{ transitionDuration: `${durationMs}ms` }}
    >
      <div className="min-h-0 overflow-hidden">{renderChildren ? children : null}</div>
    </div>
  );
};
