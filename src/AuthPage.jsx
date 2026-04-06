import { useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthContext";
import "./AuthPage.css";

/* ── STAR CANVAS ── */
function StarCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext("2d");
    let W, H, raf;
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random(), y: Math.random() * 0.65,
      r: Math.random() * 1.1 + 0.18,
      op: Math.random() * 0.55 + 0.08,
      speed: Math.random() * 3.5 + 2,
      phase: Math.random() * Math.PI * 2,
    }));
    const resize = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() / 1000;
      stars.forEach(s => {
        const o = s.op * (0.55 + 0.45 * Math.sin(t / s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(235,238,248,${o})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

/* ── GOOGLE LOGO ── */
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

/* ── FIREBASE ERROR → USER-FRIENDLY TEXT ── */
const FIREBASE_NOT_CONFIGURED =
  import.meta.env.VITE_FIREBASE_API_KEY === "your_api_key_here" ||
  !import.meta.env.VITE_FIREBASE_API_KEY;

function friendlyError(code) {
  const map = {
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": null, // handled by setup notice
    "auth/invalid-api-key":         null,
    "auth/app-not-authorized":      null,
    "auth/email-already-in-use":    "An account with this email already exists.",
    "auth/invalid-email":           "Please enter a valid email address.",
    "auth/weak-password":           "Password must be at least 6 characters.",
    "auth/user-not-found":          "No account found with this email.",
    "auth/wrong-password":          "Incorrect password. Please try again.",
    "auth/invalid-credential":      "Incorrect email or password.",
    "auth/too-many-requests":       "Too many attempts. Please wait a moment and try again.",
    "auth/popup-closed-by-user":    "Google sign-in was cancelled.",
    "auth/cancelled-popup-request": "Google sign-in was cancelled.",
    "auth/network-request-failed":  "Network error. Check your connection.",
    "auth/user-disabled":           "This account has been disabled.",
  };
  if (code in map) return map[code]; // null = show setup notice instead
  return "Something went wrong. Please try again.";
}

/* ── MAIN AUTH PAGE ── */
export default function AuthPage() {
  const [tab, setTab]           = useState("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [cfgError, setCfgError] = useState(FIREBASE_NOT_CONFIGURED);
  const [loading, setLoading]   = useState(false);

  const { login, signup, loginWithGoogle } = useAuth();

  function switchTab(t) {
    setTab(t);
    setEmail(""); setPassword(""); setConfirm(""); setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (tab === "signup" && password !== confirm)
      return setError("Passwords do not match.");

    setLoading(true);
    try {
      tab === "login" ? await login(email, password) : await signup(email, password);
    } catch (err) {
      const msg = friendlyError(err.code);
      if (msg === null) setCfgError(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
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

  /* pool / heat wave data */
  const poolWaves = [
    { pd: "3.2s", pdl: "0s",   pop: .45 },
    { pd: "4.1s", pdl: ".6s",  pop: .28 },
    { pd: "3.7s", pdl: "1.1s", pop: .16 },
  ];
  const heatWaves = [
    { ad: "3.5s", adl: "0s",   aop: .14 },
    { ad: "4.2s", adl: ".45s", aop: .09 },
    { ad: "3.9s", adl: ".9s",  aop: .07 },
    { ad: "5.0s", adl: "1.5s", aop: .05 },
  ];

  return (
    <div className="auth-root">
      {/* sky + stars */}
      <div className="auth-bg"><StarCanvas /></div>
      <div className="auth-glow-blob" />

      {/* ground + horizon */}
      <div className="auth-horizon-wrap">
        <div className="auth-ground" />
        <div className="auth-horizon-glow" />
        <div className="auth-horizon-line" />
        <div className="auth-heat">
          {heatWaves.map((h, i) => (
            <div key={i} className="auth-heat-wave"
              style={{ "--aop": h.aop, "--ad": h.ad, "--adl": h.adl, bottom: `${i * 18}px` }} />
          ))}
        </div>
        <div className="auth-pool">
          {poolWaves.map((p, i) => (
            <div key={i} className="auth-pool-wave"
              style={{ "--pd": p.pd, "--pdl": p.pdl, "--pop": p.pop, bottom: `${i * 4}px` }} />
          ))}
        </div>
      </div>

      <div className="auth-noise" />

      {/* Corner labels */}
      <div className="auth-corner tl">Optical Illusion</div>
      <div className="auth-corner tr">Light · Bending</div>
      <div className="auth-corner bl">Deepfake Detection</div>
      <div className="auth-corner br">Desert · 28.4°N</div>

      {/* ── CARD ── */}
      <div className="auth-container">
        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-wordmark">MIRAJE</div>
          <div className="auth-tagline">Where Reality Dissolves</div>
        </div>

        <div className="auth-card">

          {/* Tabs */}
          <div className="auth-tabs">
            <button className={`auth-tab${tab === "login" ? " active" : ""}`}
              onClick={() => switchTab("login")} type="button">Sign In</button>
            <button className={`auth-tab${tab === "signup" ? " active" : ""}`}
              onClick={() => switchTab("signup")} type="button">Create Account</button>
          </div>

          {/* Firebase setup notice */}
          {cfgError && (
            <div className="auth-setup-notice">
              <span className="auth-setup-icon">🔑</span>
              <div className="auth-setup-text">
                <strong>Firebase not configured</strong>
                Open <code style={{color:"#d4c9b0"}}>.env</code> in the project root and paste your Firebase credentials.
                See the setup instructions below the app for exact steps.
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="auth-error" style={{ marginBottom: 8 }}>
              <span className="auth-error-icon">⚠</span>
              <span className="auth-error-msg">{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-email">Email Address</label>
              <input id="auth-email" className={`auth-input${error ? " err" : ""}`}
                type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-password">Password</label>
              <input id="auth-password" className={`auth-input${error ? " err" : ""}`}
                type="password"
                placeholder={tab === "signup" ? "Min. 6 characters" : "Enter password"}
                value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete={tab === "signup" ? "new-password" : "current-password"} />
            </div>

            {tab === "signup" && (
              <div className="auth-field" style={{ animation: "authUp .25s ease both" }}>
                <label className="auth-label" htmlFor="auth-confirm">Confirm Password</label>
                <input id="auth-confirm"
                  className={`auth-input${error && password !== confirm ? " err" : ""}`}
                  type="password" placeholder="Repeat password"
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  required autoComplete="new-password" />
              </div>
            )}

            <button className="auth-submit" type="submit" id="auth-submit-btn" disabled={loading}>
              <div className="auth-submit-fill" />
              <span className="auth-submit-label">
                {loading
                  ? <><span className="auth-spinner" />{tab === "login" ? "Signing in…" : "Creating…"}</>
                  : (tab === "login" ? "Sign In" : "Create Account")}
              </span>
            </button>
          </form>

          {/* OR divider */}
          <div className="auth-divider" style={{ margin: "22px 0 18px" }}>
            <div className="auth-divider-line" />
            <span className="auth-divider-text">or continue with</span>
            <div className="auth-divider-line" />
          </div>

          {/* Google */}
          <button className="auth-google" id="auth-google-btn"
            onClick={handleGoogle} disabled={loading} type="button">
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

          {/* Switch tab link */}
          <div className="auth-switch">
            {tab === "login" ? (
              <>No account?&nbsp;&nbsp;
                <button className="auth-switch-btn" type="button" onClick={() => switchTab("signup")}>
                  Create one
                </button>
              </>
            ) : (
              <>Already have an account?&nbsp;&nbsp;
                <button className="auth-switch-btn" type="button" onClick={() => switchTab("login")}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
