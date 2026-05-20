import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Route, Routes, useParams } from "react-router";

import { DiffView } from "./components/DiffView";
import { ChangedFileTree } from "./components/FileTree";
import {
  selectNarrativeContent,
  selectNarrativeError,
  selectNarrativeStatus,
} from "./store/narrative/narrative-selectors";
import { narrativeActions } from "./store/narrative/narrative-slice";
import {
  selectPrData,
  selectPrError,
  selectPrStatus,
  selectTokenError,
  selectTokenSaveStatus,
} from "./store/pr/pr-selectors";
import { prActions } from "./store/pr/pr-slice";
import type { AppDispatch } from "./store/store";

const HomeRoute = (): React.JSX.Element => (
  <section className="panel">
    <p className="eyebrow">PR Narrative Review</p>
    <h1>Turn pull request diffs into guided walkthroughs.</h1>
    <p>
      Start with a GitHub PR, then review grouped code changes with AI-generated context about what
      changed and why.
    </p>
    <Link className="button" to="/pr/augment/review-app/1">
      Open example PR route
    </Link>
  </section>
);

const PullRequestRoute = (): React.JSX.Element => {
  const { number, owner, repo } = useParams();
  const dispatch = useDispatch<AppDispatch>();
  const prData = useSelector(selectPrData);
  const prError = useSelector(selectPrError);
  const prStatus = useSelector(selectPrStatus);
  const narrativeContent = useSelector(selectNarrativeContent);
  const narrativeError = useSelector(selectNarrativeError);
  const narrativeStatus = useSelector(selectNarrativeStatus);
  const tokenError = useSelector(selectTokenError);
  const tokenSaveStatus = useSelector(selectTokenSaveStatus);
  const [githubToken, setGithubToken] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [prReference, setPrReference] = useState(
    owner && repo && number ? `${owner}/${repo}#${number}` : "owner/repo#1",
  );
  const fileElements = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    setSelectedFilePath(prData?.files[0]?.filename ?? null);
  }, [prData]);

  const handleTokenSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    dispatch(prActions.saveGitHubToken(githubToken));
  };

  const handleFetchSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    dispatch(prActions.fetchPr(prReference));
  };

  const handleNarrativeGenerate = (): void => {
    dispatch(narrativeActions.generateNarrative());
  };

  const handleFileElement = useCallback((path: string, element: HTMLElement | null): void => {
    if (element) {
      fileElements.current.set(path, element);
      return;
    }

    fileElements.current.delete(path);
  }, []);

  const handleFileSelect = useCallback((path: string): void => {
    setSelectedFilePath(path);
    requestAnimationFrame(() => {
      fileElements.current.get(path)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return (
    <section className={prData ? "panel panel-wide" : "panel"}>
      <p className="eyebrow">Pull Request</p>
      <h1>
        {owner}/{repo}#{number}
      </h1>
      <form className="stack" onSubmit={handleTokenSubmit}>
        <label htmlFor="github-token">GitHub personal access token</label>
        <input
          id="github-token"
          onChange={(event) => setGithubToken(event.target.value)}
          placeholder="github_pat_..."
          type="password"
          value={githubToken}
        />
        <button className="button" type="submit">
          Save token
        </button>
        {tokenSaveStatus === "saved" ? <p className="success">Token saved to settings.</p> : null}
        {tokenError ? <p className="error">{tokenError}</p> : null}
      </form>
      <form className="stack" onSubmit={handleFetchSubmit}>
        <label htmlFor="pr-reference">Pull request reference</label>
        <input
          id="pr-reference"
          onChange={(event) => setPrReference(event.target.value)}
          placeholder="owner/repo#123"
          type="text"
          value={prReference}
        />
        <button className="button" disabled={prStatus === "loading"} type="submit">
          {prStatus === "loading" ? "Fetching..." : "Fetch PR"}
        </button>
      </form>
      {prData ? (
        <div className="review-layout">
          <aside className="file-sidebar" aria-label="Changed files">
            <ChangedFileTree
              files={prData.files}
              onSelect={handleFileSelect}
              selectedPath={selectedFilePath}
            />
          </aside>
          <div className="diff-panel">
            <div className="result-card">
              <p className="eyebrow">Fetched PR</p>
              <h2>{prData.metadata.title}</h2>
              <p>
                {prData.metadata.author.login} opened {prData.metadata.reference} with{" "}
                {prData.files.length} changed files.
              </p>
              <button
                className="button"
                disabled={narrativeStatus === "loading" || narrativeStatus === "streaming"}
                onClick={handleNarrativeGenerate}
                type="button"
              >
                {narrativeStatus === "loading" || narrativeStatus === "streaming"
                  ? "Generating narrative..."
                  : "Generate narrative"}
              </button>
              {narrativeError ? <p className="error">{narrativeError}</p> : null}
              {narrativeContent ? <pre>{narrativeContent}</pre> : null}
            </div>
            <DiffView onFileElement={handleFileElement} pullRequest={prData} />
          </div>
        </div>
      ) : null}
      {prError ? <p className="error">{prError.message}</p> : null}
      <Link to="/">Back home</Link>
    </section>
  );
};

export const App = (): React.JSX.Element => (
  <main className="app-shell">
    <Routes>
      <Route element={<HomeRoute />} path="/" />
      <Route element={<PullRequestRoute />} path="/pr/:owner/:repo/:number" />
    </Routes>
  </main>
);
