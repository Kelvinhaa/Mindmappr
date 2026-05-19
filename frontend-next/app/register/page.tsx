"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
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
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/login?registered=1");
  }

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🧠</span>
          <span className="logo-text">MindMappr</span>
        </div>
        <p className="tagline">Discover study techniques tailored to your learning style</p>
      </header>

      <main className="main-card">
        <h2 className="card-title">Create Account</h2>
        <p className="card-description">Sign up to save and track your study sessions.</p>

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
              placeholder="Min. 6 characters"
              minLength={6}
              required
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" />
                Creating account...
              </span>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="auth-link">
          Already have an account?{" "}
          <Link href="/login">Sign in</Link>
        </p>
      </main>
    </div>
  );
}
