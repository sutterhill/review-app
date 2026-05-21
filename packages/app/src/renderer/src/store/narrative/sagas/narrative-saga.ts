import { eventChannel, type EventChannel } from "redux-saga";
import { all, call, put, select, take, takeLatest } from "redux-saga/effects";

import {
  buildNarrativeAgentRequest,
  startNarrativeAgentSession,
  type NarrativeAgentEvent,
  type NarrativeAgentRequest,
} from "../../../services/narrative-agent";
import { selectPrData } from "../../pr/pr-selectors";
import type { PullRequestData } from "../../pr/pr-types";
import { selectNarrativeContent } from "../narrative-selectors";
import { narrativeActions } from "../narrative-slice";

export function createNarrativeAgentChannel(
  request: NarrativeAgentRequest,
): EventChannel<NarrativeAgentEvent> {
  return eventChannel((emit) => {
    const controller = startNarrativeAgentSession(request, emit);
    return () => controller.abort();
  });
}

export const saveNarrativeToDisk = async (prReference: string, content: string): Promise<void> => {
  if (typeof window === "undefined" || !window.reviewAppNarrative) {
    throw new Error("Narrative persistence API is unavailable.");
  }

  await window.reviewAppNarrative.save(prReference, content);
};

export const loadNarrativeFromDisk = async (prReference: string): Promise<string | null> => {
  if (typeof window === "undefined" || !window.reviewAppNarrative) {
    throw new Error("Narrative persistence API is unavailable.");
  }

  return window.reviewAppNarrative.load(prReference);
};

export function* generateNarrativeSaga(): Generator {
  const pullRequest = (yield select(selectPrData)) as PullRequestData | null;

  if (!pullRequest) {
    yield put(narrativeActions.generateNarrativeFailed("Fetch a pull request first."));
    return;
  }

  const request = buildNarrativeAgentRequest(pullRequest);
  let channel: EventChannel<NarrativeAgentEvent> | null = null;

  try {
    channel = (yield call(
      createNarrativeAgentChannel,
      request,
    )) as EventChannel<NarrativeAgentEvent>;
    let isComplete = false;

    while (!isComplete) {
      const event = (yield take(channel)) as NarrativeAgentEvent;

      if (event.type === "chunk") {
        yield put(narrativeActions.appendNarrativeChunk(event.content));
      } else if (event.type === "error") {
        yield put(narrativeActions.generateNarrativeFailed(event.error));
        return;
      } else {
        isComplete = true;
      }
    }

    yield put(narrativeActions.generateNarrativeSucceeded());
    const content = (yield select(selectNarrativeContent)) as string;
    yield call(saveNarrativeToDisk, pullRequest.metadata.reference, content);
  } catch (error) {
    yield put(
      narrativeActions.generateNarrativeFailed(
        error instanceof Error ? error.message : "Narrative generation failed.",
      ),
    );
  } finally {
    channel?.close();
  }
}

export function* loadCachedNarrativeSaga(): Generator {
  const pullRequest = (yield select(selectPrData)) as PullRequestData | null;

  if (!pullRequest) {
    yield put(narrativeActions.loadCachedNarrativeNotFound());
    return;
  }

  const content = (yield call(loadNarrativeFromDisk, pullRequest.metadata.reference)) as
    | string
    | null;
  if (content === null) {
    yield put(narrativeActions.loadCachedNarrativeNotFound());
    yield put(narrativeActions.generateNarrative());
    return;
  }

  yield put(narrativeActions.loadCachedNarrativeSucceeded(content));
}

export function* narrativeSaga(): Generator {
  yield all([
    takeLatest(narrativeActions.generateNarrative.type, generateNarrativeSaga),
    takeLatest(narrativeActions.loadCachedNarrative.type, loadCachedNarrativeSaga),
  ]);
}
