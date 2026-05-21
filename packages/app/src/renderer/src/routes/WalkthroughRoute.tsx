import { RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";

import { WalkthroughView } from "../components/WalkthroughView";
import type { AppDispatch } from "../store/store";
import {
  selectWalkthroughError,
  selectWalkthroughMessages,
  selectWalkthroughStatus,
} from "../store/walkthrough/walkthrough-selectors";
import { walkthroughActions } from "../store/walkthrough/walkthrough-slice";
import { usePRContext } from "./pr-context";

const generateFollowUpId = (): string =>
  `follow-up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const WalkthroughRoute = (): React.JSX.Element => {
  const { prData } = usePRContext();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const messages = useSelector(selectWalkthroughMessages);
  const status = useSelector(selectWalkthroughStatus);
  const error = useSelector(selectWalkthroughError);
  const isStreaming = status === "loading" || status === "streaming";

  const handleRegenerate = useCallback(() => {
    dispatch(walkthroughActions.generateWalkthrough());
  }, [dispatch]);

  const handleAskFollowUp = useCallback(
    (question: string) => {
      dispatch(walkthroughActions.askFollowUp({ id: generateFollowUpId(), question }));
    },
    [dispatch],
  );

  const handleOpenInChanges = useCallback(
    (_path: string) => {
      navigate("../diff");
    },
    [navigate],
  );

  if (status === "idle" && messages.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <p className="text-sm text-muted-foreground">No walkthrough yet.</p>
        <Button onClick={handleRegenerate} size="sm" variant="default">
          Generate walkthrough
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute right-4 top-3 z-10">
        <Button
          aria-label="Regenerate walkthrough"
          disabled={isStreaming}
          onClick={handleRegenerate}
          size="icon-xs"
          variant="ghost"
        >
          <RefreshCw />
        </Button>
      </div>
      {error && messages.length === 0 ? (
        <div className="flex flex-col items-start gap-3 p-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={handleRegenerate} size="sm" variant="default">
            Try again
          </Button>
        </div>
      ) : (
        <WalkthroughView
          isStreaming={isStreaming}
          messages={messages}
          onAskFollowUp={handleAskFollowUp}
          onOpenInChanges={handleOpenInChanges}
          pullRequest={prData}
        />
      )}
    </div>
  );
};
