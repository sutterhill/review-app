import { eventChannel, type EventChannel } from "redux-saga";
import { all, call, put, select, take, takeEvery, takeLatest } from "redux-saga/effects";

import { parsePartialJson } from "../../../services/parse-partial-json";
import {
  buildWalkthroughAgentRequest,
  startWalkthroughAgentSession,
  type WalkthroughAgentEvent,
  type WalkthroughAgentHistoryEntry,
  type WalkthroughAgentRequest,
} from "../../../services/walkthrough-agent";
import { selectPrData } from "../../pr/pr-selectors";
import type { PullRequestData } from "../../pr/pr-types";
import { selectWalkthroughMessages } from "../walkthrough-selectors";
import { walkthroughActions } from "../walkthrough-slice";
import type { WalkthroughMessage, WalkthroughResponse } from "../walkthrough-types";

export function createWalkthroughAgentChannel(
  request: WalkthroughAgentRequest,
): EventChannel<WalkthroughAgentEvent> {
  return eventChannel((emit) => {
    const controller = startWalkthroughAgentSession(request, emit);
    return () => controller.abort();
  });
}

export const saveWalkthroughToDisk = async (
  prReference: string,
  content: string,
): Promise<void> => {
  if (typeof window === "undefined" || !window.reviewAppWalkthrough) {
    throw new Error("Walkthrough persistence API is unavailable.");
  }
  await window.reviewAppWalkthrough.save(prReference, content);
};

export const loadWalkthroughFromDisk = async (prReference: string): Promise<null | string> => {
  if (typeof window === "undefined" || !window.reviewAppWalkthrough) {
    throw new Error("Walkthrough persistence API is unavailable.");
  }
  return window.reviewAppWalkthrough.load(prReference);
};

const buildHistory = (messages: WalkthroughMessage[]): WalkthroughAgentHistoryEntry[] =>
  messages
    .filter((message): message is WalkthroughMessage & { raw: string } => message.raw.length > 0)
    .map((message) => ({
      question: message.kind === "initial" ? "" : (message.question ?? ""),
      responseJson: message.raw,
    }));

const generateMessageId = (kind: "follow-up" | "initial"): string =>
  `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function* streamWalkthroughMessageSaga(
  pullRequest: PullRequestData,
  request: WalkthroughAgentRequest,
  messageId: string,
): Generator {
  let channel: EventChannel<WalkthroughAgentEvent> | null = null;
  let accumulated = "";
  let lastParsed: null | WalkthroughResponse = null;

  try {
    channel = (yield call(
      createWalkthroughAgentChannel,
      request,
    )) as EventChannel<WalkthroughAgentEvent>;

    while (true) {
      const event = (yield take(channel)) as WalkthroughAgentEvent;
      if (event.type === "chunk") {
        accumulated += event.content;
        lastParsed = parsePartialJson<WalkthroughResponse>(accumulated);
        yield put(
          walkthroughActions.appendMessageChunk({
            chunk: event.content,
            id: messageId,
            parsed: lastParsed,
          }),
        );
        continue;
      }
      if (event.type === "error") {
        yield put(walkthroughActions.messageFailed({ error: event.error, id: messageId }));
        return;
      }
      break;
    }

    const finalParsed = parsePartialJson<WalkthroughResponse>(accumulated);
    yield put(walkthroughActions.messageSucceeded({ id: messageId, parsed: finalParsed }));
    const messages = (yield select(selectWalkthroughMessages)) as WalkthroughMessage[];
    yield call(saveWalkthroughToDisk, pullRequest.metadata.reference, JSON.stringify(messages));
  } catch (error) {
    yield put(
      walkthroughActions.messageFailed({
        error: error instanceof Error ? error.message : "Walkthrough generation failed.",
        id: messageId,
      }),
    );
  } finally {
    channel?.close();
  }
}

export function* generateWalkthroughSaga(): Generator {
  const pullRequest = (yield select(selectPrData)) as null | PullRequestData;
  if (!pullRequest) {
    yield put(
      walkthroughActions.messageFailed({ error: "Fetch a pull request first.", id: "none" }),
    );
    return;
  }
  const messageId = generateMessageId("initial");
  yield put(walkthroughActions.generateWalkthroughStarted({ id: messageId }));
  const request = buildWalkthroughAgentRequest(pullRequest);
  yield call(streamWalkthroughMessageSaga, pullRequest, request, messageId);
}

export function* askFollowUpSaga(
  action: ReturnType<typeof walkthroughActions.askFollowUp>,
): Generator {
  const pullRequest = (yield select(selectPrData)) as null | PullRequestData;
  if (!pullRequest) {
    yield put(
      walkthroughActions.messageFailed({
        error: "Fetch a pull request first.",
        id: action.payload.id,
      }),
    );
    return;
  }
  const messages = (yield select(selectWalkthroughMessages)) as WalkthroughMessage[];
  const priorMessages = messages.filter((message) => message.id !== action.payload.id);
  const history = buildHistory(priorMessages);
  const request = buildWalkthroughAgentRequest(pullRequest, {
    followUpQuestion: action.payload.question,
    history,
  });
  yield call(streamWalkthroughMessageSaga, pullRequest, request, action.payload.id);
}

export function* loadCachedWalkthroughSaga(): Generator {
  const pullRequest = (yield select(selectPrData)) as null | PullRequestData;
  if (!pullRequest) {
    yield put(walkthroughActions.loadCachedWalkthroughNotFound());
    return;
  }
  const content = (yield call(loadWalkthroughFromDisk, pullRequest.metadata.reference)) as
    | null
    | string;
  if (content === null) {
    yield put(walkthroughActions.loadCachedWalkthroughNotFound());
    yield put(walkthroughActions.generateWalkthrough());
    return;
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Empty cache");
    }
    const messages = parsed as WalkthroughMessage[];
    if (!messages.every((message) => message.parsed !== null)) {
      throw new Error("Cached walkthrough has incomplete messages");
    }
    yield put(walkthroughActions.loadCachedWalkthroughSucceeded({ messages }));
  } catch {
    yield put(walkthroughActions.loadCachedWalkthroughNotFound());
    yield put(walkthroughActions.generateWalkthrough());
  }
}

export function* walkthroughSaga(): Generator {
  yield all([
    takeLatest(walkthroughActions.generateWalkthrough.type, generateWalkthroughSaga),
    takeLatest(walkthroughActions.loadCachedWalkthrough.type, loadCachedWalkthroughSaga),
    takeEvery(walkthroughActions.askFollowUp.type, askFollowUpSaga),
  ]);
}
