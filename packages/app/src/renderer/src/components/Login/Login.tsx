import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getRuntimeLabel } from "../../services/runtime";
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
  const runtime = getRuntimeLabel();

  useEffect(() => {
    if (authStatus === "idle") {
      dispatch(authActions.checkAuth());
    }
  }, [authStatus, dispatch]);

  const isChecking = authStatus === "checking";
  const isPolling = authStatus === "polling";

  return (
    <Card aria-labelledby="login-title" className="mt-[min(12vh,5rem)] w-full max-w-[34rem]">
      <CardHeader>
        <CardTitle id="login-title">GitHub sign-in</CardTitle>
        <CardDescription>Connect GitHub to review pull requests.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm leading-6 text-muted-foreground">
          {runtime === "desktop"
            ? "We first check your local GitHub CLI session. If one is not available, sign in with a one-time device code."
            : "Continue through GitHub OAuth. The app will request repository access for the pull requests you review."}
        </p>
        {deviceFlow ? (
          <div className="flex flex-col gap-3" aria-live="polite">
            <p className="text-sm leading-6 text-muted-foreground">
              Open GitHub, then enter this code:
            </p>
            <strong className="inline-flex justify-center rounded-lg border border-border bg-muted px-4 py-3 font-mono text-2xl font-semibold tracking-widest text-foreground">
              {deviceFlow.userCode}
            </strong>
            <a
              className="break-words text-sm text-primary underline-offset-4 hover:underline"
              href={deviceFlow.verificationUriComplete ?? deviceFlow.verificationUri}
              rel="noreferrer"
              target="_blank"
            >
              {deviceFlow.verificationUri}
            </a>
            <p className="text-sm leading-6 text-muted-foreground">
              Waiting for GitHub authorization...
            </p>
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <Button
          disabled={isChecking || isPolling}
          onClick={() => dispatch(authActions.startDeviceFlow())}
          type="button"
        >
          {runtime === "web"
            ? isChecking || isPolling
              ? "Opening GitHub..."
              : "Sign in with GitHub"
            : isChecking
              ? "Checking GitHub CLI..."
              : isPolling
                ? "Waiting for GitHub..."
                : "Sign in"}
        </Button>
        {authError ? (
          <Alert variant="destructive">
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        ) : null}
      </CardFooter>
    </Card>
  );
};
