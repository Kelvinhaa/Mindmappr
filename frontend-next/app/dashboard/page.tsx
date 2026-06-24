"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  StudyResponse,
  ReviewResponse,
  ReviewQueueItem,
  StatsResponse,
} from "@/types/study";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const RATING_BUTTONS = [
  { label: "Again", rating: 1, cls: "review-btn review-btn-rating-1 review-btn-tall", sub: "< 1 day" },
  { label: "Hard",  rating: 2, cls: "review-btn review-btn-rating-2 review-btn-tall", sub: "shorter"  },
  { label: "Good",  rating: 3, cls: "review-btn review-btn-rating-3 review-btn-tall", sub: "on track" },
  { label: "Easy",  rating: 4, cls: "review-btn review-btn-rating-4 review-btn-tall", sub: "longer"   },
] as const;

function formatNextReview(iso: string | null | undefined): string {
  if (!iso) return "Not scheduled";
  const diffDays = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diffDays < 0)  return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays} days`;
}

function stabilityPct(stability: number): number {
  return Math.min(100, Math.round((stability / 30) * 100));
}

function urgencyCardClass(item: ReviewQueueItem): string {
  return item.days_overdue > 1
    ? "session-card session-card--overdue"
    : "session-card session-card--due";
}

function urgencyBadge(item: ReviewQueueItem): { cls: string; label: string } {
  if (!item.next_review_at) return { cls: "due-badge due-badge--today", label: "New — review now" };
  if (item.days_overdue > 1) return { cls: "due-badge due-badge--overdue", label: `${Math.floor(item.days_overdue)}d overdue` };
  return { cls: "due-badge due-badge--today", label: "Due today" };
}

export default function Dashboard() {
  const router = useRouter();
  const [queue, setQueue]       = useState<ReviewQueueItem[]>([]);
  const [upcoming, setUpcoming] = useState<StudyResponse[]>([]);
  const [stats, setStats]       = useState<StatsResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [token, setToken]       = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<ReviewQueueItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmations, setConfirmations] = useState<Record<number, string>>({});

  const loadData = useCallback(async (t: string) => {
    const headers = { Authorization: `Bearer ${t}` };
    const [qRes, sRes, stRes] = await Promise.all([
      fetch(`${API_BASE}/study/review-queue`, { headers }),
      fetch(`${API_BASE}/study`,              { headers }),
      fetch(`${API_BASE}/study/stats`,        { headers }),
    ]);

    const queueData: ReviewQueueItem[] = qRes.ok  ? await qRes.json()  : [];
    const allData:   StudyResponse[]   = sRes.ok  ? await sRes.json()  : [];
    const statsData: StatsResponse | null = stRes.ok ? await stRes.json() : null;

    const dueIds = new Set(queueData.map(q => q.id));
    setQueue(queueData);
    setUpcoming(allData.filter(s => !dueIds.has(s.id)));
    setStats(statsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      const t = session.access_token;
      setToken(t);
      loadData(t);
    });
  }, [router, loadData]);

  async function submitReview(rating: number) {
    if (!reviewing || !token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/study/${reviewing.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating }),
      });
      if (res.ok) {
        const updated: ReviewResponse = await res.json();
        const days = updated.interval_days;
        const msg = days === 1 ? "Tomorrow" : `In ${days} days`;

        setQueue(prev => prev.filter(s => s.id !== reviewing.id));
        setStats(prev => prev ? {
          ...prev,
          due_today: Math.max(0, prev.due_today - 1),
          reviewed_today: prev.reviewed_today + 1,
        } : prev);
        setConfirmations(prev => ({ ...prev, [reviewing.id]: `Next review: ${msg}` }));
        setReviewing(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

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

        {/* Stats bar */}
        {stats && (
          <div className="stats-bar">
            <div className="stat-card">
              <div className="stat-value">{stats.total_sessions}</div>
              <div className="stat-label">Sessions</div>
            </div>
            <div className="stat-card stat-card--due">
              <div className="stat-value">{stats.due_today}</div>
              <div className="stat-label">Due Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.reviewed_today}</div>
              <div className="stat-label">Reviewed Today</div>
            </div>
          </div>
        )}

        {loading && <p className="dash-empty">Loading sessions…</p>}

        {/* Due for Review */}
        {!loading && queue.length > 0 && (
          <section className="dash-section">
            <div className="dash-section-header">
              <h3 className="dash-section-title">Due for Review</h3>
              <span className="dash-section-count dash-section-count--due">{queue.length}</span>
            </div>
            <div className="session-list">
              {queue.map(s => {
                const badge = urgencyBadge(s);
                return (
                  <div key={s.id} className={urgencyCardClass(s)}>
                    <div className="session-info">
                      <span className="session-subject">{s.subject}</span>
                      <span className="session-meta">
                        {s.level} · {s.time} min · {s.review_count}× reviewed
                      </span>
                      {confirmations[s.id] ? (
                        <span className="review-confirmed">
                          <span>✓</span>
                          {confirmations[s.id]}
                        </span>
                      ) : (
                        <span className={badge.cls}>{badge.label}</span>
                      )}
                      <div className="stability-bar-wrap">
                        <div className="stability-bar-track">
                          <div
                            className="stability-bar-fill"
                            style={{ width: `${stabilityPct(s.stability)}%` }}
                          />
                        </div>
                        <span className="stability-label">
                          {s.stability > 0 ? `S: ${s.stability.toFixed(1)}d` : "New"}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => setReviewing(s)}
                    >
                      Review
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Coming Up */}
        {!loading && upcoming.length > 0 && (
          <section className="dash-section">
            <div className="dash-section-header">
              <h3 className="dash-section-title">Coming Up</h3>
              <span className="dash-section-count">{upcoming.length}</span>
            </div>
            <div className="session-list">
              {upcoming.map(s => (
                <div key={s.id} className="session-card">
                  <div className="session-info">
                    <span className="session-subject">{s.subject}</span>
                    <span className="session-meta">
                      {s.level} · {s.time} min · {s.review_count}× reviewed
                    </span>
                    <span className="session-due">{formatNextReview(s.next_review_at)}</span>
                    <div className="stability-bar-wrap">
                      <div className="stability-bar-track">
                        <div
                          className="stability-bar-fill"
                          style={{ width: `${stabilityPct(s.stability ?? 0)}%` }}
                        />
                      </div>
                      <span className="stability-label">
                        {(s.stability ?? 0) > 0 ? `S: ${s.stability.toFixed(1)}d` : "New"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && queue.length === 0 && upcoming.length === 0 && (
          <div className="dash-empty">
            <p>No study sessions yet.</p>
            <Link href="/" className="btn btn-primary">
              Create your first plan
            </Link>
          </div>
        )}
      </main>

      {/* Review Modal */}
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
              {RATING_BUTTONS.map(({ label, rating, cls, sub }) => (
                <button
                  key={label}
                  className={cls}
                  disabled={submitting}
                  onClick={() => submitReview(rating)}
                >
                  {label}
                  <span className="review-btn-sublabel">{sub}</span>
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
