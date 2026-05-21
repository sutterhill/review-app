import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePRContext } from "../../routes/pr-context";
import type { PullRequestData } from "../../store/pr/pr-types";
import type { LineRange, WalkthroughMessage } from "../../store/walkthrough/walkthrough-types";
import { DIFF_OPTIONS } from "../diff-utils";
import { FileOverlayPanel } from "./FileOverlayPanel";
import { FollowUpComposer } from "./FollowUpComposer";
import { MasonryGroups } from "./MasonryGroups";
import { normalizeLineRanges } from "./normalize-line-ranges";
import { DescriptionSkeleton, StepSkeleton } from "./StepSkeleton";
import { WalkthroughStep } from "./WalkthroughStep";
import { WalkthroughTOC, type WalkthroughTOCEntry } from "./WalkthroughTOC";

interface WalkthroughViewProps {
  isStreaming: boolean;
  messages: WalkthroughMessage[];
  onAskFollowUp: (question: string) => void;
  onOpenInChanges: (path: string) => void;
  pullRequest: PullRequestData;
}

export const WalkthroughView = ({
  isStreaming,
  messages,
  onAskFollowUp,
  onOpenInChanges,
  pullRequest,
}: WalkthroughViewProps): React.JSX.Element => {
  const initialMessage = messages.find((message) => message.kind === "initial");
  const initialResponse = initialMessage?.parsed;
  const groups = initialResponse?.groups ?? [];
  const lastMessage = messages[messages.length - 1];
  const suggestedQuestions = lastMessage?.parsed?.suggestedQuestions ?? [];
  const allSteps = useMemo(() => collectSteps(messages), [messages]);
  const [activeStepKey, setActiveStepKey] = useState<null | string>(allSteps[0]?.key ?? null);
  const [selectedPath, setSelectedPath] = useState<null | string>(null);
  const [emphasizedRanges, setEmphasizedRanges] = useState<LineRange[]>([]);
  const stepRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (activeStepKey && !allSteps.some((step) => step.key === activeStepKey)) {
      setActiveStepKey(allSteps[0]?.key ?? null);
    }
  }, [allSteps, activeStepKey]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || allSteps.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const next = visible[0]?.target as HTMLElement | undefined;
        const nextKey = next?.dataset.stepKey;
        if (nextKey) setActiveStepKey(nextKey);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );
    for (const [, element] of stepRefs.current) observer.observe(element);
    return () => observer.disconnect();
  }, [allSteps]);

  const activeStep = allSteps.find((step) => step.key === activeStepKey);
  const activeFiles = useMemo<ReadonlySet<string>>(
    () => new Set((activeStep?.step.relevantFiles ?? []).map((file) => file.path)),
    [activeStep],
  );
  const filesByPath = useMemo<ReadonlyMap<string, (typeof pullRequest.files)[number]>>(() => {
    const map = new Map<string, (typeof pullRequest.files)[number]>();
    for (const file of pullRequest.files) map.set(file.filename, file);
    return map;
  }, [pullRequest.files]);
  const stepEmphasis = useMemo<Record<string, LineRange[]>>(() => {
    const map: Record<string, LineRange[]> = {};
    for (const file of activeStep?.step.relevantFiles ?? []) {
      const ranges = normalizeLineRanges(file.lineRanges);
      if (ranges.length > 0) {
        map[file.path] = (map[file.path] ?? []).concat(ranges);
      }
    }
    return map;
  }, [activeStep]);

  const handleRefClick = useCallback((path: string, lineRanges: LineRange[]) => {
    setSelectedPath(path);
    setEmphasizedRanges(lineRanges);
  }, []);

  const registerStep = useCallback((key: string, element: HTMLElement | null) => {
    if (element) stepRefs.current.set(key, element);
    else stepRefs.current.delete(key);
  }, []);

  const handleTOCSelect = useCallback((key: string) => {
    const element = stepRefs.current.get(key);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [leftRatio, setLeftRatio] = useState(40);
  const isDraggingRef = useRef(false);

  const handleResizeStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleResizeKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setLeftRatio((value) => Math.max(25, value - 2));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setLeftRatio((value) => Math.min(75, value + 2));
    }
  }, []);

  useEffect(() => {
    const handleMove = (event: MouseEvent): void => {
      if (!isDraggingRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pct = ((event.clientX - rect.left) / rect.width) * 100;
      setLeftRatio(Math.max(25, Math.min(75, pct)));
    };
    const handleUp = (): void => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const { setSidebar } = usePRContext();
  const tocEntries = useMemo<WalkthroughTOCEntry[]>(
    () => allSteps.map(({ key, step }) => ({ heading: step.heading, key })),
    [allSteps],
  );
  useEffect(() => {
    setSidebar(
      <WalkthroughTOC activeKey={activeStepKey} entries={tocEntries} onSelect={handleTOCSelect} />,
    );
    return () => setSidebar(null);
  }, [activeStepKey, handleTOCSelect, setSidebar, tocEntries]);

  return (
    <WorkerPoolContextProvider
      highlighterOptions={DIFF_HIGHLIGHTER_OPTIONS}
      poolOptions={DIFF_WORKER_POOL_OPTIONS}
    >
      <div
        className="grid min-h-[calc(100vh-9rem)] grid-cols-1 lg:grid"
        ref={splitContainerRef}
        style={{
          gridTemplateColumns: `minmax(0,${leftRatio}fr) 6px minmax(0,${100 - leftRatio}fr)`,
        }}
      >
        <div className="flex flex-col gap-6 border-r px-8 py-8">
          <div aria-label="Walkthrough description" className="flex flex-col gap-2">
            {initialResponse?.description ? (
              <p className="text-[1.02rem] font-light leading-[1.55] text-foreground">
                {initialResponse.description}
              </p>
            ) : (
              <DescriptionSkeleton />
            )}
          </div>
          <div className="flex flex-col gap-12" aria-label="Walkthrough steps">
            {allSteps.length === 0 && isStreaming ? (
              <>
                <StepSkeleton />
                <StepSkeleton />
                <StepSkeleton />
              </>
            ) : null}
            {allSteps.map(({ key, message, step }, index) => (
              <div
                className="scroll-mt-32"
                data-step-key={key}
                key={key}
                ref={(element) => registerStep(key, element)}
              >
                {message.kind === "follow-up" &&
                index > 0 &&
                allSteps[index - 1]?.message.id !== message.id ? (
                  <p className="mb-3 text-xs text-muted-foreground italic">
                    Follow-up: <span className="not-italic">{message.question}</span>
                  </p>
                ) : null}
                <WalkthroughStep
                  filesByPath={filesByPath}
                  index={index}
                  isActive={key === activeStepKey}
                  onRefClick={handleRefClick}
                  step={step}
                />
              </div>
            ))}
            {isStreaming && allSteps.length > 0 ? <StepSkeleton /> : null}
          </div>
          <div className="mt-2">
            <FollowUpComposer
              disabled={isStreaming}
              isStreaming={isStreaming}
              onSubmit={onAskFollowUp}
              suggestedQuestions={suggestedQuestions}
            />
          </div>
        </div>
        <button
          aria-label={`Resize columns (left column ${Math.round(leftRatio)}%)`}
          className="group hidden cursor-col-resize items-stretch justify-center bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:flex"
          onKeyDown={handleResizeKeyDown}
          onMouseDown={handleResizeStart}
          type="button"
        >
          <span className="h-full w-px bg-border transition-colors group-hover:bg-foreground/30" />
        </button>
        <div className="px-4 py-6">
          <div className="sticky top-[8.5rem] max-h-[calc(100vh-9.5rem)] overflow-y-auto pr-2">
            <MasonryGroups
              activeFiles={activeFiles}
              emphasizedRanges={stepEmphasis}
              files={pullRequest.files}
              groups={groups}
              onSelect={setSelectedPath}
              selectedPath={selectedPath}
            />
            {selectedPath ? (
              <FileOverlayPanel
                emphasizedRanges={emphasizedRanges}
                onClose={() => {
                  setSelectedPath(null);
                  setEmphasizedRanges([]);
                }}
                onOpenInChanges={() => onOpenInChanges(selectedPath)}
                pullRequest={pullRequest}
                selectedPath={selectedPath}
              />
            ) : null}
          </div>
        </div>
      </div>
    </WorkerPoolContextProvider>
  );
};

const DIFF_WORKER_POOL_OPTIONS = {
  poolSize: 2,
  totalASTLRUCacheSize: 200,
  workerFactory: (): Worker =>
    new Worker(new URL("@pierre/diffs/worker/worker.js", import.meta.url), { type: "module" }),
};

const DIFF_HIGHLIGHTER_OPTIONS = {
  maxLineDiffLength: 1000,
  theme: DIFF_OPTIONS.theme,
  tokenizeMaxLineLength: 1000,
};

const collectSteps = (
  messages: WalkthroughMessage[],
): Array<{
  key: string;
  message: WalkthroughMessage;
  step: WalkthroughMessage["parsed"] extends null
    ? never
    : NonNullable<WalkthroughMessage["parsed"]>["steps"][number];
}> => {
  const result: Array<{
    key: string;
    message: WalkthroughMessage;
    step: NonNullable<WalkthroughMessage["parsed"]>["steps"][number];
  }> = [];
  for (const message of messages) {
    const steps = message.parsed?.steps ?? [];
    steps.forEach((step, index) => {
      result.push({ key: `${message.id}-${index}`, message, step });
    });
  }
  return result;
};
