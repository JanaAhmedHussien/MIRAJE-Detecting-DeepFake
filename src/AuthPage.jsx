import { useState } from "react";
import { flushSync } from "react-dom";
import { useAuth } from "./AuthContext";
import "./AuthPage.css";

const FIREBASE_NOT_CONFIGURED =
  import.meta.env.VITE_FIREBASE_API_KEY === "your_api_key_here" ||
  !import.meta.env.VITE_FIREBASE_API_KEY;

function friendlyError(code) {
  const map = {
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": null,
    "auth/invalid-api-key": null,
    "auth/app-not-authorized": null,
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/cancelled-popup-request": "Google sign-in was cancelled.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/user-disabled": "This account has been disabled.",
  };
  if (code in map) return map[code];
  return "Something went wrong. Please try again.";
}

function GoogleIcon() {
  return (
    <svg className="auth-google-icon" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function AuthPage() {
  const [tab, setTab]           = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [cfgError, setCfgError] = useState(FIREBASE_NOT_CONFIGURED);
  const [loading, setLoading]   = useState(false);

  const { login, signup, loginWithGoogle } = useAuth();

  function switchTab(t) {
    setTab(t);
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirm("");
    setError("");
  }

  function runSubmit() {
    flushSync(() => setError(""));

    if (tab === "signup" && !username.trim()) {
      flushSync(() => setError("Please enter a username."));
      return;
    }
    if (tab === "signup" && password !== confirm) {
      flushSync(() => setError("Passwords do not match."));
      return;
    }

    flushSync(() => setLoading(true));

    const action = tab === "login"
      ? login(email, password)
      : signup(email, password, username);

    action
      .then(() => setLoading(false))
      .catch(err => {
        const msg = friendlyError(err.code);
        if (msg === null) setCfgError(true);
        else setError(msg);
        setLoading(false);
      });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!loading) runSubmit();
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      const msg = friendlyError(err.code);
      if (msg === null) setCfgError(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-root" data-testid="auth-page">

      {/* ── HEADER ── */}
      <header className="auth-header">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="auth-brand-wordmark">Miraje</div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="auth-body">

        {/* LEFT */}
        <div className="auth-left">
          <div className="auth-eyebrow">Forensic Detection System</div>
          <h1 className="auth-heading">
            See what's real.<br />
            <em>Reveal what isn't.</em>
          </h1>
          <p className="auth-subtext">
            Sign in to access forensic-grade deepfake detection across image, video, audio, signature, and text media.
          </p>
        </div>

        {/* RIGHT */}
        <div className="auth-right">

          {cfgError && (
            <div className="auth-setup-notice">
              <strong>Firebase not configured</strong>
              Open <code>.env</code> and paste your Firebase credentials to enable authentication.
            </div>
          )}

          <div className="auth-tabs">
            <button
              className={`auth-tab${tab === "login" ? " active" : ""}`}
              onClick={() => switchTab("login")}
              type="button"
            >
              Sign In
            </button>
            <button
              className={`auth-tab${tab === "signup" ? " active" : ""}`}
              onClick={() => switchTab("signup")}
              type="button"
            >
              Create Account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>

            {/* USERNAME — signup only, first */}
            {tab === "signup" && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-username">Username</label>
                <input
                  id="auth-username"
                  className="auth-input"
                  type="text"
                  placeholder="Your display name"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            )}

            {/* EMAIL */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* PASSWORD */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                className="auth-input"
                type="password"
                placeholder={tab === "signup" ? "Min. 6 characters" : "Enter password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
              />
            </div>

            {/* CONFIRM PASSWORD — signup only */}
            {tab === "signup" && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-confirm">Confirm Password</label>
                <input
                  id="auth-confirm"
                  className="auth-input"
                  type="password"
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <div className="auth-submit-row">
              <button
                className="auth-submit"
                type="submit"
                id="auth-submit-btn"
                disabled={loading}
              >
                {loading
                  ? <><span className="auth-spinner" />{tab === "login" ? "Signing in…" : "Creating…"}</>
                  : (tab === "login" ? "Sign In →" : "Create Account →")}
              </button>

              <div className="auth-switch">
                {tab === "login"
                  ? <button className="auth-switch-btn" type="button" onClick={() => switchTab("signup")}>Create account</button>
                  : <button className="auth-switch-btn" type="button" onClick={() => switchTab("login")}>Sign in instead</button>
                }
              </div>
            </div>

          </form>

          <div className="auth-divider">
            <div className="auth-divider-line" />
            <span className="auth-divider-text">or</span>
            <div className="auth-divider-line" />
          </div>

          <button
            className="auth-google"
            id="auth-google-btn"
            onClick={handleGoogle}
            disabled={loading}
            type="button"
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

        </div>
      </div>
    </div>
  );
}