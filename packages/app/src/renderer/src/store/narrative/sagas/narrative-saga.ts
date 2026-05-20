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
import { narrativeActions } from "../narrative-slice";

export function createNarrativeAgentChannel(
  request: NarrativeAgentRequest,
): EventChannel<NarrativeAgentEvent> {
  return eventChannel((emit) => {
    const controller = startNarrativeAgentSession(request, emit);
    return () => controller.abort();
  });
}

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

export function* narrativeSaga(): Generator {
  yield all([takeLatest(narrativeActions.generateNarrative.type, generateNarrativeSaga)]);
}
