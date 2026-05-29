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
vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
}));
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/ui/separator", () => ({ Separator: () => <hr /> }));
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <div /> }));
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  AvatarGroup: ({
    "aria-label": ariaLabel,
    children,
  }: {
    "aria-label"?: string;
    children?: ReactNode;
  }) => <span aria-label={ariaLabel}>{children}</span>,
  AvatarImage: () => null,
}));

import { asideActions, asideReducer } from "../../store/aside/aside-slice";
import { prActions, prReducer } from "../../store/pr/pr-slice";
import type { PullRequestSummary } from "../../store/pr/pr-types";
import { reposReducer } from "../../store/repos/repos-slice";
import { KanbanBoard } from "./KanbanBoard";

const makePullRequest = (
  reference: string,
  number: number,
  title: string,
  repositoryName = "o/r",
): PullRequestSummary => ({
  author: { avatarUrl: null, login: "octocat", url: "https://github.com/octocat" },
  headRefName: `feature/${number}`,
  htmlUrl: `https://github.com/${repositoryName}/pull/${number}`,
  isDraft: false,
  number,
  owner: repositoryName.split("/")[0] ?? "o",
  reference,
  repo: repositoryName.split("/")[1] ?? "r",
  repositoryName,
  reviewDecision: null,
  title,
  updatedAt: "2026-05-01T00:00:00.000Z",
});

const createStore = () =>
  configureStore({ reducer: { aside: asideReducer, pr: prReducer, repos: reposReducer } });

const needsReviewPr = makePullRequest("o/r#1", 1, "Open review PR");
const asidePr = makePullRequest("o/r#2", 2, "Set aside PR");
const myPr = makePullRequest("o/r#3", 3, "My open PR");
const approvedPr = makePullRequest("o/r#4", 4, "Approved PR");
const waitingPr = makePullRequest("o/r#5", 5, "Author follow-up PR");

const renderBoard = (): string => {
  const store = configureStore({
    reducer: { aside: asideReducer, pr: prReducer, repos: reposReducer },
  });

  store.dispatch(prActions.fetchOpenPullRequestsSucceeded([needsReviewPr, asidePr]));
  store.dispatch(prActions.fetchMyPullRequestsSucceeded([myPr, approvedPr]));
  store.dispatch(
    prActions.fetchWaitingPullRequestsSucceeded({
      readyToMerge: [approvedPr],
      waitingOnAuthor: [waitingPr],
    }),
  );
  store.dispatch(asideActions.hydrateAside([asidePr.reference]));

  return renderToStaticMarkup(
    <Provider store={store}>
      <MemoryRouter>
        <KanbanBoard />
      </MemoryRouter>
    </Provider>,
  );
};

