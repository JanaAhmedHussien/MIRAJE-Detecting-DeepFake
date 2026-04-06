import { useState, useEffect, useRef, useCallback } from "react";
import './Miraje.css'
import { useAuth } from './AuthContext';
import AuthPage from './AuthPage';
/* ── DATA CONFIG ── */
const CFG = {
  image: {
    fmts: ["JPG", "PNG", "WEBP", "GIF", "BMP", "TIFF"],
    metrics: [
      { n: "GAN Fingerprint", c: "var(--danger2)" },
      { n: "Frequency Anomaly", c: "var(--acc)" },
      { n: "Face Landmark Drift", c: "var(--warn2)" },
      { n: "Compression Traces", c: "var(--safe2)" }
    ],
    steps: ["Preprocessing", "Feature Extraction", "GAN Classifier", "Frequency Analysis", "Report Generation"],
    results: [
      { code: "SYS-01", name: "Face Analysis", desc: "Landmark geometry, eye blink patterns & skin texture synthesis markers" },
      { code: "SYS-02", name: "Frequency Domain", desc: "DCT & Fourier transform artifact detection in latent space" },
      { code: "SYS-03", name: "Texture Forensics", desc: "Pixel-level GAN fingerprint extraction and classification" }
    ]
  },
  video: {
    fmts: ["MP4", "MOV", "AVI", "MKV", "WEBM"],
    metrics: [
      { n: "Temporal Consistency", c: "var(--danger2)" },
      { n: "Lip-Sync Alignment", c: "var(--acc)" },
      { n: "Motion Artifacts", c: "var(--warn2)" },
      { n: "Frame Coherence", c: "var(--safe2)" }
    ],
    steps: ["Frame Extraction", "Face Tracking", "Temporal Analysis", "Lip-Sync Check", "Report Generation"],
    results: [
      { code: "SYS-01", name: "Face Swap", desc: "Inter-frame face boundary and blending artifacts across sequence" },
      { code: "SYS-02", name: "Lip Sync", desc: "Audio-visual alignment consistency and phoneme mapping" },
      { code: "SYS-03", name: "Motion Flow", desc: "Optical flow coherence and unnatural motion detection" }
    ]
  },
  audio: {
    fmts: ["WAV", "MP3", "FLAC", "OGG", "M4A", "AAC"],
    metrics: [
      { n: "Spectral Artifacts", c: "var(--danger2)" },
      { n: "Prosody Score", c: "var(--acc)" },
      { n: "Voice Embedding Δ", c: "var(--warn2)" },
      { n: "Breath Naturalness", c: "var(--safe2)" }
    ],
    steps: ["Audio Decoding", "Spectrogram Analysis", "Voice Embedding", "Prosody Check", "Report Generation"],
    results: [
      { code: "SYS-01", name: "Voice Cloning", desc: "Latent voice embedding similarity and TTS artifact identification" },
      { code: "SYS-02", name: "Spectrogram", desc: "MFCC deviation and spectral synthesis marker detection" },
      { code: "SYS-03", name: "Prosody & Rhythm", desc: "Unnatural stress, pacing and breathing pattern analysis" }
    ]
  },
  signature: {
    fmts: ["JPG", "PNG", "PDF", "TIFF", "BMP"],
    metrics: [
      { n: "Stroke Velocity", c: "var(--danger2)" },
      { n: "Pressure Variance", c: "var(--acc)" },
      { n: "Tremor Analysis", c: "var(--warn2)" },
      { n: "Loop Consistency", c: "var(--safe2)" }
    ],
    steps: ["Image Preprocessing", "Stroke Segmentation", "Dynamic Analysis", "Template Matching", "Report Generation"],
    results: [
      { code: "SYS-01", name: "Stroke Dynamics", desc: "Velocity, pressure and pen-lift pattern forensic analysis" },
      { code: "SYS-02", name: "Geometric Match", desc: "Reference template comparison via Dynamic Time Warping" },
      { code: "SYS-03", name: "Writer Verify", desc: "Neural handwriting style embedding match and comparison" }
    ]
  }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── STAR CANVAS ── */
function StarCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    let W, H, raf;
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(), y: Math.random() * 0.58,
      r: Math.random() * 1.2 + 0.2,
      op: Math.random() * 0.6 + 0.1,
      speed: Math.random() * 3 + 2,
      phase: Math.random() * Math.PI * 2
    }));
    function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);
    function draw() {
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() / 1000;
      stars.forEach(s => {
        const o = s.op * (0.6 + 0.4 * Math.sin(t / s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(238,240,245,${o})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }} />;
}

/* ── CURSOR ── */
function Cursor() {
  const curRef = useRef(null);
  const ringRef = useRef(null);
  useEffect(() => {
    let mx = 0, my = 0, rx = 0, ry = 0, raf;
    const onMove = e => {
      mx = e.clientX; my = e.clientY;
      if (curRef.current) { curRef.current.style.left = (mx - 3) + "px"; curRef.current.style.top = (my - 3) + "px"; }
    };
    document.addEventListener("mousemove", onMove);
    function loop() {
      rx += (mx - rx - 12) * .1; ry += (my - ry - 12) * .1;
      if (ringRef.current) { ringRef.current.style.left = rx + "px"; ringRef.current.style.top = ry + "px"; }
      raf = requestAnimationFrame(loop);
    }
    loop();
    const hoverEls = () => document.querySelectorAll("button,.mode-tile,.drop-zone,.stat,.result-card,.t-row");
    const addHov = () => hoverEls().forEach(el => {
      el.addEventListener("mouseenter", () => { curRef.current?.classList.add("hov"); ringRef.current?.classList.add("hov"); });
      el.addEventListener("mouseleave", () => { curRef.current?.classList.remove("hov"); ringRef.current?.classList.remove("hov"); });
    });
    setTimeout(addHov, 500);
    return () => { document.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);
  return (
    <>
      <div ref={curRef} className="cursor" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}

/* ── VERDICT RING ── */
function VerdictRing({ score, color, glow }) {
  const offset = score != null ? 298 - (score / 100) * 298 : 298;
  return (
    <div className="vring">
      <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
        <circle className="vr-bg" cx="55" cy="55" r="47" />
        <circle className="vr-track" cx="55" cy="55" r="47" />
        <circle className="vr-fill" cx="55" cy="55" r="47"
          style={{ strokeDashoffset: offset, stroke: color || "var(--rim2)", filter: glow ? `drop-shadow(0 0 7px ${glow})` : "none" }} />
        <circle className="vr-spin" cx="55" cy="55" r="52" />
      </svg>
      <div className="vring-center">
        <div className="vr-pct" style={{ color: color || "var(--ghost)", textShadow: glow ? `0 0 18px ${glow}` : "none" }}>
          {score != null ? `${score.toFixed(0)}%` : "—"}
        </div>
        <div className="vr-sub">Synthetic</div>
      </div>
    </div>
  );
}

/* ── METRIC BAR ── */
function MetricBar({ name, color, value, label }) {
  return (
    <div className="metric">
      <div className="metric-row">
        <span className="metric-name">{name}</span>
        <span className="metric-val">{label}</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${value}%`, background: color }}>
          <div className="fill-dot" style={{ background: color }} />
        </div>
      </div>
    </div>
  );
}

/* ── RESULT CARD ── */
function ResultCard({ code, name, desc, score, mode, visible }) {
  const fake = score > 68, unc = score >= 45 && score <= 68;
  const cls = fake ? "v-fake" : unc ? "v-unc" : "v-real";
  const lbl = fake ? (mode === "signature" ? "Forged" : "Synthetic") : unc ? "Inconclusive" : "Authentic";
  const clr = fake ? "var(--danger2)" : unc ? "var(--warn2)" : "var(--safe2)";
  const g = fake ? "rgba(192,80,74,.28)" : unc ? "rgba(176,128,64,.28)" : "rgba(74,158,130,.28)";
  return (
    <div className="result-card">
      <div className="rc-code">
        <span>{code}</span>
        <span className={`rc-verdict ${cls}`}>{lbl}</span>
      </div>
      <div className="rc-name">{name}</div>
      <div className="rc-score" style={{ color: clr, textShadow: `0 0 18px ${g}`, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)", transition: "opacity .6s ease,transform .6s ease" }}>
        {score.toFixed(1)}<span style={{ fontSize: 18, color: "var(--fog)", textShadow: "none" }}>%</span>
      </div>
      <div className="rc-desc">{desc}</div>
    </div>
  );
}

/* ── MAIN APP ── */
export default function Miraje() {

  const { currentUser, logout } = useAuth();

  // ── AUTH GATE: show login page if not authenticated ──
  if (!currentUser) return <AuthPage />;

  const [mode, setModeKey] = useState("image");
  const [fileLoaded, setFileLoaded] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState([]);
  const [pipelineVisible, setPipelineVisible] = useState(false);
  const [metrics, setMetrics] = useState([]);
  const [verdict, setVerdict] = useState({ score: null, color: null, glow: null, word: "Awaiting Input", note: "Submit a file to begin" });
  const [results, setResults] = useState([]);
  const [visibleScores, setVisibleScores] = useState([]);
  const [activeNav, setActiveNav] = useState("Analysis");
  const [audioSrc, setAudioSrc] = useState(null);
  const [history, setHistory] = useState([]);
  const fileRef = useRef(null);
  const cfg = CFG[mode];

  // Reset metrics on mode change
  useEffect(() => {
    setMetrics(cfg.metrics.map(m => ({ ...m, value: 0, label: "—" })));
    setVerdict({ score: null, color: null, glow: null, word: "Awaiting Input", note: "Submit a file to begin" });
    setResults([]); setPipelineVisible(false);
  }, [mode]);

  // Init metrics
  useEffect(() => {
    setMetrics(cfg.metrics.map(m => ({ ...m, value: 0, label: "—" })));
  }, []);

  function handleSetMode(k) {
    setModeKey(k);
    setFileLoaded(false); setPreviewSrc(null); setFileName(null); setFileSize(null);
  }

  function loadFile(file) {
    setFile(file);
    setFileLoaded(true);
    setFileName(file.name);
    setFileSize((file.size / 1024 / 1024).toFixed(2));
    setVerdict({ score: null, color: null, glow: null, word: "Awaiting Input", note: "Submit a file to begin" });
    setResults([]); setPipelineVisible(false);
    if (file.type.startsWith("image/")) {
      const r = new FileReader();
      r.onload = e => setPreviewSrc(e.target.result);
      r.readAsDataURL(file);
      setAudioSrc(null);
    } else if (file.type.startsWith("audio/")) {
      setAudioSrc(URL.createObjectURL(file));
      setPreviewSrc(null);
    } else {
      setPreviewSrc(null);
      setAudioSrc(null);
    }
    setScanning(true);
    setTimeout(() => setScanning(false), 3200);
  }

  function onDragOver(e) { e.preventDefault(); }
  function onDrop(e) { e.preventDefault(); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); }
  function onFilePick(e) { if (e.target.files[0]) loadFile(e.target.files[0]); }

//   const runAnalysis = useCallback(async () => {
//     if (!fileLoaded || analysing) return;
//     setAnalysing(true);
//     setPipelineVisible(true);
//     const steps = cfg.steps.map((s, i) => ({ label: s, state: "pending" }));
//     setPipelineSteps(steps);

//     for (let i = 0; i < steps.length; i++) {
//       setPipelineSteps(prev => prev.map((s, j) => j === i ? { ...s, state: "running" } : s));
//       await sleep(360 + Math.random() * 260);
//       setPipelineSteps(prev => prev.map((s, j) => j === i ? { ...s, state: "done" } : s));
//     }

//     let score = 50 + Math.random() * 46
//     let prediction = "real"

//     if (mode === 'image') {
//       try {
//         const formData = new FormData();
//         formData.append("image", file);
//         const response = await fetch("http://localhost:5000/predict-image", {
//           method: "POST",
//           body: formData
//         });
//         const data = await response.json();
//         score = data.fake_probability;
//         prediction = data.prediction;
//       } catch (err) {
//         console.error("Image API error:", err);
//       }

//     } else if (mode === 'audio') {
//       try {
//         const formData = new FormData();
//         formData.append("audio", file);
//         const controller = new AbortController();
//         const timeout = setTimeout(() => controller.abort(), 60000);
//         const response = await fetch("http://localhost:5000/predict-audio", {
//           method: "POST",
//           body: formData,
//           signal: controller.signal
//         });
//         clearTimeout(timeout);
//         const data = await response.json();
//         score = data.score;
//         prediction = data.prediction;
//       } catch (err) {
//         console.error("Audio API error:", err);
//         score = 50;
//         prediction = "real";
//       }
//     }

//   else if (mode === 'signature') {
//     try {
//       const formData = new FormData();
//       formData.append("signature", file);
//       const response = await fetch("http://localhost:5000/predict-signature", {
//         method: "POST",
//         body: formData
//       });
//       const data = await response.json();
//       score = data.score;
//       prediction = data.prediction;
//     } catch (err) {
//       console.error("Signature API error:", err);
//       score = 50;
//       prediction = "real";
//     }
//   }

//   const isFake = prediction === "fake";
//   const isUnc = score >= 45 && score <= 68;
//   const color = isFake ? "var(--danger2)" : isUnc ? "var(--warn2)" : "var(--safe2)";
//   const glow = isFake ? "rgba(192,80,74,.4)" : isUnc ? "rgba(176,128,64,.38)" : "rgba(74,158,130,.4)";
//   const word = isFake ? (mode === "signature" ? "Forgery Confirmed" : "Synthetic Detected") : isUnc ? "Inconclusive" : "Authentic";
//   setVerdict({ score, color, glow, word, note: `${score.toFixed(1)}% synthetic probability` });

//   setMetrics(cfg.metrics.map((m) => ({ ...m, value: score, label: score.toFixed(1) + "%" })));

//   setResults(cfg.results.map((r) => ({ ...r, score: score })));
//   setVisibleScores([]);
//   await sleep(80);
//   cfg.results.forEach((_, i) => setTimeout(() => setVisibleScores(prev => [...prev, i]), i * 180));
//   const now = new Date();
//   const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
//   const newEntry = {
//     glyph: getModeGlyph(mode),
//     name: fileName,
//     size: fileSize + " MB",
//     type: mode.charAt(0).toUpperCase() + mode.slice(1),
//     cls: isFake ? "v-fake" : isUnc ? "v-unc" : "v-real",
//     lbl: isFake ? (mode === "signature" ? "Forged" : "Synthetic") : isUnc ? "Inconclusive" : "Authentic",
//     conf: score.toFixed(1) + "%",
//     confClr: isFake ? "var(--danger2)" : isUnc ? "var(--warn2)" : "var(--safe2)",
//     date: dateStr
//   };
//   setHistory(prev => [newEntry, ...prev]);
//   setAnalysing(false);
// }, [fileLoaded, analysing, mode, cfg, file]);

const runAnalysis = useCallback(async () => {
  if (!fileLoaded || analysing) return;

  setAnalysing(true);
  setPipelineVisible(true);

  const steps = cfg.steps.map((s) => ({ label: s, state: "pending" }));
  setPipelineSteps(steps);

  for (let i = 0; i < steps.length; i++) {
    setPipelineSteps(prev =>
      prev.map((s, j) => (j === i ? { ...s, state: "running" } : s))
    );

    await sleep(360 + Math.random() * 260); // animation only

    setPipelineSteps(prev =>
      prev.map((s, j) => (j === i ? { ...s, state: "done" } : s))
    );
  }

  let score = null;
  let prediction = null;

  try {
    const formData = new FormData();

    if (mode === "image") {
      formData.append("image", file);

      const response = await fetch("http://localhost:5000/predict-image", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      score = data.fake_probability;
      prediction = data.prediction;

    } else if (mode === "audio") {

      formData.append("audio", file);

      const response = await fetch("http://localhost:5000/predict-audio", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      score = data.score ?? data.fake_probability;
      prediction = data.prediction;

    } else if (mode === "signature") {

      formData.append("signature", file);

      const response = await fetch("http://localhost:5000/predict-signature", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      score = data.score ?? data.fake_probability;
      prediction = data.prediction;
    }

  } catch (err) {
    console.error("API error:", err);
    setAnalysing(false);
    return;
  }

  if (score == null) {
    setAnalysing(false);
    return;
  }

  const isFake = prediction === "fake";
  const isUnc = score >= 45 && score <= 68;

  const color = isFake
    ? "var(--danger2)"
    : isUnc
    ? "var(--warn2)"
    : "var(--safe2)";

  const glow = isFake
    ? "rgba(192,80,74,.4)"
    : isUnc
    ? "rgba(176,128,64,.38)"
    : "rgba(74,158,130,.4)";

  const word = isFake
    ? mode === "signature"
      ? "Forgery Confirmed"
      : "Synthetic Detected"
    : isUnc
    ? "Inconclusive"
    : "Authentic";

  setVerdict({
    score,
    color,
    glow,
    word,
    note: `${score.toFixed(1)}% synthetic probability`
  });

  setMetrics(
    cfg.metrics.map((m, i) => ({
      ...m,
      value: Math.max(0, score - i * 6),
      label: (Math.max(0, score - i * 6)).toFixed(1) + "%"
    }))
  );

  setResults(cfg.results.map((r) => ({ ...r, score })));

  setVisibleScores([]);

  await sleep(80);

  cfg.results.forEach((_, i) =>
    setTimeout(() => setVisibleScores(prev => [...prev, i]), i * 180)
  );

  const now = new Date();

  const dateStr =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")} · ${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

  const newEntry = {
    glyph: getModeGlyph(mode),
    name: fileName,
    size: fileSize + " MB",
    type: mode.charAt(0).toUpperCase() + mode.slice(1),
    cls: isFake ? "v-fake" : isUnc ? "v-unc" : "v-real",
    lbl: isFake
      ? mode === "signature"
        ? "Forged"
        : "Synthetic"
      : isUnc
      ? "Inconclusive"
      : "Authentic",
    conf: score.toFixed(1) + "%",
    confClr: color,
    date: dateStr
  };

  setHistory(prev => [newEntry, ...prev]);

  setAnalysing(false);

}, [fileLoaded, analysing, mode, cfg, file]);
function getModeGlyph(m) {
  return m === "image" ? "▣" : m === "video" ? "▶" : m === "audio" ? "♪" : "✦";
}


return (
  <>


    <Cursor />

    {/* HEADER */}
    <header>
      <div className="brand">
        <div className="brand-wordmark">MIRAJE</div>
        <div className="brand-divider" />
        <div className="brand-tagline">Where Reality Dissolves</div>
      </div>
      <nav>
        {["Analysis", "Archive", "Reports", "System"].map(n => (
          <button key={n} className={`nav-btn${activeNav === n ? " active" : ""}`} onClick={() => setActiveNav(n)}>{n}</button>
        ))}
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div className="sys-status">
          <div className="pulse-dot" />
          <span>Systems Online</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderLeft: "1px solid var(--rim)", paddingLeft: 16 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--ghost)", letterSpacing: 1, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {currentUser.email}
          </span>
          <button
            id="logout-btn"
            onClick={logout}
            style={{
              background: "none",
              border: "1px solid var(--rim2)",
              borderRadius: 4,
              color: "var(--ghost)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 8,
              letterSpacing: 2,
              textTransform: "uppercase",
              padding: "5px 12px",
              cursor: "none",
              transition: "color .2s, border-color .2s",
            }}
            onMouseEnter={e => { e.target.style.color = "var(--danger2)"; e.target.style.borderColor = "rgba(217,107,99,.4)"; }}
            onMouseLeave={e => { e.target.style.color = "var(--ghost)"; e.target.style.borderColor = "var(--rim2)"; }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>

    {/* HERO */}
    <div className="hero">
      <div className="sky"><StarCanvas /></div>
      <div className="ground" />
      <div className="horizon-glow" />
      <div className="horizon-line" />
      <div className="figure" />
      <div className="pool">
        {[{ d: "3.2s", delay: "0s", op: .5, b: "2px" }, { d: "4.1s", delay: ".5s", op: .32, b: "7px" }, { d: "3.7s", delay: "1s", op: .2, b: "12px" }, { d: "5s", delay: "1.7s", op: .1, b: "17px" }].map((p, i) => (
          <div key={i} className="pool-wave" style={{ "--d": p.d, "--delay": p.delay, "--op": p.op, bottom: p.b }} />
        ))}
      </div>
      <div className="heat">
        {[{ d: "3.5s", dl: "0s", op: .11, b: "2px" }, { d: "4.2s", dl: ".4s", op: .08, b: "12px" }, { d: "3.9s", dl: ".9s", op: .07, b: "22px" }, { d: "5.1s", dl: "1.5s", op: .05, b: "35px" }, { d: "4.6s", dl: "2.1s", op: .03, b: "52px" }].map((h, i) => (
          <div key={i} className="heat-wave" style={{ "--d": h.d, "--delay": h.dl, "--op": h.op, bottom: h.b }} />
        ))}
      </div>
      <div className="reflection">
        {[{ d: "4s", dl: "0s", op: .15, b: "2px" }, { d: "5.5s", dl: ".7s", op: .1, b: "9px" }, { d: "4.8s", dl: "1.4s", op: .06, b: "18px" }, { d: "6s", dl: "2s", op: .03, b: "28px" }].map((r, i) => (
          <div key={i} className="ref-band" style={{ "--d": r.d, "--delay": r.dl, "--op": r.op, bottom: r.b }} />
        ))}
      </div>
      <div className="scene-label sl-tl">Optical Illusion</div>
      <div className="scene-label sl-tr">Light · Bending</div>
      <div className="scene-label sl-horizon">— horizon —</div>
      <div className="scene-label sl-br">Desert · Mirage · 28.4°N</div>
      <div className="hero-fade" />
      <div className="hero-text">
        <div className="hero-headline">
          <h1 className="hero-title">
            Nothing<br />is what<br />
            <em data-text="it appears.">it appears.</em>
          </h1>
          <p className="hero-desc">Like a mirage on the horizon — synthetic media deceives the eye. Miraje sees through the distortion, revealing what is real and what was constructed.</p>
          <div className="hero-quote">
            <div className="hq-mark">"</div>
            <div className="hq-text">A mirage is not a lie. It is light, bending. Deepfakes are the same — truth, refracted through a machine.</div>
          </div>
        </div>

      </div>
      <div className="scroll-hint">
        <div className="sh-text">Scroll</div>
        <div className="sh-line" />
      </div>
    </div>

    {/* PAGE CONTENT */}
    <main>
      <div className="page">
        <div className="sec-head" style={{ marginBottom: 14 }}>Detection Mode</div>
        <div className="modes">
          {[
            { key: "image", code: "IMG //", name: "Image", desc: "AI-generated and manipulated photograph detection via GAN fingerprinting", flag: "Live" },
            { key: "video", code: "VID //", name: "Video", desc: "Frame-by-frame temporal coherence analysis for face swap and synthesis", flag: "Live" },
            { key: "audio", code: "AUD //", name: "Audio", desc: "Cloned voice and synthetic speech identification via spectral forensics", flag: "Beta" },
            { key: "signature", code: "SIG //", name: "Signature", desc: "Handwritten signature forgery detection using stroke dynamics analysis", flag: "Beta" },
          ].map(m => (
            <div key={m.key} className={`mode-tile${mode === m.key ? " active" : ""}`} onClick={() => handleSetMode(m.key)}>
              <div className={`mode-flag ${m.flag === "Live" ? "flag-live" : "flag-beta"}`}>{m.flag}</div>
              <div className="mode-code">{m.code}</div>
              <div className="mode-name">{m.name}</div>
              <div className="mode-desc">{m.desc}</div>
            </div>
          ))}
        </div>

        <div className="workspace">
          {/* DROP ZONE */}
          <div className="drop-zone" onDragOver={onDragOver} onDragLeave={() => { }} onDrop={onDrop} onClick={() => fileRef.current?.click()}>
            <div className="dc tl" /><div className="dc tr" /><div className="dc bl" /><div className="dc br" />
            {scanning && <div className="scan-beam" />}
            {previewSrc
              ? <img className="preview-img" src={previewSrc} alt="preview" />
              : audioSrc
                ? <div className="drop-inner">
                  <div className="drop-title">{fileName}</div>
                  <div className="drop-sub">{fileSize} MB — ready</div>
                  <audio
                    controls
                    src={audioSrc}
                    style={{
                      width: "100%",
                      marginTop: "16px",
                      accentColor: "var(--acc)",
                      filter: "invert(1) hue-rotate(180deg)"
                    }}
                  />
                </div>
                : <div className="drop-inner">
                  <div className="drop-mirage">
                    {[{ d: "0s", op: .7, t: "0" }, { d: ".4s", op: .42, t: "8px" }, { d: ".8s", op: .25, t: "16px" }, { d: "1.2s", op: .14, t: "24px" }, { d: "1.6s", op: .06, t: "32px" }].map((l, i) => (
                      <div key={i} className="dm-line" style={{ "--delay": l.d, opacity: l.op, top: l.t }} />
                    ))}
                  </div>
                  <div className="drop-title">{fileName ? fileName : "Submit for analysis"}</div>
                  <div className="drop-sub">{fileSize ? `${fileSize} MB — ready` : "Drag & drop your file here,\nor select from your device."}</div>
                  <div className="drop-fmts">{cfg.fmts.map(f => <span key={f} className="dfmt">{f}</span>)}</div>
                  <button className="drop-cta" onClick={e => { e.stopPropagation(); fileRef.current?.click() }}><span>Browse Files</span></button>
                </div>
            }
          </div>
          <input type="file" ref={fileRef} onChange={onFilePick} />

          {/* SIDEBAR */}
          <div className="sidebar">
            <div className="panel">
              <div className="panel-head">
                <div className="panel-label">Verdict</div>
                <div className="panel-status">
                  <div className="pulse-dot" style={{ width: 4, height: 4 }} />
                  <span>{analysing ? "Processing" : "Idle"}</span>
                </div>
              </div>
              <div className="verdict-body">
                <VerdictRing score={verdict.score} color={verdict.color} glow={verdict.glow} />
                <div className="verdict-word" style={{ color: verdict.color || "var(--pale)" }}>{verdict.word}</div>
                <div className="verdict-note">{verdict.note}</div>
              </div>
            </div>

            {pipelineVisible && (
              <div className="panel">
                <div className="panel-head"><div className="panel-label">Pipeline</div></div>
                <div className="pipe-body">
                  {pipelineSteps.map((s, i) => (
                    <div key={i} className={`pipe-step${s.state === "done" ? " done" : s.state === "running" ? " running" : ""}`}>
                      <div className={`pipe-mark${s.state === "done" ? " done" : s.state === "running" ? " active" : ""}`}>
                        {s.state === "done" ? "✓" : `0${i + 1}`}
                      </div>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="panel">
              <div className="panel-head"><div className="panel-label">Signal Analysis</div></div>
              <div className="metrics-body">
                {metrics.map((m, i) => (
                  <MetricBar key={i} name={m.n} color={m.c} value={m.value || 0} label={m.label || "—"} />
                ))}
              </div>
            </div>

            <button className="run-btn" disabled={!fileLoaded || analysing} onClick={runAnalysis}>
              <span>{!fileLoaded ? "No File Selected" : analysing ? "Analysing…" : "Initiate Analysis"}</span>
            </button>
          </div>
        </div>

        {/* RESULTS */}
        {results.length > 0 && (
          <div style={{ marginBottom: 44 }}>
            <div className="sec-head" style={{ marginBottom: 18 }}>Subsystem Results</div>
            <div className="results-grid">
              {results.map((r, i) => (
                <ResultCard key={i} {...r} mode={mode} visible={visibleScores.includes(i)} />
              ))}
            </div>
          </div>
        )}

        {/* HISTORY TABLE */}
        <div style={{ animation: "fadeUp .7s cubic-bezier(.22,1,.36,1) .4s both" }}>
          <div className="sec-head" style={{ marginBottom: 18 }}>Recent Cases</div>
          <div className="table-wrap">
            <div className="t-head"><div>File</div><div>Type</div><div>Verdict</div><div>Score</div><div>Timestamp</div></div>
            {history.length === 0
              ? <div style={{ padding: "20px", color: "var(--fog)", textAlign: "center" }}>No cases analysed yet</div>
              : history.map((r, i) => (
                <div key={i} className="t-row">
                  <div className="t-file"><div className="t-glyph">{r.glyph}</div><div><div className="t-fname">{r.name}</div><div className="t-fsize">{r.size}</div></div></div>
                  <div className="t-type">{r.type}</div>
                  <div><span className={`rc-verdict ${r.cls}`}>{r.lbl}</span></div>
                  <div className="t-conf" style={{ color: r.confClr }}>{r.conf}</div>
                  <div className="t-date">{r.date}</div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </main>
  </>
);
}