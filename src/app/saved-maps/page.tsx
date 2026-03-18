"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type SavedMap = {
  id: string;
  cid: string;
  url: string;
  description: string;
  createdAt: string;
};

type SessionData = {
  authenticated: boolean;
  email?: string;
};

export default function SavedMapsPage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [maps, setMaps] = useState<SavedMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedMapId, setCopiedMapId] = useState<string | null>(null);
  const copiedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        const sessionResponse = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        const sessionData = (await sessionResponse.json()) as SessionData;
        setSession(sessionData);

        if (!sessionData.authenticated) {
          setIsLoading(false);
          return;
        }

        const mapsResponse = await fetch("/api/maps", { cache: "no-store" });
        if (!mapsResponse.ok) {
          const message = await mapsResponse.text();
          throw new Error(message || "Unable to load saved maps.");
        }

        const payload = (await mapsResponse.json()) as { maps?: SavedMap[] };
        setMaps(payload.maps ?? []);
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Unable to load saved maps.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void load();

    return () => {
      if (copiedTimeoutRef.current) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  const prettyCount = useMemo(() => {
    if (maps.length === 1) return "1 saved map";
    return `${maps.length} saved maps`;
  }, [maps.length]);

  const copyUrl = async (url: string, mapId: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedMapId(mapId);

    if (copiedTimeoutRef.current) {
      window.clearTimeout(copiedTimeoutRef.current);
    }

    copiedTimeoutRef.current = window.setTimeout(() => {
      setCopiedMapId(null);
    }, 1800);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession({ authenticated: false });
    setMaps([]);
  };

  if (isLoading) {
    return (
      <div className="saved-page">
        <div className="saved-empty">Loading saved maps...</div>
      </div>
    );
  }

  if (!session?.authenticated) {
    return (
      <div className="saved-page">
        <div className="saved-empty">
          <h1>Saved Maps</h1>
          <p>Sign up to borderlesscitizen.org and access your saved maps.</p>
          <p className="helper">Already signed up? <Link href="/auth?mode=login&next=/saved-maps">Log in</Link>.</p>
          <div className="saved-actions">
            <Link className="primary compact" href="/auth?mode=signup&next=/saved-maps">
              Create account
            </Link>
            <Link className="ghost compact" href="/">
              Back to map builder
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-page">
      <header className="saved-header">
        <div>
          <p className="eyebrow">Borderless Citizen</p>
          <h1>Saved Maps</h1>
          <p className="helper">{prettyCount}</p>
        </div>
        <div className="saved-actions">
          <p className="helper">{session.email}</p>
          <button className="ghost compact" onClick={logout}>
            Log out
          </button>
          <Link className="ghost compact" href="/">
            Map builder
          </Link>
        </div>
      </header>

      {error ? <p className="share-warning">{error}</p> : null}

      {maps.length === 0 ? (
        <div className="saved-empty">
          <p>You have not saved any maps yet.</p>
          <Link className="primary compact" href="/">
            Build your first map
          </Link>
        </div>
      ) : (
        <section className="saved-grid">
          {maps.map((map) => (
            <article key={map.id} className="saved-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="saved-thumb" src={map.url} alt="Saved map preview" />
              <div className="saved-card-body">
                <p className="saved-date">
                  Saved on {new Date(map.createdAt).toLocaleDateString()} {new Date(map.createdAt).toLocaleTimeString()}
                </p>
                <p className="saved-description">{map.description || "No description."}</p>
              </div>
              <button
                className="url-icon-button"
                onClick={() => copyUrl(map.url, map.id)}
                aria-label="Copy map URL"
                title="Copy map URL"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M10.6 13.4a1 1 0 0 1 0-1.4l3.9-3.9a3 3 0 1 1 4.2 4.2l-2.3 2.3a3 3 0 0 1-4.2 0 1 1 0 0 1 1.4-1.4 1 1 0 0 0 1.4 0l2.3-2.3a1 1 0 0 0-1.4-1.4l-3.9 3.9a1 1 0 0 1-1.4 0Zm2.8-2.8a1 1 0 0 1 0 1.4l-3.9 3.9a3 3 0 0 1-4.2-4.2l2.3-2.3a3 3 0 0 1 4.2 0 1 1 0 0 1-1.4 1.4 1 1 0 0 0-1.4 0l-2.3 2.3a1 1 0 1 0 1.4 1.4l3.9-3.9a1 1 0 0 1 1.4 0Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              {copiedMapId === map.id ? <p className="copy-notice">Copied!</p> : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
