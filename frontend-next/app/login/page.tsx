"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="main-card">
      <h2 className="card-title">Sign In</h2>
      <p className="card-description">Welcome back — sign in to access your study plans.</p>

      <form className="form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? (
            <span className="btn-loading">
              <span className="spinner" />
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <p className="auth-link">
        No account?{" "}
        <Link href="/register">Create one</Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🧠</span>
          <span className="logo-text">MindMappr</span>
        </div>
        <p className="tagline">Discover study techniques tailored to your learning style</p>
      </header>
      <LoginForm />
    </div>
  );
}
