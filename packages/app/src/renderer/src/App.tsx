import { Link, Route, Routes, useParams } from "react-router";

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

  return (
    <section className="panel">
      <p className="eyebrow">Pull Request</p>
      <h1>
        {owner}/{repo}#{number}
      </h1>
      <p>This route is ready for PR fetching, diff rendering, and narrative generation.</p>
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
