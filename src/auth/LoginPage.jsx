import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  async function signInWithMagicLink(e) {
    e?.preventDefault();
    setLoading(true);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    setNotice(
      error
        ? { type: "error", text: error.message }
        : { type: "info", text: "Magic link sent — check your inbox." }
    );
  }

  async function signInWithPassword(e) {
    e?.preventDefault();
    setLoading(true);
    setNotice(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setNotice({ type: "error", text: error.message });
    else {
      setNotice({ type: "info", text: "Signed in." });
      if (onLogin) onLogin(data);
    }
  }

  async function handleGitHubSignIn() {
    setNotice(null);
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin,
      },
    });
    setLoading(false);
  }

  async function handleGoogleSignIn() {
    setNotice(null);
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto", padding: 20, border: "1px solid #eee", borderRadius: 8 }}>
      <h2>Sign in</h2>

      {notice && (
        <div style={{ marginBottom: 12, color: notice.type === "error" ? "crimson" : "green" }}>
          {notice.text}
        </div>
      )}

      <form onSubmit={signInWithMagicLink}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="submit" disabled={loading} style={{ flex: 1 }}>
            {loading ? "Sending…" : "Send Magic Link"}
          </button>

          <button
            type="button"
            onClick={signInWithPassword}
            disabled={loading || !password}
            style={{ flex: 1 }}
          >
            {loading ? "Signing…" : "Sign in (password)"}
          </button>
        </div>

        <label style={{ display: "block", marginTop: 12 }}>
          Password (optional)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>
      </form>

      <hr style={{ margin: "16px 0" }} />

      <div style={{ display: "grid", gap: 8 }}>
        <button
          type="button"
          onClick={handleGitHubSignIn}
          disabled={loading}
          className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Sign in with GitHub
        </button>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", background: "#fff" }}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