describe("KanbanBoard", () => {
  it("renders the four columns", () => {
    const html = renderBoard();

    expect(html).toContain('aria-label="My PRs column"');
    expect(html).toContain('aria-label="Needs review column"');
    expect(html).toContain('aria-label="Aside column"');
    expect(html).toContain('aria-label="Waiting column"');
  });

  it("splits the Waiting column into both sections", () => {
    const html = renderBoard();
    const waitingStart = html.indexOf('aria-label="Waiting column"');

    expect(html.indexOf("Ready to merge", waitingStart)).toBeGreaterThan(waitingStart);
    expect(html.indexOf("Waiting on author", waitingStart)).toBeGreaterThan(waitingStart);
    expect(html.indexOf("Approved PR", waitingStart)).toBeGreaterThan(waitingStart);
    expect(html.indexOf("Author follow-up PR", waitingStart)).toBeGreaterThan(waitingStart);
  });

  it("places an aside PR in the Aside column rather than its origin column", () => {
    const html = renderBoard();
    const needsReviewStart = html.indexOf('aria-label="Needs review column"');
    const waitingStart = html.indexOf('aria-label="Waiting column"');
    const asideStart = html.indexOf('aria-label="Aside column"');
    const asideTitleIndex = html.indexOf("Set aside PR");

    expect(asideStart).toBeGreaterThan(waitingStart);
    expect(asideTitleIndex).toBeGreaterThan(asideStart);

    const needsReviewSection = html.slice(needsReviewStart, waitingStart);

    expect(needsReviewSection).not.toContain("Set aside PR");
    expect(needsReviewSection).toContain("Open review PR");
  });

  it("dedupes approved PRs out of My PRs", () => {
    const html = renderBoard();
    const myStart = html.indexOf('aria-label="My PRs column"');
    const needsReviewStart = html.indexOf('aria-label="Needs review column"');
    const myColumn = html.slice(myStart, needsReviewStart);

    expect(myColumn).toContain("My open PR");
    expect(myColumn).not.toContain("Approved PR");
  });

  it("groups pull requests into per-repository sections, sorted by name", () => {
    const store = createStore();

    store.dispatch(
      prActions.fetchOpenPullRequestsSucceeded([
        makePullRequest("zeta/svc#1", 1, "Zeta PR", "zeta/svc"),
        makePullRequest("acme/web#2", 2, "Acme PR", "acme/web"),
      ]),
    );

    const html = renderToStaticMarkup(
      <Provider store={store}>
        <MemoryRouter>
          <KanbanBoard />
        </MemoryRouter>
      </Provider>,
    );

    const acmeIndex = html.indexOf('aria-label="acme/web"');
    const zetaIndex = html.indexOf('aria-label="zeta/svc"');

    expect(acmeIndex).toBeGreaterThan(-1);
    expect(zetaIndex).toBeGreaterThan(-1);
    expect(acmeIndex).toBeLessThan(zetaIndex);
  });

  it("renders skeleton placeholders while loading with no pull requests yet", () => {
    const store = createStore();

    store.dispatch(prActions.fetchOpenPullRequests());
    store.dispatch(prActions.fetchMyPullRequests());
    store.dispatch(prActions.fetchWaitingPullRequests());

    const html = renderToStaticMarkup(
      <Provider store={store}>
        <MemoryRouter>
          <KanbanBoard />
        </MemoryRouter>
      </Provider>,
    );

    expect(html).toContain('aria-label="Loading pull requests"');
    expect(html).not.toContain("You have no open pull requests.");
    expect(html).not.toContain("No pull requests");
    expect(html).not.toContain("Nothing set aside");
  });

  it("does not render any floating empty-state text when there are no pull requests", () => {
    const store = createStore();

    const html = renderToStaticMarkup(
      <Provider store={store}>
        <MemoryRouter>
          <KanbanBoard />
        </MemoryRouter>
      </Provider>,
    );

    expect(html).not.toContain("You have no open pull requests.");
    expect(html).not.toContain("No pull requests are requesting your review.");
    expect(html).not.toContain("Nothing set aside.");
    expect(html).not.toContain("No pull requests ready to merge.");
    expect(html).not.toContain("No pull requests waiting on the author.");
  });

  it("renders the repo name as a link to the GitHub pulls page", () => {
    const html = renderBoard();

    expect(html).toContain('href="https://github.com/o/r/pulls"');
  });

  it("does not draw a divider between repository sections", () => {
    const store = createStore();

    store.dispatch(
      prActions.fetchOpenPullRequestsSucceeded([
        makePullRequest("acme/web#1", 1, "Acme PR", "acme/web"),
        makePullRequest("zeta/svc#2", 2, "Zeta PR", "zeta/svc"),
      ]),
    );

    const html = renderToStaticMarkup(
      <Provider store={store}>
        <MemoryRouter>
          <KanbanBoard />
        </MemoryRouter>
      </Provider>,
    );

    const acmeStart = html.indexOf('aria-label="acme/web"');
    const zetaStart = html.indexOf('aria-label="zeta/svc"');
    const between = html.slice(acmeStart, zetaStart);

    expect(between).not.toContain("border-t");
  });

  it("renders an aria-labelled contributor avatar group in each repository sidebar", () => {
    const html = renderBoard();

    expect(html).toContain('aria-label="o/r contributors"');
  });
});
