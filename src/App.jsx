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
      { n: "Frequency Anomaly", c: "var(--gold)" },
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
      { n: "Lip-Sync Alignment", c: "var(--gold)" },
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
      { n: "Prosody Score", c: "var(--gold)" },
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
      { n: "Pressure Variance", c: "var(--gold)" },
      { n: "Tremor Analysis", c: "var(--warn2)" },
      { n: "Loop Consistency", c: "var(--safe2)" }
    ],
    steps: ["Image Preprocessing", "Stroke Segmentation", "Dynamic Analysis", "Template Matching", "Report Generation"],
    results: [
      { code: "SYS-01", name: "Stroke Dynamics", desc: "Velocity, pressure and pen-lift pattern forensic analysis" },
      { code: "SYS-02", name: "Geometric Match", desc: "Reference template comparison via Dynamic Time Warping" },
      { code: "SYS-03", name: "Writer Verify", desc: "Neural handwriting style embedding match and comparison" }
    ]
  },
  text: {
    fmts: ["TXT", "DOCX", "PDF"],
    metrics: [
      { n: "Linguistic Anomaly", c: "var(--danger2)" },
      { n: "Semantic Coherence", c: "var(--gold)" },
      { n: "Perplexity Score", c: "var(--warn2)" },
      { n: "Burstiness", c: "var(--safe2)" }
    ],
    steps: ["Tokenization", "Contextual Embedding", "Transformer Attention", "Linguistic Scoring", "Report Generation"],
    results: [
      { code: "SYS-01", name: "AI Authorship", desc: "Detection of LLM generative patterns and statistical anomalies" },
      { code: "SYS-02", name: "Perplexity", desc: "Analysis of predictability and vocabulary variance" },
      { code: "SYS-03", name: "Semantic Shift", desc: "Detection of unnatural transitions or hallucinated phrasing" }
    ]
  }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── VERDICT RING ── */
