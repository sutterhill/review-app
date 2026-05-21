import { useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

interface MermaidDiagramProps {
  className?: string;
  code: string;
}

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

let mermaidPromise: null | Promise<MermaidApi> = null;
let renderCounter = 0;

const loadMermaid = async (): Promise<MermaidApi> => {
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = import("mermaid").then((mod) => {
    const api = (mod.default ?? mod) as unknown as MermaidApi;
    api.initialize({
      flowchart: { curve: "basis", htmlLabels: true, useMaxWidth: true },
      fontFamily: "inherit",
      securityLevel: "strict",
      startOnLoad: false,
      theme: prefersDark() ? "dark" : "default",
    });
    return api;
  });
  return mermaidPromise;
};

const prefersDark = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
};

export const MermaidDiagram = ({ className, code }: MermaidDiagramProps): React.JSX.Element => {
  const baseId = useId().replace(/[^a-zA-Z0-9_-]/gu, "");
  const [svg, setSvg] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    let cancelled = false;
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      setError("Empty diagram");
      setSvg(null);
      return () => {
        cancelled = true;
      };
    }
    setError(null);
    setSvg(null);
    void loadMermaid()
      .then(async (api) => {
        renderCounter += 1;
        const id = `mermaid-${baseId}-${renderCounter}`;
        const { svg: rendered } = await api.render(id, trimmed);
        if (cancelled) return;
        setSvg(rendered);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : "Failed to render diagram";
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [baseId, code]);

  if (error) {
    return (
      <div
        className={cn(
          "rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive",
          className,
        )}
      >
        <p className="font-medium">Diagram failed to render</p>
        <p className="mt-1 opacity-80">{error}</p>
        <pre className="mt-2 overflow-x-auto rounded bg-background/60 p-2 font-mono text-[0.85em]">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <figure
      aria-label="Diagram"
      className={cn(
        "overflow-x-auto rounded-md border border-border bg-background/40 p-3",
        "[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full",
        className,
      )}
    >
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="flex h-16 items-center justify-center text-xs text-muted-foreground">
          Rendering diagram…
        </div>
      )}
    </figure>
  );
};
