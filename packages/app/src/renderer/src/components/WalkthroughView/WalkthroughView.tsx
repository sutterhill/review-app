import { Bars3Icon, Squares2X2Icon } from "@heroicons/react/16/solid";
import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { cn } from "@/lib/utils";

import { usePRContext } from "../../routes/pr-context";
import type { PullRequestData, PullRequestFile } from "../../store/pr/pr-types";
import type { AppDispatch } from "../../store/store";
import { selectViewedFilesForPr } from "../../store/viewed-files/viewed-files-selectors";
import { viewedFilesActions } from "../../store/viewed-files/viewed-files-slice";
import { selectStreamingPreview } from "../../store/walkthrough/walkthrough-selectors";
import type { LineRange, WalkthroughMessage } from "../../store/walkthrough/walkthrough-types";
import { CollapseChevron } from "../CollapseChevron";
import { DIFF_OPTIONS } from "../diff-utils";
import { parseUnifiedDiff } from "../DiffView/diff-parser";
import { StreamingLine } from "../StreamingLine";
import { FileDiffPanel } from "./FileDiffPanel";
import { FileMasonryCard } from "./FileMasonryCard";
import { FileOverlayPanel } from "./FileOverlayPanel";
import { FollowUpComposer } from "./FollowUpComposer";
import { DescriptionSkeleton, StepSkeleton } from "./StepSkeleton";
import { WalkthroughStep } from "./WalkthroughStep";
import {
  WalkthroughTOC,
  type WalkthroughTOCEntry,
  type WalkthroughTOCSection,
} from "./WalkthroughTOC";

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
  const lastMessage = messages[messages.length - 1];
  const suggestedQuestions = lastMessage?.parsed?.suggestedQuestions ?? [];
  const streamingPreview = useSelector(selectStreamingPreview);
  const allSteps = useMemo(() => collectSteps(messages), [messages]);
  const [activeStepKey, setActiveStepKey] = useState<null | string>(allSteps[0]?.key ?? null);
  const [selectedPath, setSelectedPath] = useState<null | string>(null);
  const [emphasizedRanges, setEmphasizedRanges] = useState<LineRange[]>([]);
  const [unlinkedLayout, setUnlinkedLayout] = useState<UnlinkedLayout>("masonry");
  const [expandedUnlinked, setExpandedUnlinked] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const stepRefs = useRef(new Map<string, HTMLElement>());

  const toggleUnlinkedExpanded = useCallback((messageId: string) => {
    setExpandedUnlinked((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

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

  const unlinkedByMessage = useMemo<ReadonlyMap<string, PullRequestFile[]>>(() => {
    const map = new Map<string, PullRequestFile[]>();
    for (const message of messages) {
      const referenced = new Set<string>();
      for (const { message: m, step } of allSteps) {
        if (m.id !== message.id) continue;
        for (const ref of step.relevantFiles ?? []) referenced.add(ref.path);
      }
      map.set(
        message.id,
        pullRequest.files.filter((file) => !referenced.has(file.filename)),
      );
    }
    return map;
  }, [allSteps, messages, pullRequest.files]);

  const handleRefClick = useCallback((path: string, lineRanges: LineRange[]) => {
    setSelectedPath(path);
    setEmphasizedRanges(lineRanges);
  }, []);

  const dispatch = useDispatch<AppDispatch>();
  const prReference = pullRequest.metadata.reference;
  const viewedPaths = useSelector(selectViewedFilesForPr(prReference));
  const viewedSet = useMemo(() => new Set(viewedPaths), [viewedPaths]);
  const handleToggleViewed = useCallback(
    (path: string, viewed: boolean) => {
      dispatch(viewedFilesActions.setViewed({ path, prReference, viewed }));
    },
    [dispatch, prReference],
  );

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

  const stepIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    const perMessage = new Map<string, number>();
    for (const { key, message } of allSteps) {
      const next = (perMessage.get(message.id) ?? 0) + 1;
      perMessage.set(message.id, next);
      map.set(key, next - 1);
    }
    return map;
  }, [allSteps]);

  const tocSections = useMemo<WalkthroughTOCSection[]>(() => {
    const entriesByMessage = new Map<string, WalkthroughTOCEntry[]>();
    for (const { key, message, step } of allSteps) {
      const list = entriesByMessage.get(message.id) ?? [];
      list.push({ heading: step.heading, key, number: list.length + 1 });
      entriesByMessage.set(message.id, list);
    }
    return messages.map((message, index) => ({
      entries: entriesByMessage.get(message.id) ?? [],
      id: message.id,
      kind: message.kind,
      title:
        message.kind === "follow-up"
          ? (message.question ?? "Follow-up question")
          : index === 0
            ? "Overview"
            : `Walkthrough ${index + 1}`,
    }));
  }, [allSteps, messages]);

  const activeSectionId = useMemo<null | string>(() => {
    if (activeStepKey) {
      const entry = allSteps.find((step) => step.key === activeStepKey);
      if (entry) return entry.message.id;
    }
    return messages[0]?.id ?? null;
  }, [activeStepKey, allSteps, messages]);

  useEffect(() => {
    setSidebar(
      <WalkthroughTOC
        activeKey={activeStepKey}
        activeSectionId={activeSectionId}
        onSelect={handleTOCSelect}
        sections={tocSections}
      />,
    );
    return () => setSidebar(null);
  }, [activeSectionId, activeStepKey, handleTOCSelect, setSidebar, tocSections]);

  const gridTemplateColumns = `minmax(0,${leftRatio}fr) 6px minmax(0,${100 - leftRatio}fr)`;
  const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <WorkerPoolContextProvider
      highlighterOptions={DIFF_HIGHLIGHTER_OPTIONS}
      poolOptions={DIFF_WORKER_POOL_OPTIONS}
    >
      <div className="relative" ref={splitContainerRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 px-8 pt-8 pb-4">
            <DescriptionSkeleton />
            {isStreaming ? <StreamingLine text={streamingPreview} /> : null}
          </div>
        ) : null}
        {messages.map((message, messageIndex) => {
          const isInitial = message.kind === "initial";
          const stepsForMessage = allSteps.filter((entry) => entry.message.id === message.id);
          const isLastMessage = message.id === lastMessageId;
          const messageIsLoading = stepsForMessage.length === 0 && isLastMessage && isStreaming;
          const trailingSkeleton = stepsForMessage.length > 0 && isLastMessage && isStreaming;

          return (
            <Fragment key={message.id}>
              {messageIndex > 0 ? (
                <hr aria-hidden="true" className="mx-8 my-2 border-border/60" />
              ) : null}
              {isInitial ? (
                message.parsed?.description ? (
                  <p className="px-8 pt-8 pb-4 text-[1.02rem] font-light leading-[1.55] text-foreground">
                    {message.parsed.description}
                  </p>
                ) : (
                  <div className="px-8 pt-8 pb-4">
                    <DescriptionSkeleton />
                  </div>
                )
              ) : (
                <div className="px-8 pt-8 pb-4">
                  <p className="text-xs text-muted-foreground italic">Follow-up</p>
                  {message.question ? (
                    <p className="mt-1 text-[1.02rem] font-light leading-[1.55] text-foreground">
                      {message.question}
                    </p>
                  ) : null}
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid" style={{ gridTemplateColumns }}>
                <button
                  aria-label={`Resize columns (left column ${Math.round(leftRatio)}%)`}
                  className="hidden cursor-col-resize items-stretch justify-center bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:flex"
                  onKeyDown={handleResizeKeyDown}
                  onMouseDown={handleResizeStart}
                  style={{ gridColumn: "2 / 3", gridRow: "1 / -1" }}
                  type="button"
                />
                {messageIsLoading ? (
                  <div className="flex flex-col gap-12 px-8 py-6 lg:col-start-1">
                    <StreamingLine text={streamingPreview} />
                    <StepSkeleton />
                    <StepSkeleton />
                    <StepSkeleton />
                  </div>
                ) : null}
                {stepsForMessage.map(({ key, step }) => {
                  const stepIndex = stepIndexByKey.get(key) ?? 0;
                  return (
                    <Fragment key={key}>
                      <div
                        className="scroll-mt-40 px-8 pt-16 pb-32 lg:col-start-1"
                        data-step-key={key}
                        ref={(element) => registerStep(key, element)}
                      >
                        <div className="sticky top-[10rem]">
                          <WalkthroughStep
                            index={stepIndex}
                            isActive={key === activeStepKey}
                            onRefClick={handleRefClick}
                            step={step}
                          />
                        </div>
                      </div>
                      <div className="px-4 pt-16 pb-32 lg:col-start-3">
                        {stepFiles[key] && stepFiles[key].length > 0 ? (
                          <div
                            aria-label="Files referenced in this step"
                            className="flex flex-col gap-16"
                          >
                            {stepFiles[key].map((file) => (
                              <FileDiffPanel
                                file={file}
                                isViewed={viewedSet.has(file.filename)}
                                key={file.filename}
                                onOpen={setSelectedPath}
                                onToggleViewed={handleToggleViewed}
                                patch={patchByPath.get(file.filename) ?? ""}
                                prReference={prReference}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </Fragment>
                  );
                })}
                {trailingSkeleton ? (
                  <div className="px-8 py-6 lg:col-start-1">
                    <StepSkeleton />
                  </div>
                ) : null}
              </div>
              <UnlinkedFilesSection
                expanded={expandedUnlinked.has(message.id)}
                files={unlinkedByMessage.get(message.id) ?? []}
                layout={unlinkedLayout}
                maxFileLines={maxFileLines}
                onLayoutChange={setUnlinkedLayout}
                onOpen={setSelectedPath}
                onToggleExpanded={() => toggleUnlinkedExpanded(message.id)}
                onToggleViewed={handleToggleViewed}
                patchByPath={patchByPath}
                prReference={prReference}
                selectedPath={selectedPath}
                viewedSet={viewedSet}
              />
            </Fragment>
          );
        })}
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
            isViewed={viewedSet.has(selectedPath)}
            onClose={() => {
              setSelectedPath(null);
              setEmphasizedRanges([]);
            }}
            onOpenInChanges={() => onOpenInChanges(selectedPath)}
            onToggleViewed={handleToggleViewed}
            pullRequest={pullRequest}
            selectedPath={selectedPath}
          />
        ) : null}
      </div>
    </WorkerPoolContextProvider>
  );
};

type UnlinkedLayout = "masonry" | "stacked";

interface UnlinkedFilesSectionProps {
  expanded: boolean;
  files: PullRequestFile[];
  layout: UnlinkedLayout;
  maxFileLines: number;
  onLayoutChange: (layout: UnlinkedLayout) => void;
  onOpen: (path: string) => void;
  onToggleExpanded: () => void;
  onToggleViewed: (path: string, viewed: boolean) => void;
  patchByPath: ReadonlyMap<string, string>;
  prReference: string;
  selectedPath: null | string;
  viewedSet: ReadonlySet<string>;
}

const UnlinkedFilesSection = ({
  expanded,
  files,
  layout,
  maxFileLines,
  onLayoutChange,
  onOpen,
  onToggleExpanded,
  onToggleViewed,
  patchByPath,
  prReference,
  selectedPath,
  viewedSet,
}: UnlinkedFilesSectionProps): null | React.JSX.Element => {
  if (files.length === 0) return null;
  const collapsedHeight = layout === "masonry" ? 360 : 520;
  const collapsible = files.length > 4;
  const isExpanded = !collapsible || expanded;
  return (
    <section
      aria-label="All other files"
      className="flex flex-col gap-4 border-t border-border/60 px-8 py-8"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[0.95rem] font-medium text-foreground">
          All other{" "}
          <span className="ml-1 font-normal tabular-nums text-muted-foreground">
            {files.length}
          </span>
        </h2>
        <UnlinkedLayoutToggle layout={layout} onChange={onLayoutChange} />
      </div>
      <div className="relative">
        <div
          className="overflow-hidden"
          style={isExpanded ? undefined : { maxHeight: collapsedHeight }}
        >
          {layout === "masonry" ? (
            <div className="flex flex-wrap items-start gap-3">
              {files.map((file) => (
                <FileMasonryCard
                  active={selectedPath === file.filename}
                  file={file}
                  key={file.filename}
                  maxFileLines={maxFileLines}
                  onClick={onOpen}
                  relevant={false}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {files.map((file) => (
                <FileDiffPanel
                  file={file}
                  isViewed={viewedSet.has(file.filename)}
                  key={file.filename}
                  onOpen={onOpen}
                  onToggleViewed={onToggleViewed}
                  patch={patchByPath.get(file.filename) ?? ""}
                  prReference={prReference}
                />
              ))}
            </div>
          )}
        </div>
        {!isExpanded ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
        ) : null}
        {collapsible ? (
          <div className="mt-3 flex justify-center">
            <button
              aria-expanded={isExpanded}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-[0.8rem] font-medium text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
              onClick={onToggleExpanded}
              type="button"
            >
              <CollapseChevron className="h-3.5 w-3.5" collapsed={!isExpanded} />
              {isExpanded ? "Show less" : `Show ${files.length} files`}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
};

interface UnlinkedLayoutToggleProps {
  layout: UnlinkedLayout;
  onChange: (layout: UnlinkedLayout) => void;
}

const UnlinkedLayoutToggle = ({
  layout,
  onChange,
}: UnlinkedLayoutToggleProps): React.JSX.Element => {
  return (
    <div
      aria-label="Layout"
      className="inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background p-0.5"
    >
      <button
        aria-label="Grid layout"
        aria-pressed={layout === "masonry"}
        className={cn(
          "flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          layout === "masonry" && "bg-muted text-foreground",
        )}
        onClick={() => onChange("masonry")}
        type="button"
      >
        <Squares2X2Icon className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label="Stacked layout"
        aria-pressed={layout === "stacked"}
        className={cn(
          "flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          layout === "stacked" && "bg-muted text-foreground",
        )}
        onClick={() => onChange("stacked")}
        type="button"
      >
        <Bars3Icon className="h-3.5 w-3.5" />
      </button>
    </div>
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
