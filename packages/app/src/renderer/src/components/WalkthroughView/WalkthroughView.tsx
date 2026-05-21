import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

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
      <div className="flex flex-col gap-6 border-r px-6 py-6">
        <div aria-label="Walkthrough description" className="flex flex-col gap-2">
          {initialResponse?.description ? (
            <p className="font-serif text-lg leading-snug text-foreground">
              {initialResponse.description}
            </p>
          ) : (
            <DescriptionSkeleton />
          )}
        </div>
        <div className="flex flex-col gap-6" aria-label="Walkthrough steps">
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
      <div className={cn("relative px-4 py-6")}>
        <div className="sticky top-[7rem] max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
          <MasonryGroups
            activeFiles={activeFiles}
            emphasizedRanges={stepEmphasis}
            files={pullRequest.files}
            groups={groups}
            onSelect={setSelectedPath}
            selectedPath={selectedPath}
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
