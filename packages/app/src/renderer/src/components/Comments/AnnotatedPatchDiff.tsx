import type { DiffLineAnnotation, SelectedLineRange } from "@pierre/diffs";
import { PatchDiff, type PatchDiffProps } from "@pierre/diffs/react";
import { useCallback, useMemo, useState } from "react";
import { useDispatch } from "react-redux";

import { commentsActions } from "../../store/comments/comments-slice";
import type { CommentThread } from "../../store/comments/comments-types";
import type { AppDispatch } from "../../store/store";
import type { LineRange } from "../../store/walkthrough/walkthrough-types";
import { buildLocalThread, DEFAULT_USER_AUTHOR } from "./comment-helpers";
import { CommentComposer } from "./CommentComposer";
import { CommentThreadView } from "./CommentThreadView";

type Metadata = { kind: "pending"; range: LineRange } | { kind: "thread"; thread: CommentThread };

type PatchDiffOptionsLoose = NonNullable<PatchDiffProps<undefined>["options"]>;
type PatchDiffOptionsMetadata = NonNullable<PatchDiffProps<Metadata>["options"]>;

interface AnnotatedPatchDiffProps {
  filePath: string;
  options: PatchDiffOptionsLoose;
  patch: string;
  prReference: string;
  threads: CommentThread[];
}

export const AnnotatedPatchDiff = ({
  filePath,
  options,
  patch,
  prReference,
  threads,
}: AnnotatedPatchDiffProps): React.JSX.Element => {
  const dispatch = useDispatch<AppDispatch>();
  const [pendingRange, setPendingRange] = useState<LineRange | null>(null);

  const handleGutterClick = useCallback((range: SelectedLineRange) => {
    if (range.side === "deletions") return;
    setPendingRange([range.start, range.end]);
  }, []);

  const fullOptions = useMemo<PatchDiffOptionsMetadata>(
    () =>
      ({
        ...options,
        enableGutterUtility: true,
        onGutterUtilityClick: handleGutterClick,
      }) as PatchDiffOptionsMetadata,
    [options, handleGutterClick],
  );

  const lineAnnotations = useMemo<DiffLineAnnotation<Metadata>[]>(() => {
    const result: DiffLineAnnotation<Metadata>[] = [];
    for (const thread of threads) {
      if (thread.side !== "new") continue;
      if (thread.resolved) continue;
      result.push({
        lineNumber: thread.lineRange[1],
        metadata: { kind: "thread", thread },
        side: "additions",
      });
    }
    if (pendingRange) {
      result.push({
        lineNumber: pendingRange[1],
        metadata: { kind: "pending", range: pendingRange },
        side: "additions",
      });
    }
    return result;
  }, [threads, pendingRange]);

  const submitNewThread = useCallback(
    (range: LineRange, body: string): void => {
      const thread = buildLocalThread({
        author: DEFAULT_USER_AUTHOR,
        body,
        filePath,
        lineRange: range,
        prReference,
      });
      dispatch(commentsActions.addLocalThread({ prReference, thread }));
      dispatch(commentsActions.requestAgentReply({ prReference, threadId: thread.id }));
      setPendingRange(null);
    },
    [dispatch, filePath, prReference],
  );

  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<Metadata>) => {
      const metadata = annotation.metadata;
      if (metadata.kind === "thread") {
        return (
          <div className="sticky left-0 z-10 w-full min-w-0 max-w-2xl px-2 py-1.5 font-sans">
            <CommentThreadView thread={metadata.thread} />
          </div>
        );
      }
      return (
        <div className="sticky left-0 z-10 w-full min-w-0 max-w-2xl px-2 py-1.5 font-sans">
          <CommentComposer
            focusOnMount
            onCancel={() => setPendingRange(null)}
            onSubmit={(body) => submitNewThread(metadata.range, body)}
          />
        </div>
      );
    },
    [submitNewThread],
  );

  return (
    <PatchDiff<Metadata>
      lineAnnotations={lineAnnotations}
      options={fullOptions}
      patch={patch}
      renderAnnotation={renderAnnotation}
    />
  );
};
