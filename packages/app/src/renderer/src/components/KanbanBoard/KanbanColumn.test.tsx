import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PullRequestSummary } from "../../store/pr/pr-types";

vi.mock("@/lib/utils", () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));
vi.mock("@/lib/view-transition", () => ({
  runWithViewTransition: (callback: () => void) => callback(),
  sanitizeViewTransitionName: (value: string) => `pr-${value}`,
}));
vi.mock("../PRList/PRListItem", () => ({
  ASIDE_DRAG_TYPE: "application/x-review-app-aside-pr",
  PRListItem: ({ pullRequest }: { pullRequest: PullRequestSummary }) => (
    <div data-reference={pullRequest.reference}>{pullRequest.title}</div>
  ),
}));
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  AvatarImage: () => null,
}));
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("@/components/ui/separator", () => ({ Separator: () => <hr /> }));
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <div /> }));

import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";

import { asideActions, asideReducer } from "../../store/aside/aside-slice";
import { prReducer } from "../../store/pr/pr-slice";
import { reposReducer } from "../../store/repos/repos-slice";
import type { AppDispatch } from "../../store/store";
import { ASIDE_DRAG_TYPE } from "../PRList/PRListItem";
import {
  assignActionBucket,
  ColumnSlot,
  createColumnDropHandler,
  groupByActionNeeded,
  resolveDropAction,
  WaitingColumnSlot,
} from "./KanbanColumn";

const renderWithStore = (node: React.ReactNode): string => {
  const store = configureStore({
    reducer: { aside: asideReducer, pr: prReducer, repos: reposReducer },
  });

  return renderToStaticMarkup(<Provider store={store}>{node}</Provider>);
};

const makePullRequest = (
  reference: string,
  repositoryName: string,
  overrides: Partial<PullRequestSummary> = {},
): PullRequestSummary => ({
  author: { avatarUrl: null, login: "octocat", url: "https://github.com/octocat" },
  headRefName: "feature",
  htmlUrl: "https://github.com/example/pull/1",
  isDraft: false,
  number: 1,
  owner: repositoryName.split("/")[0] ?? "o",
  reference,
  repo: repositoryName.split("/")[1] ?? "r",
  repositoryName,
  reviewDecision: null,
  title: `Title ${reference}`,
  updatedAt: "2026-05-01T00:00:00.000Z",
  ...overrides,
});

const makeDropEvent = (reference: string) => {
  const preventDefault = vi.fn();

  return {
    dataTransfer: { getData: (type: string) => (type === ASIDE_DRAG_TYPE ? reference : "") },
    preventDefault,
  };
};

describe("assignActionBucket", () => {
  it("assigns changes requested when the review decision requested changes", () => {
    expect(
      assignActionBucket(makePullRequest("o/r#1", "o/r", { reviewDecision: "changes_requested" })),
    ).toBe("changes_requested");
  });

  it("prioritizes changes requested over draft", () => {
    expect(
      assignActionBucket(
        makePullRequest("o/r#1", "o/r", { isDraft: true, reviewDecision: "changes_requested" }),
      ),
    ).toBe("changes_requested");
  });

  it("assigns draft when the pull request is a draft and changes were not requested", () => {
    expect(
      assignActionBucket(
        makePullRequest("o/r#1", "o/r", { isDraft: true, reviewDecision: "review_required" }),
      ),
    ).toBe("draft");
    expect(
      assignActionBucket(makePullRequest("o/r#2", "o/r", { isDraft: true, reviewDecision: null })),
    ).toBe("draft");
  });

  it("assigns no reviewers when no review is required and it is not a draft", () => {
    expect(
      assignActionBucket(makePullRequest("o/r#1", "o/r", { isDraft: false, reviewDecision: null })),
    ).toBe("no_reviewers");
  });

  it("assigns awaiting review when review is required and it is not a draft", () => {
    expect(
      assignActionBucket(
        makePullRequest("o/r#1", "o/r", { isDraft: false, reviewDecision: "review_required" }),
      ),
    ).toBe("awaiting_review");
  });
});

describe("groupByActionNeeded", () => {
  it("orders non-empty sub-groups: changes requested, no reviewers, awaiting review, draft", () => {
    const groups = groupByActionNeeded([
      makePullRequest("o/r#1", "o/r", { isDraft: true }),
      makePullRequest("o/r#2", "o/r", { reviewDecision: "review_required" }),
      makePullRequest("o/r#3", "o/r", { reviewDecision: null }),
      makePullRequest("o/r#4", "o/r", { reviewDecision: "changes_requested" }),
    ]);

    expect(groups.map((group) => group.label)).toEqual([
      "Changes requested",
      "No reviewers",
      "Awaiting review",
      "Draft",
    ]);
  });

  it("omits empty buckets and groups multiple pull requests per bucket", () => {
    const groups = groupByActionNeeded([
      makePullRequest("o/r#1", "o/r", { reviewDecision: null }),
      makePullRequest("o/r#2", "o/r", { reviewDecision: null }),
      makePullRequest("o/r#3", "o/r", { reviewDecision: "review_required" }),
    ]);

    expect(groups.map((group) => group.id)).toEqual(["no_reviewers", "awaiting_review"]);
    expect(groups[0]?.pullRequests).toHaveLength(2);
    expect(groups[1]?.pullRequests).toHaveLength(1);
  });

  it("returns no sub-groups when there are no pull requests", () => {
    expect(groupByActionNeeded([])).toEqual([]);
  });
});

