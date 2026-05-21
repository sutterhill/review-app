import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
  WalkthroughMessage,
  WalkthroughResponse,
  WalkthroughState,
} from "./walkthrough-types";

const initialState: WalkthroughState = {
  error: null,
  messages: [],
  status: "idle",
};

const findMessage = (state: WalkthroughState, id: string): undefined | WalkthroughMessage =>
  state.messages.find((message) => message.id === id);

export const walkthroughSlice = createSlice({
  initialState,
  name: "walkthrough",
  reducers: {
    appendMessageChunk(
      state,
      action: PayloadAction<{
        id: string;
        chunk: string;
        parsed: null | WalkthroughResponse;
      }>,
    ) {
      const message = findMessage(state, action.payload.id);
      if (!message) return;
      message.raw += action.payload.chunk;
      message.parsed = action.payload.parsed;
      message.status = "streaming";
      state.error = null;
      state.status = "streaming";
    },
    askFollowUp(state, action: PayloadAction<{ id: string; question: string }>) {
      state.messages.push({
        id: action.payload.id,
        kind: "follow-up",
        parsed: null,
        question: action.payload.question,
        raw: "",
        status: "loading",
      });
      state.error = null;
      state.status = "loading";
    },
    generateWalkthrough(state) {
      state.messages = [];
      state.error = null;
      state.status = "loading";
    },
    generateWalkthroughStarted(state, action: PayloadAction<{ id: string }>) {
      state.messages.push({
        id: action.payload.id,
        kind: "initial",
        parsed: null,
        raw: "",
        status: "loading",
      });
    },
    messageFailed(state, action: PayloadAction<{ id: string; error: string }>) {
      const message = findMessage(state, action.payload.id);
      if (message) {
        message.status = "failed";
      }
      state.error = action.payload.error;
      state.status = "failed";
    },
    messageSucceeded(
      state,
      action: PayloadAction<{ id: string; parsed: null | WalkthroughResponse }>,
    ) {
      const message = findMessage(state, action.payload.id);
      if (message) {
        message.status = "succeeded";
        if (action.payload.parsed) {
          message.parsed = action.payload.parsed;
        }
      }
      state.status = "succeeded";
      state.error = null;
    },
    loadCachedWalkthrough(state) {
      state.error = null;
      state.status = "loading";
    },
    loadCachedWalkthroughNotFound(state) {
      state.error = null;
      state.status = "idle";
    },
    loadCachedWalkthroughSucceeded(
      state,
      action: PayloadAction<{ messages: WalkthroughMessage[] }>,
    ) {
      state.messages = action.payload.messages;
      state.error = null;
      state.status = "succeeded";
    },
    resetWalkthrough(state) {
      state.messages = [];
      state.error = null;
      state.status = "idle";
    },
  },
});

export const walkthroughActions = walkthroughSlice.actions;
export const walkthroughReducer = walkthroughSlice.reducer;
export const GENERATE_WALKTHROUGH = walkthroughActions.generateWalkthrough.type;
export const ASK_FOLLOW_UP = walkthroughActions.askFollowUp.type;
