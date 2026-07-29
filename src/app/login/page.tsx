"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setError("Success! Check your email or try logging in.");
      setLoading(false);
    }
  }

  return (
    <main className="page min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
      <div className="w-full max-w-md p-8 bg-[var(--surface-sunken)] rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="text-center mb-8">
          <h1 className="brand text-3xl mb-2">AutoMailSend</h1>
          <p className="text-[var(--text-muted)]">Sign in or create an account</p>
        </div>

        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field w-full"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="pt-4 flex gap-3">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn flex-1 justify-center"
            >
              {loading ? "Please wait..." : "Log In"}
            </button>
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="btn btn-secondary flex-1 justify-center"
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
