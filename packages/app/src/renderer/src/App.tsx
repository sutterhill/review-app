import type { FormEvent } from "react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Route, Routes, useParams } from "react-router";

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
  const tokenError = useSelector(selectTokenError);
  const tokenSaveStatus = useSelector(selectTokenSaveStatus);
  const [githubToken, setGithubToken] = useState("");
  const [prReference, setPrReference] = useState(
    owner && repo && number ? `${owner}/${repo}#${number}` : "owner/repo#1",
  );

  const handleTokenSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    dispatch(prActions.saveGitHubToken(githubToken));
  };

  const handleFetchSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    dispatch(prActions.fetchPr(prReference));
  };

  return (
    <section className="panel">
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
        <div className="result-card">
          <p className="eyebrow">Fetched PR</p>
          <h2>{prData.metadata.title}</h2>
          <p>
            {prData.metadata.author.login} opened {prData.metadata.reference} with{" "}
            {prData.files.length} changed files.
          </p>
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
