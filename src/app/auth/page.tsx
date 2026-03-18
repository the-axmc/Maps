"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";

type Mode = "signup" | "login";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const redirectTo = searchParams.get("next") || "/saved-maps";

  const [mode, setMode] = useState<Mode>(modeParam === "login" ? "login" : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const heading = useMemo(
    () => (mode === "signup" ? "Create Account" : "Log In"),
    [mode]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");
    setIsSubmitting(true);

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const message = await response.text();
        setError(message || "Authentication failed.");
        setIsSubmitting(false);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Authentication failed. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Borderless Citizen</p>
        <h1>{heading}</h1>
        <p className="subhead auth-subhead">
          {mode === "signup"
            ? "Create your account to save maps and revisit them anytime."
            : "Log in to access your saved maps."}
        </p>

        <div className="auth-switch" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={mode === "signup" ? "primary compact" : "ghost compact"}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
          <button
            type="button"
            className={mode === "login" ? "primary compact" : "ghost compact"}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </div>

          <button type="submit" className="primary" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : heading}
          </button>
        </form>

        {error ? <p className="share-warning">{error}</p> : null}

        <p className="helper auth-links">
          <Link href="/">Back to map builder</Link>
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="auth-page">Loading...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}
