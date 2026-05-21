import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePRContext } from "../../routes/pr-context";
import type { PullRequestData, PullRequestFile } from "../../store/pr/pr-types";
import type { LineRange, WalkthroughMessage } from "../../store/walkthrough/walkthrough-types";
import { DIFF_OPTIONS } from "../diff-utils";
import { parseUnifiedDiff } from "../DiffView/diff-parser";
import { FileDiffPanel } from "./FileDiffPanel";
import { FileMasonryCard } from "./FileMasonryCard";
import { FileOverlayPanel } from "./FileOverlayPanel";
import { FollowUpComposer } from "./FollowUpComposer";
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

  const filesByPath = useMemo<ReadonlyMap<string, PullRequestFile>>(() => {
    const map = new Map<string, PullRequestFile>();
    for (const file of pullRequest.files) map.set(file.filename, file);
    return map;
  }, [pullRequest.files]);

  const patchByPath = useMemo<ReadonlyMap<string, string>>(() => {
    const parsed = parseUnifiedDiff(pullRequest.diff, pullRequest.files);
    const map = new Map<string, string>();
    for (const entry of parsed) {
      if (entry.patch) map.set(entry.path, entry.patch);
    }
    return map;
  }, [pullRequest.diff, pullRequest.files]);

  const maxFileLines = useMemo(
    () =>
      pullRequest.files.reduce((max, file) => Math.max(max, file.additions + file.deletions), 0),
    [pullRequest.files],
  );

  const stepFiles = useMemo<Record<string, PullRequestFile[]>>(() => {
    const map: Record<string, PullRequestFile[]> = {};
    for (const { key, step } of allSteps) {
      const seen = new Set<string>();
      const list: PullRequestFile[] = [];
      for (const ref of step.relevantFiles ?? []) {
        if (seen.has(ref.path)) continue;
        const file = filesByPath.get(ref.path);
        if (!file) continue;
        seen.add(ref.path);
        list.push(file);
      }
      map[key] = list;
    }
    return map;
  }, [allSteps, filesByPath]);

  const unlinkedFiles = useMemo<PullRequestFile[]>(() => {
    const referenced = new Set<string>();
    for (const { step } of allSteps) {
      for (const ref of step.relevantFiles ?? []) referenced.add(ref.path);
    }
    return pullRequest.files.filter((file) => !referenced.has(file.filename));
  }, [allSteps, pullRequest.files]);

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
      <div className="relative">
        {initialResponse?.description ? (
          <p className="px-8 pt-8 pb-4 text-[1.02rem] font-light leading-[1.55] text-foreground">
            {initialResponse.description}
          </p>
        ) : (
          <div className="px-8 pt-8 pb-4">
            <DescriptionSkeleton />
          </div>
        )}
        <div
          className="grid grid-cols-1 lg:grid"
          ref={splitContainerRef}
          style={{
            gridTemplateColumns: `minmax(0,${leftRatio}fr) 6px minmax(0,${100 - leftRatio}fr)`,
          }}
        >
          <button
            aria-label={`Resize columns (left column ${Math.round(leftRatio)}%)`}
            className="hidden cursor-col-resize items-stretch justify-center bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:flex"
            onKeyDown={handleResizeKeyDown}
            onMouseDown={handleResizeStart}
            style={{ gridColumn: "2 / 3", gridRow: "1 / -1" }}
            type="button"
          />
          {allSteps.length === 0 && isStreaming ? (
            <div className="flex flex-col gap-12 px-8 py-6 lg:col-start-1">
              <StepSkeleton />
              <StepSkeleton />
              <StepSkeleton />
            </div>
          ) : null}
          {allSteps.map(({ key, message, step }, index) => (
            <Fragment key={key}>
              <div
                className="scroll-mt-32 px-8 py-6 lg:col-start-1"
                data-step-key={key}
                ref={(element) => registerStep(key, element)}
              >
                <div className="sticky top-[8.5rem]">
                  {message.kind === "follow-up" &&
                  index > 0 &&
                  allSteps[index - 1]?.message.id !== message.id ? (
                    <p className="mb-3 text-xs text-muted-foreground italic">
                      Follow-up: <span className="not-italic">{message.question}</span>
                    </p>
                  ) : null}
                  <WalkthroughStep
                    index={index}
                    isActive={key === activeStepKey}
                    onRefClick={handleRefClick}
                    step={step}
                  />
                </div>
              </div>
              <div className="px-4 py-6 lg:col-start-3">
                {stepFiles[key] && stepFiles[key].length > 0 ? (
                  <div aria-label="Files referenced in this step" className="flex flex-col gap-6">
                    {stepFiles[key].map((file) => (
                      <FileDiffPanel
                        file={file}
                        key={file.filename}
                        onOpen={setSelectedPath}
                        patch={patchByPath.get(file.filename) ?? ""}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </Fragment>
          ))}
          {isStreaming && allSteps.length > 0 ? (
            <div className="px-8 py-6 lg:col-start-1">
              <StepSkeleton />
            </div>
          ) : null}
        </div>
        {unlinkedFiles.length > 0 ? (
          <section
            aria-label="All other files"
            className="flex flex-col gap-4 border-t border-border/60 px-8 py-8"
          >
            <h2 className="text-[0.95rem] font-medium text-foreground">All other</h2>
            <div className="flex flex-wrap items-start gap-3">
              {unlinkedFiles.map((file) => (
                <FileMasonryCard
                  active={selectedPath === file.filename}
                  file={file}
                  key={file.filename}
                  maxFileLines={maxFileLines}
                  onClick={setSelectedPath}
                  relevant={false}
                />
              ))}
            </div>
          </section>
        ) : null}
        <div className="px-8 py-6">
          <FollowUpComposer
            disabled={isStreaming}
            isStreaming={isStreaming}
            onSubmit={onAskFollowUp}
            suggestedQuestions={suggestedQuestions}
          />
        </div>
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