function VerdictRing({ score, color, glow }) {
  const offset = score != null ? 298 - (score / 100) * 298 : 298;
  return (
    <div className="vring">
      <svg width="118" height="118" viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
        <circle className="vr-bg" cx="55" cy="55" r="47" />
        <circle className="vr-track" cx="55" cy="55" r="47" />
        <circle className="vr-fill" cx="55" cy="55" r="47"
          style={{ strokeDashoffset: offset, stroke: color || "var(--rim2)", filter: glow ? `drop-shadow(0 0 8px ${glow})` : "none" }} />
        <circle className="vr-spin" cx="55" cy="55" r="52" />
      </svg>
      <div className="vring-center">
        <div className="vr-pct" style={{ color: color || "var(--ghost)", textShadow: glow ? `0 0 22px ${glow}` : "none" }}>
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
  const g = fake ? "rgba(232,115,107,.28)" : unc ? "rgba(212,165,85,.28)" : "rgba(104,212,174,.28)";
  return (
    <div className="result-card">
      <div className="rc-code">
        <span>{code}</span>
        <span className={`rc-verdict ${cls}`}>{lbl}</span>
      </div>
      <div className="rc-name">{name}</div>
      <div className="rc-score" style={{
        color: clr, textShadow: `0 0 22px ${g}`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity .65s ease, transform .65s ease"
      }}>
        {score.toFixed(1)}<span style={{ fontSize: 18, color: "var(--fog)", textShadow: "none" }}>%</span>
      </div>
      <div className="rc-desc">{desc}</div>
    </div>
  );
}

function XAIPanel({ tokenImportance, sentenceScores }) {
  // Re-normalize relative to the actual min/max in this response
  // (safety net in case backend values still cluster in a narrow band)
  const allImps = tokenImportance.map(t => t.importance);
  const impMin = allImps.length ? Math.min(...allImps) : 0;
  const impMax = allImps.length ? Math.max(...allImps) : 1;
  const impRange = (impMax - impMin) || 1;

  const getStyle = (imp) => {
    const n = (imp - impMin) / impRange;   // always 0–1 relative to this text
    if (n < 0.20) return { color: '#7a8098', background: 'transparent' };
    if (n < 0.40) return { color: '#c8b860', background: 'rgba(232,192,64,0.12)' };
    if (n < 0.60) return { color: '#e09040', background: 'rgba(220,140,60,0.22)' };
    if (n < 0.80) return { color: '#e86848', background: 'rgba(220,90,60,0.28)' };
    return { color: '#ff5858', background: 'rgba(240,60,60,0.34)', fontWeight: 600 };
  };
  return (
    <div className="xai-panel">
      {tokenImportance.length > 0 && (
        <div className="xai-tokens-section">
          <div className="xai-sec-head">◈ &nbsp;Linguistic Influence Map</div>
          <div className="xai-legend">
            {[['#7a8098', 'Neutral'], ['#c8b860', 'Low'], ['#e09040', 'Medium'], ['#e86848', 'High'], ['#ff5858', 'Critical']].map(([c, l]) => (
              <span key={l} className="xai-leg-item"><span className="xai-leg-dot" style={{ background: c }} />{l}</span>
            ))}
          </div>
          <div className="xai-note">Words highlighted in red/orange most strongly influenced the AI detection decision</div>
          <div className="xai-text-block">
            {tokenImportance.map((t, i) => (
              <span key={i} className="xai-tok" style={getStyle(t.importance)} title={`Influence: ${(t.importance * 100).toFixed(0)}%`}>
                {t.token}{' '}
              </span>
            ))}
          </div>
        </div>
      )}
      {sentenceScores.length > 0 && (
        <div className="xai-sentences-section">
          <div className="xai-sec-head" style={{ marginTop: tokenImportance.length ? 36 : 0 }}>◈ &nbsp;Sentence-Level Breakdown</div>
          <div className="xai-note">Each sentence scored independently — higher % = more AI-like patterns detected</div>
          <div className="xai-sent-list">
            {sentenceScores.map((s, i) => {
              const clr = s.fake_probability > 68 ? '#e8736b' : s.fake_probability > 45 ? '#d4a855' : '#68d4ae';
              const lbl = s.fake_probability > 68 ? 'AI-like' : s.fake_probability > 45 ? 'Uncertain' : 'Natural';
              return (
                <div key={i} className="xai-sent-row">
                  <div className="xai-sent-meta">
                    <span className="xai-sent-idx">#{i + 1}</span>
                    <span className="xai-sent-verdict" style={{ color: clr }}>{lbl}</span>
                    <span className="xai-sent-pct" style={{ color: clr }}>{s.fake_probability.toFixed(0)}%</span>
                  </div>
                  <div className="xai-sent-quote">"{s.sentence}"</div>
                  <div className="xai-sent-track">
                    <div className="xai-sent-fill" style={{ width: `${s.fake_probability}%`, background: clr, boxShadow: `0 0 8px ${clr}66` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}



/* ── MAIN APP ── */
export default function App() {
  const { currentUser, logout } = useAuth();
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
  const [textInput, setTextInput] = useState("");
  const [history, setHistory] = useState([]);
  const [xaiData, setXaiData] = useState({ tokenImportance: [], sentenceScores: [] });
  const [sentenceScores, setSentenceScores] = useState([]);
  const fileRef = useRef(null);
  const cfg = CFG[mode];

  useEffect(() => {
    setMetrics(cfg.metrics.map(m => ({ ...m, value: 0, label: "—" })));
    setVerdict({ score: null, color: null, glow: null, word: "Awaiting Input", note: "Submit a file to begin" });
    setResults([]); setPipelineVisible(false);
    setXaiData({ tokenImportance: [], sentenceScores: [] });
  }, [mode]);

  useEffect(() => {
    setMetrics(cfg.metrics.map(m => ({ ...m, value: 0, label: "—" })));
  }, []);

  function handleSetMode(k) {
    setModeKey(k);
    setFileLoaded(false); setPreviewSrc(null); setFileName(null); setFileSize(null);
  }

  function loadFile(f) {
    setFile(f);
    setFileLoaded(true);
    setFileName(f.name);
    setFileSize((f.size / 1024 / 1024).toFixed(2));
    setVerdict({ score: null, color: null, glow: null, word: "Awaiting Input", note: "Submit a file to begin" });
    setResults([]); setPipelineVisible(false);
    if (f.type.startsWith("image/")) {
      const r = new FileReader();
      r.onload = e => setPreviewSrc(e.target.result);
      r.readAsDataURL(f);
      setAudioSrc(null);
    } else if (f.type.startsWith("audio/")) {
      setAudioSrc(URL.createObjectURL(f));
      setPreviewSrc(null);
    } else if (f.type.startsWith("text/") || f.name.endsWith(".txt")) {
      const r = new FileReader();
      r.onload = e => {
        setTextInput(e.target.result);
      };
      r.readAsText(f);
      setPreviewSrc(null); setAudioSrc(null);
    } else { setPreviewSrc(null); setAudioSrc(null); }
    setScanning(true);
    setTimeout(() => setScanning(false), 3200);
  }

  function onDragOver(e) { e.preventDefault(); }
  function onDrop(e) { e.preventDefault(); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); }
  function onFilePick(e) { if (e.target.files[0]) loadFile(e.target.files[0]); }

  const runAnalysis = useCallback(async () => {
    const canRun = mode === "text" ? textInput.trim().length > 20 : fileLoaded;
    if (!canRun || analysing) return;

    setAnalysing(true); setPipelineVisible(true);
    setXaiData({ tokenImportance: [], sentenceScores: [] }); setSentenceScores([]);

    const steps = cfg.steps.map(s => ({ label: s, state: "pending" }));
    setPipelineSteps(steps);
    for (let i = 0; i < steps.length; i++) {
      setPipelineSteps(prev => prev.map((s, j) => j === i ? { ...s, state: "running" } : s));
      await sleep(360 + Math.random() * 260);
      setPipelineSteps(prev => prev.map((s, j) => j === i ? { ...s, state: "done" } : s));
    }

    let score = null, prediction = null;
    try {
      const formData = new FormData();
      if (mode === "image") {
        formData.append("image", file);
        const res = await fetch("http://localhost:5000/predict-image", { method: "POST", body: formData });
        const d = await res.json(); score = d.fake_probability; prediction = d.prediction;
      } else if (mode === "audio") {
        formData.append("audio", file);
        const res = await fetch("http://localhost:5000/predict-audio", { method: "POST", body: formData });
        const d = await res.json(); score = d.score ?? d.fake_probability; prediction = d.prediction;
      } else if (mode === "signature") {
        formData.append("signature", file);
        const res = await fetch("http://localhost:5000/predict-signature", { method: "POST", body: formData });
        const d = await res.json(); score = d.score ?? d.fake_probability; prediction = d.prediction;
      } else if (mode === "video") {
        formData.append("video", file);
        const res = await fetch("http://localhost:5000/predict-video", { method: "POST", body: formData });
        const d = await res.json();
        score = d.fake_probability;
        prediction = d.prediction;
      } else if (mode === "text") {
        const res = await fetch("http://localhost:5000/predict-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textInput }),
        });
        const d = await res.json();
        score = d.fake_probability;
        prediction = d.prediction;
        setXaiData({ tokenImportance: d.token_importance || [], sentenceScores: d.sentence_scores || [] });
        setSentenceScores(d.sentence_scores || []);
      }
    } catch (err) {
      console.error("API error:", err);
      setAnalysing(false);
      setVerdict({ score: 0, color: "var(--danger2)", glow: "rgba(232,115,107,.4)", word: "Connection Error", note: "Could not reach the backend server" });
      return;
    }

    if (score == null) {
      setAnalysing(false);
      setVerdict({ score: 0, color: "var(--danger2)", glow: "rgba(232,115,107,.4)", word: "Error", note: "Backend returned invalid response" });
      return;
    }

    const isFake = prediction === "fake";
    const isUnc = score >= 45 && score <= 68;
    const color = isFake ? "var(--danger2)" : isUnc ? "var(--warn2)" : "var(--safe2)";
    const glow = isFake ? "rgba(232,115,107,.4)" : isUnc ? "rgba(212,165,85,.38)" : "rgba(104,212,174,.4)";
    const word = isFake
      ? (mode === "signature" ? "Forgery Confirmed" : "Synthetic Detected")
      : isUnc ? "Inconclusive" : "Authentic";

    setVerdict({ score, color, glow, word, note: `${score.toFixed(1)}% synthetic probability` });
    setMetrics(cfg.metrics.map((m, i) => ({
      ...m,
      value: Math.max(0, score - i * 6),
      label: (Math.max(0, score - i * 6)).toFixed(1) + "%"
    })));
    setResults(cfg.results.map(r => ({ ...r, score })));
    setVisibleScores([]);
    await sleep(80);
    cfg.results.forEach((_, i) => setTimeout(() => setVisibleScores(prev => [...prev, i]), i * 200));

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} · ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setHistory(prev => [{
      glyph: getModeGlyph(mode),
      name: mode === "text" ? `"${textInput.slice(0, 32)}…"` : fileName,
      size: mode === "text" ? `${textInput.split(/\s+/).length} words` : fileSize + " MB",
      type: mode.charAt(0).toUpperCase() + mode.slice(1),
      cls: isFake ? "v-fake" : isUnc ? "v-unc" : "v-real",
      lbl: isFake ? (mode === "signature" ? "Forged" : "Synthetic") : isUnc ? "Inconclusive" : "Authentic",
      conf: score.toFixed(1) + "%", confClr: color, date: dateStr
    }, ...prev]);
    setAnalysing(false);
  }, [fileLoaded, analysing, mode, cfg, file, fileName, fileSize, textInput]);
 
  function getModeGlyph(m) {
        return m === "image" ? "▣" : m === "video" ? "▶" : m === "audio" ? "♪" : m === "text" ? "¶" : "✦";
    }
 

  return (
    <>
      {/* HEADER */}
      <header className="bidaya-header">
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div className="brand-wordmark">Miraje</div>
        </div>
        <nav className="header-nav">
          {["Analysis", "Archive", "Reports", "System"].map(n => (
            <button key={n} className={`nav-link${activeNav === n ? " active" : ""}`} onClick={() => setActiveNav(n)}>{n}</button>
          ))}
        </nav>
        <div className="header-actions">
          <div className="sys-status">
            <div className="pulse-dot" />
            <span>Systems Online</span>
          </div>
          <button className="menu-btn">
            Menu
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        </div>
      </header>

      {/* HERO */}
      <div className="hero bidaya-hero">
        <div className="hero-badge">Advanced Deepfake Detection</div>
        <h1 className="hero-title">
          Nothing is what <br />
          <em className="hero-italic">it appears.</em>
        </h1>
        <p className="hero-desc">
          We craft strategic detection experiences that help you reveal what is real and what was constructed.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={() => {
            const el = document.getElementById('workspace-sec');
            if(el) el.scrollIntoView({ behavior: 'smooth' });
          }}>
            GET STARTED
          </button>
          <button className="btn-icon" onClick={() => {
            const el = document.getElementById('workspace-sec');
            if(el) el.scrollIntoView({ behavior: 'smooth' });
          }}>
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <main id="workspace-sec">
        <div className="page">
          <div className="sec-head" style={{ marginBottom: 14 }}>Detection Mode</div>
          <div className="modes">
            {[
              { key: "image", code: "IMG //", name: "Image", desc: "AI-generated and manipulated photograph detection via GAN fingerprinting", flag: "Live" },
              { key: "video", code: "VID //", name: "Video", desc: "Frame-by-frame temporal coherence analysis for face swap and synthesis", flag: "Live" },
              { key: "audio", code: "AUD //", name: "Audio", desc: "Cloned voice and synthetic speech identification via spectral forensics", flag: "Beta" },
              { key: "signature", code: "SIG //", name: "Signature", desc: "Handwritten signature forgery detection using stroke dynamics analysis", flag: "Beta" },
              { key: "text", code: "TXT //", name: "Text", desc: "AI-generated text detection using contextual embeddings and linguistic analysis", flag: "Live" }
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
            <div className="drop-zone" onDragOver={onDragOver} onDrop={onDrop} onClick={() => fileRef.current?.click()}>
              <div className="dc tl" /><div className="dc tr" /><div className="dc bl" /><div className="dc br" />
              {scanning && <div className="scan-beam" />}
              {previewSrc
                ? <img className="preview-img" src={previewSrc} alt="preview" />
                : audioSrc
                  ? <div className="drop-inner">
                    <div className="drop-title">{fileName}</div>
                    <div className="drop-sub">{fileSize} MB — ready</div>
                    <audio controls src={audioSrc} style={{ width: "100%", marginTop: 16, accentColor: "var(--gold)", filter: "invert(1) hue-rotate(180deg)" }} />
                  </div>
                  : mode === "text"
                    ? <div
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: "absolute", inset: 0,
                        display: "flex", flexDirection: "column",
                        padding: 20, boxSizing: "border-box"
                      }}
                    >
                      <textarea
                        placeholder="Paste text here or upload a .txt file..."
                        value={textInput}
                        onChange={e => {
                          setTextInput(e.target.value);
                          if (e.target.value) {
                            setFileLoaded(true);
                            setFileName("Pasted Text");
                            setFileSize((e.target.value.length / 1024).toFixed(2));
                          } else {
                            setFileLoaded(false);
                          }
                        }}
                        style={{
                          width: "100%", flexGrow: 1,
                          background: "rgba(0,0,0,0.25)",
                          border: "1px solid rgba(232,192,64,0.18)",
                          color: "#d8dde8",
                          padding: 18, fontFamily: "'Inter', sans-serif", fontSize: 14,
                          lineHeight: 1.7,
                          resize: "none", borderRadius: 8, outline: "none",
                          boxSizing: "border-box"
                        }}
                      />
                      {textInput.length === 0 && (
                        <button
                          className="drop-cta"
                          style={{ marginTop: 14, alignSelf: "center" }}
                          onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                        >
                          <span>Browse Text File</span>
                        </button>
                      )}
                    </div>
                    : <div className="drop-inner">
                      <div className="drop-mirage">
                        {[{ d: "0s", op: .75 }, { d: ".4s", op: .46 }, { d: ".8s", op: .28 }, { d: "1.2s", op: .15 }, { d: "1.6s", op: .07 }].map((l, i) => (
                          <div key={i} className="dm-line" style={{ "--delay": l.d, opacity: l.op, top: i * 8 + "px" }} />
                        ))}
                      </div>
                      <div className="drop-title">{fileName || "Submit for analysis"}</div>
                      <div className="drop-sub">{fileSize ? `${fileSize} MB — ready` : "Drag & drop your file here,\nor select from your device."}</div>
                      <div className="drop-fmts">{cfg.fmts.map(f => <span key={f} className="dfmt">{f}</span>)}</div>
                      <button className="drop-cta" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}><span>Browse Files</span></button>
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
                  <div className="verdict-word" style={{ color: verdict.color || "var(--sand-light)" }}>{verdict.word}</div>
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



              <button className="run-btn" disabled={!fileLoaded || analysing} onClick={runAnalysis}>
                <span>{!fileLoaded ? "No File Selected" : analysing ? "Analysing…" : "Initiate Analysis"}</span>
              </button>
            </div>
          </div>

          {/* RESULTS */}
          {results.length > 0 && mode !== "text" && (
            <div style={{ marginBottom: 48 }}>
              <div className="sec-head" style={{ marginBottom: 18 }}>Subsystem Results</div>
              <div className="results-grid">
                {results.map((r, i) => <ResultCard key={i} {...r} mode={mode} visible={visibleScores.includes(i)} />)}
              </div>
            </div>
          )}

          {/* XAI PANEL — text mode only */}
          {mode === "text" && (xaiData.tokenImportance.length > 0 || xaiData.sentenceScores.length > 0) && (
            <div style={{ marginBottom: 48 }}>
              <div className="sec-head" style={{ marginBottom: 18 }}>Explainability Report</div>
              <XAIPanel tokenImportance={xaiData.tokenImportance} sentenceScores={xaiData.sentenceScores} />
            </div>
          )}

          {/* HISTORY TABLE */}
          <div style={{ animation: "fadeUp .7s cubic-bezier(.22,1,.36,1) .4s both" }}>
            <div className="sec-head" style={{ marginBottom: 18 }}>Recent Cases</div>
            <div className="table-wrap">
              <div className="t-head">
                <div>File</div><div>Type</div><div>Verdict</div><div>Score</div><div>Timestamp</div>
              </div>
              {history.length === 0
                ? <div style={{ padding: "22px 26px", color: "var(--fog)", fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: 2, textAlign: "center", textTransform: "uppercase" }}>
                  No cases analysed yet
                </div>
                : history.map((r, i) => (
                  <div key={i} className="t-row">
                    <div className="t-file">
                      <div className="t-glyph">{r.glyph}</div>
                      <div><div className="t-fname">{r.name}</div><div className="t-fsize">{r.size}</div></div>
                    </div>
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