import { extractStreamingLine } from "../../lib/streaming-line";
import type { RootState } from "../store";
import type {
  WalkthroughGroup,
  WalkthroughMessage,
  WalkthroughResponse,
  WalkthroughStatus,
} from "./walkthrough-types";

export const selectWalkthroughMessages = (state: RootState): WalkthroughMessage[] =>
  state.walkthrough.messages;

export const selectWalkthroughStatus = (state: RootState): WalkthroughStatus =>
  state.walkthrough.status;

export const selectWalkthroughError = (state: RootState): null | string => state.walkthrough.error;

export const selectInitialMessage = (state: RootState): undefined | WalkthroughMessage =>
  state.walkthrough.messages.find((message) => message.kind === "initial");

export const selectInitialResponse = (state: RootState): null | WalkthroughResponse =>
  selectInitialMessage(state)?.parsed ?? null;

export const selectInitialGroups = (state: RootState): WalkthroughGroup[] =>
  selectInitialResponse(state)?.groups ?? [];

export const selectStreamingPreview = (state: RootState): string => {
  const messages = state.walkthrough.messages;
  const last = messages[messages.length - 1];
  if (!last || last.status !== "streaming") return "";
  return extractStreamingLine(last.raw);
};

export const selectSuggestedQuestions = (state: RootState): string[] => {
  const messages = state.walkthrough.messages;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.parsed?.suggestedQuestions?.length) {
      return message.parsed.suggestedQuestions;
    }
  }
  return [];
};
