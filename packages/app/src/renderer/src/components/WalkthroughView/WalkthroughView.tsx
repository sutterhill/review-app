import { GitPullRequest } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PullRequestData } from "../../store/pr/pr-types";
import type { LineRange, WalkthroughMessage } from "../../store/walkthrough/walkthrough-types";
import { FileOverlayPanel } from "./FileOverlayPanel";
import { FollowUpComposer } from "./FollowUpComposer";
import { MasonryGroups } from "./MasonryGroups";
import { normalizeLineRanges } from "./normalize-line-ranges";
import { DescriptionSkeleton, StepSkeleton } from "./StepSkeleton";
import { WalkthroughStep } from "./WalkthroughStep";

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

  return (
    <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]">
      <div className="flex flex-col gap-6 border-r px-8 py-8">
        <PullRequestHeader pullRequest={pullRequest} />
        <div aria-label="Walkthrough description" className="flex flex-col gap-2">
          {initialResponse?.description ? (
            <p className="text-[0.95rem] leading-7 text-foreground">
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
            <div data-step-key={key} key={key} ref={(element) => registerStep(key, element)}>
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
      <div className="relative px-4 py-6">
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
  );
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

const PullRequestHeader = ({
  pullRequest,
}: {
  pullRequest: PullRequestData;
}): React.JSX.Element => {
  const { metadata } = pullRequest;
  const initial = (metadata.author.login ?? "?").slice(0, 1).toUpperCase();
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-[0.78rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 text-[var(--color-pr-accent,#7c3aed)]">
          <GitPullRequest aria-hidden="true" className="size-3.5" />
          <span className="font-medium">PR #{metadata.number}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          {metadata.author.avatarUrl ? (
            <img
              alt=""
              aria-hidden="true"
              className="size-5 rounded-full border border-border bg-muted object-cover"
              src={metadata.author.avatarUrl}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center rounded-full bg-muted text-[0.6rem] font-medium text-muted-foreground"
            >
              {initial}
            </span>
          )}
          <span className="text-foreground">{metadata.author.login}</span>
        </span>
      </div>
      <h1
        className="font-serif text-[2.6rem] font-normal italic leading-[1.05] tracking-tight text-foreground"
        style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
      >
        {metadata.title}
      </h1>
    </header>
  );
};
