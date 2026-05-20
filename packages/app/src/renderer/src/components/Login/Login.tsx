import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectAuthError,
  selectAuthStatus,
  selectDeviceFlow,
} from "../../store/auth/auth-selectors";
import { authActions } from "../../store/auth/auth-slice";
import type { AppDispatch } from "../../store/store";

export const Login = (): React.JSX.Element => {
  const dispatch = useDispatch<AppDispatch>();
  const authError = useSelector(selectAuthError);
  const authStatus = useSelector(selectAuthStatus);
  const deviceFlow = useSelector(selectDeviceFlow);

  useEffect(() => {
    if (authStatus === "idle") {
      dispatch(authActions.checkAuth());
    }
  }, [authStatus, dispatch]);

  const isChecking = authStatus === "checking";
  const isPolling = authStatus === "polling";

  return (
    <section className="panel login-panel">
      <p className="eyebrow">GitHub sign-in</p>
      <h1>Connect GitHub to review pull requests.</h1>
      <p className="muted">
        We first check your local GitHub CLI session. If one is not available, sign in with a
        one-time device code.
      </p>
      {deviceFlow ? (
        <div className="stack" aria-live="polite">
          <p className="muted">Open GitHub, then enter this code:</p>
          <strong className="auth-code">{deviceFlow.userCode}</strong>
          <a
            className="auth-link"
            href={deviceFlow.verificationUriComplete ?? deviceFlow.verificationUri}
            rel="noreferrer"
            target="_blank"
          >
            {deviceFlow.verificationUri}
          </a>
          <p className="muted">Waiting for GitHub authorization...</p>
        </div>
      ) : null}
      <button
        className="button"
        disabled={isChecking || isPolling}
        onClick={() => dispatch(authActions.startDeviceFlow())}
        type="button"
      >
        {isChecking ? "Checking GitHub CLI..." : isPolling ? "Waiting for GitHub..." : "Sign in"}
      </button>
      {authError ? <p className="error">{authError}</p> : null}
    </section>
  );
};
