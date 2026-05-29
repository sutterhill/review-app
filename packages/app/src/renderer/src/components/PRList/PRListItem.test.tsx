import { configureStore } from "@reduxjs/toolkit";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils", () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));
vi.mock("@/lib/view-transition", () => ({
  runWithViewTransition: (callback: () => void) => callback(),
  sanitizeViewTransitionName: (value: string) => `pr-${value}`,
}));
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  AvatarImage: () => null,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("../RelativeTime", () => ({
  RelativeTime: ({ className, date }: { className?: string; date: string }) => (
    <time className={className} dateTime={date}>
      relative-time
    </time>
  ),
}));

import { asideActions, asideReducer } from "../../store/aside/aside-slice";
import type { PullRequestSummary } from "../../store/pr/pr-types";
import type { AppDispatch } from "../../store/store";
import {
  dispatchAsideToggle,
  getPullRequestState,
  PRListItem,
  resolveAsideAction,
} from "./PRListItem";

const pullRequest: PullRequestSummary = {
  author: { avatarUrl: null, login: "octocat", url: "https://github.com/octocat" },
  headRefName: "feature/1",
  htmlUrl: "https://github.com/o/r/pull/1",
  isDraft: false,
  number: 1,
  owner: "o",
  reference: "o/r#1",
  repo: "r",
  repositoryName: "o/r",
  reviewDecision: null,
  title: "Example PR",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const renderItem = (
  asideAction?: "set" | "remove",
  overrides?: Partial<PullRequestSummary>,
): string => {
  const store = configureStore({ reducer: { aside: asideReducer } });

  return renderToStaticMarkup(
    <Provider store={store}>
      <MemoryRouter>
        <PRListItem asideAction={asideAction} pullRequest={{ ...pullRequest, ...overrides }} />
      </MemoryRouter>
    </Provider>,
  );
};

describe("resolveAsideAction", () => {
  it("returns setAside for the 'set' action", () => {
    expect(resolveAsideAction("set", "o/r#1")).toEqual(asideActions.setAside("o/r#1"));
  });

  it("returns removeAside for the 'remove' action", () => {
    expect(resolveAsideAction("remove", "o/r#1")).toEqual(asideActions.removeAside("o/r#1"));
  });
});

describe("dispatchAsideToggle", () => {
  it("dispatches setAside when clicking Set aside", () => {
    const dispatch = vi.fn() as unknown as AppDispatch;

    dispatchAsideToggle(dispatch, "set", "o/r#1");

    expect(dispatch).toHaveBeenCalledWith(asideActions.setAside("o/r#1"));
  });

  it("dispatches removeAside when clicking Restore", () => {
    const dispatch = vi.fn() as unknown as AppDispatch;

    dispatchAsideToggle(dispatch, "remove", "o/r#1");

    expect(dispatch).toHaveBeenCalledWith(asideActions.removeAside("o/r#1"));
  });
});

describe("PRListItem", () => {
  it("renders the number on the top row and the relative time as a time element", () => {
    const html = renderItem();

    expect(html).toContain("#1");
    expect(html).toContain(`dateTime="${pullRequest.updatedAt}"`);
    expect(html).toContain(">relative-time</time>");
  });

  it("renders the title without repository, worktree, or 'updated' prose", () => {
    const html = renderItem();

    expect(html).toContain("Example PR");
    expect(html).not.toContain("o/r</p>");
    expect(html).not.toContain("updated");
    expect(html).not.toContain("worktree:");
  });

  it("renders a Set aside button and a draggable card in source columns", () => {
    const html = renderItem("set");

    expect(html).toContain("Set aside");
    expect(html).toContain('draggable="true"');
  });

  it("renders a Restore button for aside cards", () => {
    const html = renderItem("remove");

    expect(html).toContain("Restore");
  });

  it("renders no aside button and is not draggable without an action", () => {
    const html = renderItem();

    expect(html).not.toContain("Set aside");
    expect(html).not.toContain("Restore");
    expect(html).not.toContain('draggable="true"');
  });

  it("renders the state label instead of the author handle", () => {
    const html = renderItem();

    expect(html).not.toContain("@octocat<");
    expect(html).toContain("Open");
  });

  it("does not render the branch name on the card", () => {
    const html = renderItem();

    expect(html).not.toContain("feature/1");
    expect(html).not.toContain("Copy branch name");
    expect(html).not.toContain("font-mono");
  });

  it("colors only the status icon, not the status text", () => {
    const html = renderItem(undefined, { reviewDecision: "changes_requested" });
    const iconStart = html.indexOf("<svg");
    const iconEnd = html.indexOf("</svg>", iconStart);
    const iconMarkup = html.slice(iconStart, iconEnd);
    const beforeIcon = html.slice(0, iconStart);
    const afterIcon = html.slice(iconEnd);

    expect(iconMarkup).toContain("text-destructive");
    expect(beforeIcon).not.toContain("text-destructive");
    expect(afterIcon.split("Changes requested")[0]).not.toContain("text-destructive");
  });

  it("renders the Draft state label with muted icon color when isDraft is true", () => {
    const html = renderItem(undefined, { isDraft: true });

    expect(html).toContain("Draft");
    expect(html).toContain("text-muted-foreground");
  });

  it("renders the Changes requested state label with destructive icon color", () => {
    const html = renderItem(undefined, { reviewDecision: "changes_requested" });

    expect(html).toContain("Changes requested");
    expect(html).toContain("text-destructive");
  });

  it("renders the Approved state label with emerald icon color when reviewDecision is approved", () => {
    const html = renderItem(undefined, { reviewDecision: "approved" });

    expect(html).toContain("Approved");
    expect(html).toContain("text-emerald-600");
  });

  it("renders the Review required state label when reviewDecision is review_required", () => {
    const html = renderItem(undefined, { reviewDecision: "review_required" });

    expect(html).toContain("Review required");
    expect(html).toContain("text-amber-600");
  });

  it("renders an inline pull request svg icon", () => {
    const html = renderItem();

    expect(html).toContain("<svg");
    expect(html).toContain('viewBox="0 0 16 16"');
  });
});

describe("getPullRequestState", () => {
  const makePr = (overrides: Partial<PullRequestSummary> = {}): PullRequestSummary => ({
    ...pullRequest,
    ...overrides,
  });

  it("returns Draft when the pull request is a draft, regardless of review decision", () => {
    expect(getPullRequestState(makePr({ isDraft: true, reviewDecision: null }))).toMatchObject({
      id: "draft",
      label: "Draft",
    });
    expect(
      getPullRequestState(makePr({ isDraft: true, reviewDecision: "changes_requested" })),
    ).toMatchObject({ id: "draft", label: "Draft" });
  });

  it("returns Changes requested when the review decision requested changes", () => {
    expect(getPullRequestState(makePr({ reviewDecision: "changes_requested" }))).toMatchObject({
      id: "changes_requested",
      label: "Changes requested",
    });
  });

  it("returns Approved when the review decision is approved", () => {
    expect(getPullRequestState(makePr({ reviewDecision: "approved" }))).toMatchObject({
      id: "approved",
      label: "Approved",
    });
  });

  it("returns Review required when the review decision is review_required", () => {
    expect(getPullRequestState(makePr({ reviewDecision: "review_required" }))).toMatchObject({
      id: "review_required",
      label: "Review required",
    });
  });

  it("returns Open when the review decision is null", () => {
    expect(getPullRequestState(makePr({ reviewDecision: null }))).toMatchObject({
      id: "open",
      label: "Open",
    });
  });
});
