import { ArrowPathIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { selectAsideReferences } from "../../store/aside/aside-selectors";
import {
  selectMyPullRequests,
  selectMyPullRequestsError,
  selectMyPullRequestsStatus,
  selectOpenPullRequests,
  selectOpenPullRequestsError,
  selectOpenPullRequestsStatus,
  selectReadyToMergePullRequests,
  selectWaitingError,
  selectWaitingOnAuthorPullRequests,
  selectWaitingStatus,
} from "../../store/pr/pr-selectors";
import { prActions } from "../../store/pr/pr-slice";
import type { GitHubAccount, PrFetchError, PullRequestSummary } from "../../store/pr/pr-types";
import type { AppDispatch } from "../../store/store";
import { ColumnSlot, WaitingColumnSlot } from "./KanbanColumn";

interface ColumnDescriptor {
  title: string;
}

const COLUMNS: ColumnDescriptor[] = [
  { title: "My PRs" },
  { title: "Needs review" },
  { title: "Waiting" },
  { title: "Aside" },
];

const SECTION_GRID_WITH_ASIDE = "grid-cols-[12.5rem_repeat(4,minmax(0,1fr))]";
const SECTION_GRID_EMPTY_ASIDE = "grid-cols-[12.5rem_repeat(3,minmax(0,1fr))_6.25rem]";

interface RepoSection {
  aside: PullRequestSummary[];
  authors: GitHubAccount[];
  myPrs: PullRequestSummary[];
  needsReview: PullRequestSummary[];
  owner: string;
  readyToMerge: PullRequestSummary[];
  repo: string;
  repositoryName: string;
  waitingOnAuthor: PullRequestSummary[];
}

export const KanbanBoard = (): React.JSX.Element => {
  const dispatch = useDispatch<AppDispatch>();
  const openPullRequests = useSelector(selectOpenPullRequests);
  const openStatus = useSelector(selectOpenPullRequestsStatus);
  const openError = useSelector(selectOpenPullRequestsError);
  const myPullRequests = useSelector(selectMyPullRequests);
  const myStatus = useSelector(selectMyPullRequestsStatus);
  const myError = useSelector(selectMyPullRequestsError);
  const readyToMerge = useSelector(selectReadyToMergePullRequests);
  const waitingOnAuthor = useSelector(selectWaitingOnAuthorPullRequests);
  const waitingStatus = useSelector(selectWaitingStatus);
  const waitingError = useSelector(selectWaitingError);
  const asideReferences = useSelector(selectAsideReferences);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const openSearch = () => {
    setIsSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  useEffect(() => {
    dispatch(prActions.fetchOpenPullRequests());
    dispatch(prActions.fetchMyPullRequests());
    dispatch(prActions.fetchWaitingPullRequests());
  }, [dispatch]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setIsSearchOpen(true);
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });

        return;
      }

      if (event.key === "Escape" && isSearchOpen) {
        event.preventDefault();
        closeSearch();
      }
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [isSearchOpen]);

  const asideSet = new Set(asideReferences);
  const readyToMergeSet = new Set(readyToMerge.map((pullRequest) => pullRequest.reference));

  const needsReviewSource = dedupeByReference(openPullRequests);
  const myPullRequestsSource = dedupeByReference(
    myPullRequests.filter((pullRequest) => !readyToMergeSet.has(pullRequest.reference)),
  );

  const needsReviewColumn = needsReviewSource.filter(
    (pullRequest) => !asideSet.has(pullRequest.reference),
  );
  const myPullRequestsColumn = myPullRequestsSource.filter(
    (pullRequest) => !asideSet.has(pullRequest.reference),
  );
  const asideColumn = dedupeByReference(
    [...myPullRequestsSource, ...needsReviewSource].filter((pullRequest) =>
      asideSet.has(pullRequest.reference),
    ),
  );

  const needle = searchQuery.trim().toLowerCase();
  const sections = buildRepoSections({
    aside: filterByQuery(asideColumn, needle),
    myPrs: filterByQuery(myPullRequestsColumn, needle),
    needsReview: filterByQuery(needsReviewColumn, needle),
    readyToMerge: filterByQuery(dedupeByReference(readyToMerge), needle),
    waitingOnAuthor: filterByQuery(dedupeByReference(waitingOnAuthor), needle),
  });

  const hasAnyPullRequest = sections.length > 0;
  const isAnyLoading =
    openStatus === "loading" || myStatus === "loading" || waitingStatus === "loading";
  const showSkeletons = isAnyLoading && !hasAnyPullRequest;
  const errors = [myError, openError, waitingError].filter(
    (error): error is PrFetchError => error !== null && error !== undefined,
  );

  const handleRefresh = () => {
    dispatch(prActions.fetchOpenPullRequests());
    dispatch(prActions.fetchMyPullRequests());
    dispatch(prActions.fetchWaitingPullRequests());
  };

  const hasAnyAside = sections.some((section) => section.aside.length > 0);
  const sectionGrid = hasAnyAside ? SECTION_GRID_WITH_ASIDE : SECTION_GRID_EMPTY_ASIDE;

  return (
    <div className="mx-auto flex w-full max-w-[110rem] flex-col p-4">
      <div
        className={cn(
          "sticky top-0 z-20 grid items-center gap-x-6 border-b bg-background py-3",
          sectionGrid,
        )}
      >
        {isSearchOpen ? (
          <div className="col-span-full flex items-center gap-2">
            <MagnifyingGlassIcon aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              aria-label="Search pull requests"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeSearch();
                }
              }}
              placeholder="Search by title, author, repo, or PR number"
              ref={searchInputRef}
              type="search"
              value={searchQuery}
            />
            <Button
              aria-label="Close search"
              className="cursor-pointer"
              onClick={closeSearch}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <XMarkIcon aria-hidden className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-0.5">
              <h1 className="text-sm font-semibold text-foreground">Reviews</h1>
              <Button
                aria-label="Search pull requests"
                className="cursor-pointer"
                onClick={openSearch}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <MagnifyingGlassIcon aria-hidden className="h-3.5 w-3.5" />
              </Button>
              <Button
                aria-label={isAnyLoading ? "Refreshing" : "Refresh"}
                className="cursor-pointer"
                disabled={isAnyLoading}
                onClick={handleRefresh}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <ArrowPathIcon
                  aria-hidden
                  className={cn("h-3.5 w-3.5", isAnyLoading && "animate-spin")}
                />
              </Button>
            </div>
            {COLUMNS.map((column) => (
              <h2 className="text-sm text-foreground" key={column.title}>
                {column.title}
              </h2>
            ))}
          </>
        )}
      </div>

      {errors.length > 0 ? (
        <div className="flex flex-col gap-1 pt-3" role="alert">
          {errors.map((error) => (
            <p className="text-xs text-destructive" key={`${error.code}:${error.message}`}>
              {error.message}
            </p>
          ))}
        </div>
      ) : null}

      {showSkeletons ? (
        <KanbanSkeleton sectionGrid={sectionGrid} />
      ) : hasAnyPullRequest ? (
        <div className="flex flex-col gap-y-56 pt-10">
          {sections.map((section) => (
            <RepositorySection
              key={section.repositoryName}
              section={section}
              sectionGrid={sectionGrid}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const REPO_SECTION_MAX_HEIGHT = 800;

const RepositorySection = ({
  section,
  sectionGrid,
}: {
  section: RepoSection;
  sectionGrid: string;
}): React.JSX.Element => {
  const sectionRef = useRef<HTMLElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const element = sectionRef.current;

    if (!element) {
      return;
    }

    const measure = () => {
      setOverflows(element.scrollHeight > REPO_SECTION_MAX_HEIGHT);
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(element);

    return () => observer.disconnect();
  }, [section]);

  const showCap = overflows && !isExpanded;

  return (
    <section
      aria-label={section.repositoryName}
      className={cn(
        "relative grid scroll-mt-14 items-start gap-x-6",
        sectionGrid,
        overflows && "pb-12",
        showCap && "max-h-[800px] overflow-hidden",
      )}
      ref={sectionRef}
    >
      <div className="flex flex-col gap-2 self-start pr-2">
        <a
          className="-mt-0.5 truncate text-sm font-medium leading-4 text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={`https://github.com/${section.owner}/${section.repo}/pulls`}
          rel="noreferrer"
          target="_blank"
          title={section.repositoryName}
        >
          {section.repositoryName}
        </a>
        {section.authors.length > 0 ? (
          <AvatarGroup aria-label={`${section.repositoryName} contributors`}>
            {section.authors.slice(0, 5).map((author) => (
              <Avatar className="!size-6" key={author.login} size="sm">
                {author.avatarUrl ? (
                  <AvatarImage alt={`@${author.login}`} src={author.avatarUrl} />
                ) : null}
                <AvatarFallback>{getInitials(author.login)}</AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
        ) : null}
      </div>
      <ColumnSlot
        asideAction="set"
        dropBehavior="removeAside"
        pullRequests={section.myPrs}
        slotId="my-prs"
        subGroupByAction
        title="My PRs"
      />
      <ColumnSlot
        asideAction="set"
        dropBehavior="removeAside"
        pullRequests={section.needsReview}
        slotId="needs-review"
        title="Needs review"
      />
      <WaitingColumnSlot
        readyToMerge={section.readyToMerge}
        waitingOnAuthor={section.waitingOnAuthor}
      />
      <ColumnSlot
        asideAction="remove"
        dropBehavior="setAside"
        pullRequests={section.aside}
        slotId="aside"
        title="Aside"
      />
      {showCap ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent"
        />
      ) : null}
      {overflows ? (
        <button
          className="absolute bottom-2 left-1/2 -translate-x-1/2 cursor-pointer rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            setIsExpanded((value) => {
              const next = !value;

              if (!next) {
                sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }

              return next;
            });
          }}
          type="button"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </section>
  );
};

const getInitials = (login: string): string => login.slice(0, 2).toUpperCase() || "?";

const KanbanSkeleton = ({ sectionGrid }: { sectionGrid: string }): React.JSX.Element => (
  <div aria-label="Loading pull requests" className="flex flex-col gap-y-56 pt-10">
    {[0, 1].map((row) => (
      <div className={cn("grid items-start gap-x-6", sectionGrid)} key={row}>
        <div className="flex flex-col gap-2 pt-1 pr-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
        {[0, 1, 2, 3].map((column) => (
          <div className="flex flex-col gap-2" key={column}>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    ))}
  </div>
);

const buildRepoSections = (input: {
  aside: PullRequestSummary[];
  myPrs: PullRequestSummary[];
  needsReview: PullRequestSummary[];
  readyToMerge: PullRequestSummary[];
  waitingOnAuthor: PullRequestSummary[];
}): RepoSection[] => {
  const map = new Map<string, RepoSection>();
  const seenAuthors = new Map<string, Set<string>>();
  const ensure = (pr: PullRequestSummary): RepoSection => {
    const key = pr.repositoryName;
    let section = map.get(key);

    if (!section) {
      section = {
        aside: [],
        authors: [],
        myPrs: [],
        needsReview: [],
        owner: pr.owner,
        readyToMerge: [],
        repo: pr.repo,
        repositoryName: key,
        waitingOnAuthor: [],
      };
      map.set(key, section);
      seenAuthors.set(key, new Set());
    }

    const authors = seenAuthors.get(key);

    if (authors && !authors.has(pr.author.login)) {
      authors.add(pr.author.login);
      section.authors.push(pr.author);
    }

    return section;
  };

  for (const pr of input.myPrs) {
    ensure(pr).myPrs.push(pr);
  }
  for (const pr of input.needsReview) {
    ensure(pr).needsReview.push(pr);
  }
  for (const pr of input.aside) {
    ensure(pr).aside.push(pr);
  }
  for (const pr of input.readyToMerge) {
    ensure(pr).readyToMerge.push(pr);
  }
  for (const pr of input.waitingOnAuthor) {
    ensure(pr).waitingOnAuthor.push(pr);
  }

  return [...map.values()].sort((a, b) => {
    const recencyDelta = mostRecentUpdatedAt(b) - mostRecentUpdatedAt(a);

    if (recencyDelta !== 0) {
      return recencyDelta;
    }

    return a.repositoryName.toLowerCase().localeCompare(b.repositoryName.toLowerCase());
  });
};

const mostRecentUpdatedAt = (section: RepoSection): number => {
  let latest = 0;

  for (const group of [
    section.myPrs,
    section.needsReview,
    section.readyToMerge,
    section.waitingOnAuthor,
    section.aside,
  ]) {
    for (const pr of group) {
      const timestamp = Date.parse(pr.updatedAt);

      if (!Number.isNaN(timestamp) && timestamp > latest) {
        latest = timestamp;
      }
    }
  }

  return latest;
};

const dedupeByReference = (pullRequests: PullRequestSummary[]): PullRequestSummary[] => {
  const seen = new Set<string>();

  return pullRequests.filter((pullRequest) => {
    if (seen.has(pullRequest.reference)) {
      return false;
    }
    seen.add(pullRequest.reference);

    return true;
  });
};

const filterByQuery = (
  pullRequests: PullRequestSummary[],
  needle: string,
): PullRequestSummary[] => {
  if (!needle) {
    return pullRequests;
  }

  return pullRequests.filter((pullRequest) => {
    const haystack = [
      pullRequest.title,
      pullRequest.reference,
      pullRequest.repositoryName,
      pullRequest.author?.login ?? "",
      String(pullRequest.number),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });
};
