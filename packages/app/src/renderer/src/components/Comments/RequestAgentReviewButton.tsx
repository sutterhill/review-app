import { ArrowPathIcon, SparklesIcon, TrashIcon } from "@heroicons/react/16/solid";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Button } from "@/components/ui/button";

import {
  selectAgentReviewState,
  selectHasAgentThreads,
} from "../../store/comments/comments-selectors";
import { commentsActions } from "../../store/comments/comments-slice";
import type { AppDispatch } from "../../store/store";
import { StreamingLine } from "../StreamingLine";

interface RequestAgentReviewButtonProps {
  prReference: string;
}

export const RequestAgentReviewButton = ({
  prReference,
}: RequestAgentReviewButtonProps): React.JSX.Element => {
  const dispatch = useDispatch<AppDispatch>();
  const review = useSelector(selectAgentReviewState(prReference));
  const hasAgentThreads = useSelector(selectHasAgentThreads(prReference));
  const isRunning = review.status === "running";

  const handleClick = useCallback(() => {
    if (isRunning) return;
    dispatch(commentsActions.requestAgentReview({ prReference }));
  }, [dispatch, isRunning, prReference]);

  const handleClear = useCallback(() => {
    if (isRunning) return;
    dispatch(commentsActions.clearAgentThreads({ prReference }));
  }, [dispatch, isRunning, prReference]);

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5">
        <Button
          disabled={isRunning}
          onClick={handleClick}
          size="sm"
          type="button"
          variant="outline"
        >
          {isRunning ? (
            <ArrowPathIcon className="size-3.5 animate-spin" />
          ) : (
            <SparklesIcon className="size-3.5" />
          )}
          {isRunning ? "Reviewing…" : "Request agent review"}
        </Button>
        {hasAgentThreads ? (
          <Button
            aria-label="Clear review comments"
            disabled={isRunning}
            onClick={handleClear}
            size="sm"
            title="Clear review comments"
            type="button"
            variant="ghost"
          >
            <TrashIcon className="size-3.5" />
            Clear
          </Button>
        ) : null}
      </div>
      {isRunning ? <StreamingLine className="max-w-full" text={review.preview ?? ""} /> : null}
      {review.status === "failed" && review.error ? (
        <p className="text-[0.7rem] text-destructive">{review.error}</p>
      ) : null}
    </div>
  );
};
