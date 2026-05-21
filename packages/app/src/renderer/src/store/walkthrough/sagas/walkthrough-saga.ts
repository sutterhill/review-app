import { eventChannel, type EventChannel } from "redux-saga";
import { all, call, put, select, take, takeLatest } from "redux-saga/effects";

import {
  buildWalkthroughAgentRequest,
  startWalkthroughAgentSession,
  type WalkthroughAgentEvent,
  type WalkthroughAgentRequest,
} from "../../../services/walkthrough-agent";
import { selectPrData } from "../../pr/pr-selectors";
import type { PullRequestData } from "../../pr/pr-types";
import { selectWalkthroughContent } from "../walkthrough-selectors";
import { walkthroughActions } from "../walkthrough-slice";

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

export const loadWalkthroughFromDisk = async (prReference: string): Promise<string | null> => {
  if (typeof window === "undefined" || !window.reviewAppWalkthrough) {
    throw new Error("Walkthrough persistence API is unavailable.");
  }

  return window.reviewAppWalkthrough.load(prReference);
};

export function* generateWalkthroughSaga(): Generator {
  const pullRequest = (yield select(selectPrData)) as PullRequestData | null;

  if (!pullRequest) {
    yield put(walkthroughActions.generateWalkthroughFailed("Fetch a pull request first."));
    return;
  }

  const request = buildWalkthroughAgentRequest(pullRequest);
  let channel: EventChannel<WalkthroughAgentEvent> | null = null;

  try {
    channel = (yield call(
      createWalkthroughAgentChannel,
      request,
    )) as EventChannel<WalkthroughAgentEvent>;
    let isComplete = false;

    while (!isComplete) {
      const event = (yield take(channel)) as WalkthroughAgentEvent;

      if (event.type === "chunk") {
        yield put(walkthroughActions.appendWalkthroughChunk(event.content));
      } else if (event.type === "error") {
        yield put(walkthroughActions.generateWalkthroughFailed(event.error));
        return;
      } else {
        isComplete = true;
      }
    }

    yield put(walkthroughActions.generateWalkthroughSucceeded());
    const content = (yield select(selectWalkthroughContent)) as string;
    yield call(saveWalkthroughToDisk, pullRequest.metadata.reference, content);
  } catch (error) {
    yield put(
      walkthroughActions.generateWalkthroughFailed(
        error instanceof Error ? error.message : "Walkthrough generation failed.",
      ),
    );
  } finally {
    channel?.close();
  }
}

export function* loadCachedWalkthroughSaga(): Generator {
  const pullRequest = (yield select(selectPrData)) as PullRequestData | null;

  if (!pullRequest) {
    yield put(walkthroughActions.loadCachedWalkthroughNotFound());
    return;
  }

  const content = (yield call(loadWalkthroughFromDisk, pullRequest.metadata.reference)) as
    | string
    | null;
  if (content === null) {
    yield put(walkthroughActions.loadCachedWalkthroughNotFound());
    yield put(walkthroughActions.generateWalkthrough());
    return;
  }

  yield put(walkthroughActions.loadCachedWalkthroughSucceeded(content));
}

export function* walkthroughSaga(): Generator {
  yield all([
    takeLatest(walkthroughActions.generateWalkthrough.type, generateWalkthroughSaga),
    takeLatest(walkthroughActions.loadCachedWalkthrough.type, loadCachedWalkthroughSaga),
  ]);
}
