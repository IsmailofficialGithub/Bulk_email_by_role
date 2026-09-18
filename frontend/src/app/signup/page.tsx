"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [allowSignups, setAllowSignups] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/public/settings")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setAllowSignups(data.data.allow_signups !== false);
        } else {
          setAllowSignups(true); // default fallback
        }
      })
      .catch(() => setAllowSignups(true));
  }, []);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Send confirmation email via our backend endpoint
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
        const siteUrl = window.location.origin;
        
        await fetch(`${apiUrl}/api/email/send-confirmation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: "Welcome to Viddr - Please confirm your email",
            text: `Thank you for signing up to Viddr! Your account has been created successfully. Visit ${siteUrl}/login to access your account.`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">Welcome to Viddr!</h2>
                <p>Hello,</p>
                <p>Thank you for signing up. Your account has been successfully created.</p>
                <p>Please click the button below to log in and get started:</p>
                <br/>
                <a href="${siteUrl}/login" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Log in to your account</a>
                <br/><br/>
                <p>If you need to verify your email via Supabase, please follow any additional instructions provided separately.</p>
                <br/>
                <p>Best regards,<br/>The Viddr Team</p>
              </div>
            `
          })
        });
      } catch (emailErr) {
        console.error("Failed to send welcome email:", emailErr);
        // We do not block the signup success flow on email failure
      }

      setSuccess("Account created successfully! You can now log in.");
      setLoading(false);
      // Optional: automatically redirect to login after a few seconds
      setTimeout(() => router.push("/login"), 3000);
    }
  }

  return (
    <main className="flex items-center justify-center p-4 w-full h-full my-auto flex-grow relative">
      <Link href="/" className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeft size={16} /> Back to Home
      </Link>
      <div className="w-full max-w-md p-8 bg-[var(--bg-panel)] rounded-2xl border border-[var(--line)] shadow-2xl backdrop-blur-md">
        <Link href="/" className="text-center mb-8 flex flex-col items-center hover:opacity-80 transition-opacity block">
          <img src="/logo.png" alt="Viddr Logo" className="w-12 h-12 rounded-xl mb-4 shadow-sm" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Viddr</h1>
        </Link>
        <p className="text-[var(--muted)] text-center mb-6">Create your account to get started.</p>

        {allowSignups === false ? (
          <div className="p-6 bg-[var(--danger-dim)] text-[var(--danger)] rounded-xl text-center border border-[var(--danger)] border-opacity-20">
            <h3 className="font-bold text-lg mb-2">Signups Closed</h3>
            <p className="text-sm opacity-90">
              We are not accepting new accounts at this time. Please check back later or contact the administrator.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-5">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </label>
          <div className="field">
            <span>Password</span>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full pr-10"
              />
              <button
                type="button"
                className="absolute right-3 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <div className="field">
            <span>Confirm Password</span>
            <div className="relative flex items-center">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full pr-10"
              />
              <button
                type="button"
                className="absolute right-3 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="text-[var(--danger)] text-sm">{error}</p>}
          {success && <p className="text-[var(--ok)] text-sm">{success}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn primary w-full justify-center py-3 text-base"
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </div>
        </form>
        )}

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--accent)] hover:underline font-medium">
            Log In
          </Link>
        </p>
      </div>
    </main>
  );
}
