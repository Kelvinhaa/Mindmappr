"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { StudyResponse, ReviewResponse } from "@/types/study";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const QUALITY_BUTTONS = [
  { label: "Again", quality: 0, className: "review-btn-again" },
  { label: "Hard",  quality: 2, className: "review-btn-hard"  },
  { label: "Good",  quality: 4, className: "review-btn-good"  },
  { label: "Easy",  quality: 5, className: "review-btn-easy"  },
] as const;

function isDue(session: StudyResponse): boolean {
  if (!session.next_review_at) return session.review_count === 0;
  return new Date(session.next_review_at) <= new Date();
}

function formatNextReview(iso: string | null | undefined): string {
  if (!iso) return "Not scheduled";
  const diffDays = Math.round(
    (new Date(iso).getTime() - Date.now()) / 86400000
  );
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays} days`;
}

export default function Dashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StudyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<StudyResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      const t = session.access_token;
      setToken(t);
      fetch(`${API_BASE}/study`, { headers: { Authorization: `Bearer ${t}` } })
        .then(res => (res.ok ? res.json() : []))
        .then(data => setSessions(data))
        .finally(() => setLoading(false));
    });
  }, [router]);

  async function submitReview(quality: number) {
    if (!reviewing || !token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/study/${reviewing.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quality }),
      });
      if (res.ok) {
        const updated: ReviewResponse = await res.json();
        setSessions(prev =>
          prev.map(s => s.id === reviewing.id ? { ...s, ...updated } : s)
        );
        setReviewing(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const due = sessions.filter(isDue);
  const upcoming = sessions.filter(s => !isDue(s));

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🧠</span>
          <span className="logo-text">MindMappr</span>
        </div>
        <nav className="dash-nav">
          <Link href="/" className="btn btn-ghost">New Plan</Link>
        </nav>
        <p className="tagline">Your study history and review schedule</p>
      </header>

      <main>
        <h2 className="dash-heading">Study Dashboard</h2>

        {loading && <p className="dash-empty">Loading sessions…</p>}

        {!loading && due.length > 0 && (
          <section className="dash-section">
            <h3 className="dash-section-title">Due for Review ({due.length})</h3>
            <div className="session-list">
              {due.map(s => (
                <div key={s.id} className="session-card session-card--due">
                  <div className="session-info">
                    <span className="session-subject">{s.subject}</span>
                    <span className="session-meta">{s.level} · {s.time} min · {s.review_count}× reviewed</span>
                    <span className="session-due due-badge">
                      {s.next_review_at ? formatNextReview(s.next_review_at) : "New — review now"}
                    </span>
                  </div>
                  <button className="btn btn-primary" onClick={() => setReviewing(s)}>
                    Review
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && upcoming.length > 0 && (
          <section className="dash-section">
            <h3 className="dash-section-title">Upcoming</h3>
            <div className="session-list">
              {upcoming.map(s => (
                <div key={s.id} className="session-card">
                  <div className="session-info">
                    <span className="session-subject">{s.subject}</span>
                    <span className="session-meta">{s.level} · {s.time} min · {s.review_count}× reviewed</span>
                    <span className="session-due">{formatNextReview(s.next_review_at)}</span>
                  </div>
                  <button className="btn btn-ghost" onClick={() => setReviewing(s)}>
                    View
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && sessions.length === 0 && (
          <div className="dash-empty">
            <p>No study sessions yet.</p>
            <Link href="/" className="btn btn-primary">Create your first plan</Link>
          </div>
        )}
      </main>

      {reviewing && (
        <div className="modal-overlay" onClick={() => !submitting && setReviewing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Review: {reviewing.subject}</h3>
            <p className="modal-body">{reviewing.recommendation.summary}</p>
            <div className="review-techniques">
              {reviewing.recommendation.techniques.map((t, i) => (
                <div key={i} className="technique-mini">
                  <strong>{t.title}</strong> · {t.duration_minutes} min
                  <p className="technique-mini-desc">{t.description}</p>
                </div>
              ))}
            </div>
            <p className="modal-prompt">How well did you recall this material?</p>
            <div className="review-buttons">
              {QUALITY_BUTTONS.map(({ label, quality, className }) => (
                <button
                  key={label}
                  className={`review-btn ${className}`}
                  disabled={submitting}
                  onClick={() => submitReview(quality)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="btn btn-ghost modal-cancel"
              disabled={submitting}
              onClick={() => setReviewing(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