describe("ColumnSlot", () => {
  it("renders the pull request cards for the column", () => {
    const html = renderWithStore(
      <ColumnSlot
        pullRequests={[makePullRequest("o/r#1", "o/r"), makePullRequest("o/r#2", "o/r")]}
        title="My PRs"
      />,
    );

    expect(html).toContain('aria-label="My PRs column"');
    expect(html).toContain("Title o/r#1");
    expect(html).toContain("Title o/r#2");
  });

  it("renders nothing visible when the column has no pull requests", () => {
    const html = renderWithStore(<ColumnSlot pullRequests={[]} title="Aside" />);

    expect(html).toContain('aria-label="Aside column"');
    expect(html).not.toContain("Title");
    expect(html).not.toContain("No pull requests");
    expect(html).not.toContain("Nothing set aside");
  });

  it("renders action-needed sub-group labels in order when subGroupByAction is set", () => {
    const html = renderWithStore(
      <ColumnSlot
        pullRequests={[
          makePullRequest("o/r#1", "o/r", { isDraft: true }),
          makePullRequest("o/r#2", "o/r", { reviewDecision: "changes_requested" }),
          makePullRequest("o/r#3", "o/r", { reviewDecision: null }),
        ]}
        subGroupByAction
        title="My PRs"
      />,
    );

    expect(html.indexOf("Changes requested")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("No reviewers")).toBeGreaterThan(html.indexOf("Changes requested"));
    expect(html.indexOf("Draft")).toBeGreaterThan(html.indexOf("No reviewers"));
    expect(html).not.toContain("Awaiting review");
  });

  it("renders a flat list without sub-group labels by default", () => {
    const html = renderWithStore(
      <ColumnSlot
        pullRequests={[makePullRequest("o/r#1", "o/r", { reviewDecision: null })]}
        title="Needs review"
      />,
    );

    expect(html).not.toContain("No reviewers");
  });
});

describe("WaitingColumnSlot", () => {
  it("renders both sub-group labels with their cards when both buckets have pull requests", () => {
    const html = renderWithStore(
      <WaitingColumnSlot
        readyToMerge={[makePullRequest("o/r#1", "o/r")]}
        waitingOnAuthor={[makePullRequest("o/r#2", "o/r")]}
      />,
    );

    expect(html.indexOf("Ready to merge")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("Waiting on author")).toBeGreaterThan(html.indexOf("Ready to merge"));
    expect(html).toContain("Title o/r#1");
    expect(html).toContain("Title o/r#2");
  });

  it("hides a sub-group label when its bucket is empty", () => {
    const html = renderWithStore(
      <WaitingColumnSlot readyToMerge={[]} waitingOnAuthor={[makePullRequest("o/r#1", "o/r")]} />,
    );

    expect(html).not.toContain("Ready to merge");
    expect(html).toContain("Waiting on author");
  });

  it("renders the column wrapper without any floating empty-state text when both buckets are empty", () => {
    const html = renderWithStore(<WaitingColumnSlot readyToMerge={[]} waitingOnAuthor={[]} />);

    expect(html).toContain('aria-label="Waiting column"');
    expect(html).not.toContain("Ready to merge");
    expect(html).not.toContain("Waiting on author");
    expect(html).not.toContain("No pull requests");
  });
});

describe("resolveDropAction", () => {
  it("maps 'setAside' drop behavior to the setAside action", () => {
    expect(resolveDropAction("setAside", "o/r#1")).toEqual(asideActions.setAside("o/r#1"));
  });

  it("maps 'removeAside' drop behavior to the removeAside action", () => {
    expect(resolveDropAction("removeAside", "o/r#1")).toEqual(asideActions.removeAside("o/r#1"));
  });
});

describe("createColumnDropHandler", () => {
  it("dispatches setAside when a card is dropped on the Aside column", () => {
    const dispatch = vi.fn() as unknown as AppDispatch;
    const event = makeDropEvent("o/r#1");

    createColumnDropHandler(dispatch, "setAside")(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(asideActions.setAside("o/r#1"));
  });

  it("dispatches removeAside when an aside card is dropped on a source column", () => {
    const dispatch = vi.fn() as unknown as AppDispatch;
    const event = makeDropEvent("o/r#2");

    createColumnDropHandler(dispatch, "removeAside")(event);

    expect(dispatch).toHaveBeenCalledWith(asideActions.removeAside("o/r#2"));
  });

  it("is a no-op for columns without a drop behavior", () => {
    const dispatch = vi.fn() as unknown as AppDispatch;
    const event = makeDropEvent("o/r#3");

    createColumnDropHandler(dispatch, undefined)(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not dispatch when no reference is present in the drop payload", () => {
    const dispatch = vi.fn() as unknown as AppDispatch;
    const event = makeDropEvent("");

    createColumnDropHandler(dispatch, "setAside")(event);

    expect(dispatch).not.toHaveBeenCalled();
  });
});
