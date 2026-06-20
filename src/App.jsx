import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import './Miraje.css';
import { useAuth } from './AuthContext';
import AuthPage from './AuthPage';
import imgModuleImg from './assets/modules/image_module.png';
import vidModuleImg from './assets/modules/video_module.png';
import audModuleImg from './assets/modules/audio_module.png';
import sigModuleImg from './assets/modules/signature_module.png';
import txtModuleImg from './assets/modules/text_module.png';
import WheelCarousel from "./WheelCarousel";
import AllWorksButton from "./Allworksbutton";
import WorksPage from "./Workspage";
/* ── DATA CONFIG ── */
const CFG = {
  image: {
    fmts: ["JPG", "PNG", "WEBP", "GIF", "BMP", "TIFF"],
    steps: ["Preprocessing", "Feature Extraction", "Vision Transformer", "CNN Layer", "Report Generation"],
    results: [
      { code: "SYS-01", name: "Face Analysis", desc: "Landmark geometry, eye blink patterns & skin texture synthesis markers" },
      { code: "SYS-02", name: "Frequency Domain", desc: "DCT & Fourier transform artifact detection in latent space" },
      { code: "SYS-03", name: "Texture Forensics", desc: "Pixel-level GAN fingerprint extraction and classification" },
    ],
  },
  video: {
    fmts: ["MP4", "MOV", "AVI", "MKV", "WEBM"],
    steps: ["MTCNN Face detection", "Spatial Temporal Stream", "EfficientNet-B4", "BiLSTM", "Report Generation"],
    results: [
      { code: "SYS-01", name: "Face Swap", desc: "Inter-frame face boundary and blending artifacts across sequence" },
      { code: "SYS-02", name: "Lip Sync", desc: "Audio-visual alignment consistency and phoneme mapping" },
      { code: "SYS-03", name: "Motion Flow", desc: "Optical flow coherence and unnatural motion detection" },
    ],
  },
  audio: {
    fmts: ["WAV", "MP3", "FLAC", "OGG", "M4A", "AAC"],
    steps: ["Training Discriminator", "Convolutional Layers", "LSTM", "Report Generation"],
    results: [
      { code: "SYS-01", name: "Voice Cloning", desc: "Latent voice embedding similarity and TTS artifact identification" },
      { code: "SYS-02", name: "Spectrogram", desc: "MFCC deviation and spectral synthesis marker detection" },
      { code: "SYS-03", name: "Prosody & Rhythm", desc: "Unnatural stress, pacing and breathing pattern analysis" },
    ],
  },
  signature: {
    fmts: ["JPG", "PNG", "PDF", "TIFF", "BMP"],
    steps: ["Image Preprocessing", "EfficientNet-B0", "channel-wise attention", "Template Matching", "Report Generation"],
    results: [
      { code: "SYS-01", name: "Stroke Dynamics", desc: "Velocity, pressure and pen-lift pattern forensic analysis" },
      { code: "SYS-02", name: "Geometric Match", desc: "Reference template comparison via Dynamic Time Warping" },
      { code: "SYS-03", name: "Writer Verify", desc: "Neural handwriting style embedding match and comparison" },
    ],
  },
  text: {
    fmts: ["TXT"],
    steps: ["Tokenization", "RoBERTa & Linguistic Hybird", "Classification", "Report Generation"],
    results: [
      { code: "SYS-01", name: "AI Authorship", desc: "Detection of LLM generative patterns and statistical anomalies" },
      { code: "SYS-02", name: "Perplexity", desc: "Analysis of predictability and vocabulary variance" },
      { code: "SYS-03", name: "Semantic Shift", desc: "Detection of unnatural transitions or hallucinated phrasing" },
    ],
  },
};

const DETECTION_SERVICES = [
  { key: "image", name: "Visual Forgery Detection", sub: "Vision Transformer · GAN Fingerprinting", flag: "Live" },
  { key: "video", name: "Deepfake Video Analysis", sub: "EfficientNet-B4 · BiLSTM Temporal Analysis", flag: "Live" },
  { key: "audio", name: "Synthetic Voice Identification", sub: "MFCC Spectral Analysis · Voice Cloning Detection", flag: "Beta" },
  { key: "signature", name: "Signature Forgery Forensics", sub: "EfficientNet-B0 · Template Matching", flag: "Beta" },
  { key: "text", name: "AI-Authored Text Detection", sub: "RoBERTa · Linguistic Hybrid Analysis", flag: "Live" },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getModeGlyph(m) {
  return m === "image" ? "▣" : m === "video" ? "▶" : m === "audio" ? "♪" : m === "text" ? "¶" : "✦";
}

/* ── VERDICT RING ── */
function VerdictRing({ score, color, glow }) {
  const offset = score != null ? 298 - (score / 100) * 298 : 298;
  return (
    <div className="vring">
      <svg width="118" height="118" viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
        <circle className="vr-bg" cx="55" cy="55" r="47" />
        <circle className="vr-track" cx="55" cy="55" r="47" />
        <circle className="vr-fill" cx="55" cy="55" r="47"
          style={{ strokeDashoffset: offset, stroke: color || "var(--cream-30)", filter: glow ? `drop-shadow(0 0 8px ${glow})` : "none" }} />
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

/* ── RESULT CARD ── */
function ResultCard({ code, name, desc, score, mode, visible }) {
  const fake = score > 68;
  const unc = score >= 45 && score <= 68;
  const cls = fake ? "v-fake" : unc ? "v-unc" : "v-real";
  const lbl = fake ? (mode === "signature" ? "Forged" : "Synthetic") : unc ? "Inconclusive" : "Authentic";
  const clr = fake ? "var(--danger2)" : unc ? "var(--warn2)" : "var(--safe2)";
  const g = fake ? "rgba(239,68,68,.25)" : unc ? "rgba(212,165,85,.25)" : "rgba(74,222,128,.25)";
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
        transition: "opacity .65s ease, transform .65s ease",
      }}>
        {score.toFixed(1)}<span style={{ fontSize: 18, color: "var(--fog)", textShadow: "none" }}>%</span>
      </div>
      <div className="rc-desc">{desc}</div>
    </div>
  );
}

/* ── XAI PANEL (text mode) ── */
function XAIPanel({ tokenImportance, sentenceScores }) {
  const allImps = tokenImportance.map(t => t.importance);
  const impMin = allImps.length ? Math.min(...allImps) : 0;
  const impMax = allImps.length ? Math.max(...allImps) : 1;
  const impRange = (impMax - impMin) || 1;

  const getStyle = imp => {
    const n = (imp - impMin) / impRange; // 0 = lowest influence, 1 = highest
    // Color scale: low → green (#4ade80), mid → amber (#fbbf24), high → red (#ef4444)
    let r, g, b;
    if (n < 0.5) {
      // green → amber
      const t = n / 0.5;
      r = Math.round(74  + (251 - 74)  * t);
      g = Math.round(222 + (191 - 222) * t);
      b = Math.round(128 + (36  - 128) * t);
    } else {
      // amber → red
      const t = (n - 0.5) / 0.5;
      r = Math.round(251 + (239 - 251) * t);
      g = Math.round(191 + (68  - 191) * t);
      b = Math.round(36  + (68  - 36)  * t);
    }
    const alpha = 0.12 + n * 0.38; // background opacity: subtle for low, vivid for high
    return {
      background: `rgba(${r},${g},${b},${alpha})`,
      color: n > 0.45 ? `rgb(${r},${g},${b})` : 'rgba(250,250,250,0.55)',
      borderRadius: 3,
      padding: '1px 2px',
      transition: 'background 0.2s',
    };
  };

  return (
    <div className="xai-panel">
      {tokenImportance.length > 0 && (
        <div className="xai-tokens-section">
          <div className="xai-sec-head">Linguistic Influence Map</div>
          <div className="xai-note">
            Darker shading indicates words that more strongly influenced the classification.
          </div>
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
          <div className="xai-sec-head" style={{ marginTop: tokenImportance.length ? 36 : 0 }}>Sentence-Level Breakdown</div>
          <div className="xai-note">Each sentence is scored independently for likelihood of AI generation.</div>
          <div className="xai-sent-list">
            {sentenceScores.map((s, i) => {
              const lbl = s.fake_probability > 68 ? 'AI-like' : s.fake_probability > 45 ? 'Uncertain' : 'Natural';
              const vClass = s.fake_probability > 68 ? 'xai-v-ai' : s.fake_probability > 45 ? 'xai-v-unc' : 'xai-v-nat';
              return (
                <div key={i} className="xai-sent-row">
                  <div className="xai-sent-meta">
                    <span className="xai-sent-idx">{String(i + 1).padStart(2, '0')}</span>
                    <span className={`xai-sent-verdict ${vClass}`}>{lbl}</span>
                    <span className="xai-sent-pct">{s.fake_probability.toFixed(0)}%</span>
                  </div>
                  <div className="xai-sent-quote">{s.sentence}</div>
                  <div className="xai-sent-track">
                    <div className={`xai-sent-fill ${vClass}`} style={{ width: `${s.fake_probability}%` }} />
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

/* ── SERVICE ROW ── */
function ServiceRow({ service, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={`?mode=${service.key}`}
      className={`svc-row${hovered ? " hovered" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="svc-row-left">
        <span className="svc-row-name">{service.name}</span>
        <span className="svc-row-sub">{service.sub}</span>
      </div>
      <div className="svc-row-right">
        <div className="svc-arrow-wrap">
          <svg
            viewBox="0 0 24 24" width="28" height="28"
            stroke="currentColor" strokeWidth="1.5" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
            className="svc-arrow-icon"
            style={{
              transform: hovered ? "rotate(45deg)" : "rotate(0deg)",
              transition: "transform .35s cubic-bezier(.22,1,.36,1)",
            }}
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>
    </a>
  );
}

/* ── FOOTER  ── */
const CAROUSEL_IMAGES = [
  "https://framerusercontent.com/images/fr3tcuvrhcc92fVb42dWaZgMiY0.png",
  "https://framerusercontent.com/images/s1S9fPZ18MTx8XwZarkezh4Bk.png",
  "https://framerusercontent.com/images/v60krc4Q1kxdiaOdGzy14IKqJw.png",
  "https://framerusercontent.com/images/TWOqDfYTYLpmjpIpzH23KjDxJmA.png",
  "https://framerusercontent.com/images/VhISKNWI9OBLHkvGRYnKNtRakM.png",
  "https://framerusercontent.com/images/EKOgTR9G2g6XvBP7MM3OTP1Ubo.png",
  "https://framerusercontent.com/images/qvHVjBQ3YMUybtpO7OOKQOKHNA.png",
  "https://framerusercontent.com/images/TB7DyRCNPXNMXOqT2fzIVSHG62Q.png",
];

const HEIGHTS = [300, 200, 320, 190, 280, 210, 300, 180, 290, 205];

const ITEMS = [...CAROUSEL_IMAGES, ...CAROUSEL_IMAGES];



function FooterCarousel() {
  const trackRef = useRef(null);
  const rafRef = useRef(null);
  const posRef = useRef(0);
  const pauseRef = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const tick = () => {
      if (!pauseRef.current) {
        posRef.current += 0.9;
        const half = track.scrollWidth / 2;
        if (posRef.current >= half) posRef.current -= half;
        track.style.transform = `translateX(-${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      className="fc-viewport"
      onMouseEnter={() => { pauseRef.current = true; }}
      onMouseLeave={() => { pauseRef.current = false; }}
    >
      <div className="fc-track" ref={trackRef}>
        {ITEMS.map((src, i) => {
          const h = HEIGHTS[i % HEIGHTS.length];
          return (
            <div
              key={i}
              className="fc-item"
              style={{ height: h }}
            >
              <img src={src} alt="" loading="lazy" draggable={false} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">

      <div className="footer-cta-strip">
        <p className="footer-cta-text">
          Let Miraje reveal<br />
          <em>what's really there.</em>
        </p>
      </div>

      <FooterCarousel />

      <div className="footer-rule" />

      <div className="footer-top">

        <div className="footer-col">
          <div className="footer-col-label">Navigate</div>
          <a href="/#about-section" className="footer-link">About</a>
          <a href="/" className="footer-link">Detection Modules</a>
          <a href="/?mode=image" className="footer-link">Image Analysis</a>
          <a href="/?mode=video" className="footer-link">Video Analysis</a>
          <a href="/?mode=text" className="footer-link">Text Analysis</a>
        </div>

        <div className="footer-col">
          <div className="footer-col-label">Modules</div>
          <a href="/?mode=image" className="footer-link">Visual Forgery</a>
          <a href="/?mode=video" className="footer-link">Deepfake Video</a>
          <a href="/?mode=audio" className="footer-link">Synthetic Voice</a>
          <a href="/?mode=signature" className="footer-link">Signature Forensics</a>
          <a href="/?mode=text" className="footer-link">AI Text Detection</a>
        </div>

        <div className="footer-col">
          <div className="footer-col-label">Contact</div>
          <a href="mailto:hello@miraje.ai" className="footer-link">hello@miraje.ai</a>
          <span className="footer-link">+1 812 3456 7890</span>
          <span className="footer-link">Cairo, Egypt</span>
        </div>

        <div className="footer-col">
          <div className="footer-col-label">Newsletter</div>
          <p className="footer-newsletter-desc">
            Get forensic insights, detection updates, and research delivered to your inbox.
          </p>
          <div className="footer-newsletter-form">
            <input
              type="email"
              placeholder="Fill your email address"
              className="footer-newsletter-input"
            />
            <button className="footer-newsletter-btn" aria-label="Subscribe">↗</button>
          </div>
        </div>

      </div>

      <div className="footer-bottom">
        <span>© 2025 Miraje — All rights reserved</span>
        <span className="footer-bottom-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <em>Miraje</em>
        </span>
      </div>

    </footer>
  );
}


function StampOverlay({ verdict, mode }) {
  if (!verdict || verdict.score == null) return null;

  const isFake = verdict.word === "Synthetic Detected" || verdict.word === "Forgery Confirmed";
  const isUnc = verdict.word === "Inconclusive";

  const color = isFake ? "#ef4444" : isUnc ? "#facc15" : "#4ade80";
  const topText = isFake ? "SYNTHETIC MEDIA" : isUnc ? "UNVERIFIED MEDIA" : "VERIFIED MEDIA";
  const mainText = isFake
    ? (mode === "signature" ? "FORGED" : "FAKE")
    : isUnc ? "INCONCLUSIVE" : "AUTHENTIC";
  const slash = isFake;

  const dots = Array.from({ length: 34 }, (_, i) => {
    const angle = (i / 34) * 2 * Math.PI - Math.PI / 2;
    return { cx: 80 + 73 * Math.cos(angle), cy: 80 + 73 * Math.sin(angle) };
  });

  return (
    <div style={{
      position: "absolute",
      bottom: 28,
      right: 36,
      pointerEvents: "none",
      zIndex: 10,
      animation: "stampIn 0.45s cubic-bezier(.17,.67,.35,1.3) forwards",
    }}>
      <svg width="170" height="170" viewBox="0 0 160 160">
        <defs>
          <style>{`@keyframes stampIn { from { transform: scale(2.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
        </defs>
        <g opacity="0.93">
          <circle cx="80" cy="80" r="72" fill="none" stroke={color} strokeWidth="3.5" />
          <circle cx="80" cy="80" r="64" fill="none" stroke={color} strokeWidth="1.2" />
          {dots.map((d, i) => <circle key={i} cx={d.cx} cy={d.cy} r="2.2" fill={color} />)}
          {slash && (
            <line x1="24" y1="56" x2="136" y2="104" stroke={color} strokeWidth="4.5" strokeLinecap="round" opacity="0.65" />
          )}
          <path id={`arc-top-${mode}`} d="M 26,80 A 54,54 0 0 1 134,80" fill="none" />
          <text fontFamily="Inter,sans-serif" fontSize="11" fontWeight="600" fill={color} letterSpacing="3">
            <textPath href={`#arc-top-${mode}`} startOffset="50%" textAnchor="middle">{topText}</textPath>
          </text>
          <text x="80" y="78" textAnchor="middle" fontFamily="Inter,sans-serif"
            fontSize={mainText.length > 9 ? "13" : "20"} fontWeight="700" fill={color} letterSpacing="1.5">
            {mainText}
          </text>
          {["46", "56", "66"].map((x, i) => (
            <text key={i} x={[50, 80, 110][i]} y="94" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={color}>★</text>
          ))}
          <path id={`arc-bot-${mode}`} d="M 26,80 A 54,54 0 0 0 134,80" fill="none" />
          <text fontFamily="Inter,sans-serif" fontSize="10" fontWeight="500" fill={color} letterSpacing="2.5" opacity="0.85">
            <textPath href={`#arc-bot-${mode}`} startOffset="50%" textAnchor="middle">MIRAJE · AI FORENSICS</textPath>
          </text>
        </g>
      </svg>
    </div>
  );
}

function ArchiveRow({ r, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isFake = r.cls === "v-fake";
  const isUnc = r.cls === "v-unc";

  const palette = isFake
    ? { accent: "#ef4444", accentBg: "rgba(239,68,68,0.10)" }
    : isUnc
      ? { accent: "#d4a855", accentBg: "rgba(212,165,85,0.10)" }
      : { accent: "#4ade80", accentBg: "rgba(74,222,128,0.10)" };

  return (
    <div
      onClick={() => setExpanded(p => !p)}
      style={{
        background: "rgba(250,250,250,0.03)",
        border: "1px solid rgba(250,250,250,0.08)",
        borderLeft: `3px solid ${palette.accent}`,
        borderRadius: 8,
        overflow: "hidden",
        transition: "background 0.2s, opacity 0.2s",
        cursor: "pointer",
        marginBottom: 4,
        opacity: deleting ? 0.4 : 1,
      }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(250,250,250,0.06)"}
      onMouseLeave={e => e.currentTarget.style.background = "rgba(250,250,250,0.03)"}
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 80px 120px 90px 150px 32px 32px",
        alignItems: "center",
        padding: "16px 20px",
        gap: 12,
      }}>

        {/* File */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 6,
            background: "rgba(250,250,250,0.05)",
            border: "1px solid rgba(250,250,250,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, color: "rgba(250,250,250,0.4)", flexShrink: 0,
          }}>{r.glyph}</div>
          <div>
            <div style={{
              fontFamily: "'Be Vietnam Pro', sans-serif",
              fontSize: 14, fontWeight: 500,
              color: "rgba(250,250,250,0.85)",
              letterSpacing: "-0.01em", lineHeight: 1.3,
            }}>{r.name}</div>
            <div style={{
              fontFamily: "'Inter', monospace", fontSize: 11,
              color: "rgba(250,250,250,0.3)", marginTop: 2,
            }}>{r.size}</div>
          </div>
        </div>

        {/* Type */}
        <div style={{
          fontFamily: "'Inter', monospace", fontSize: 10,
          color: "rgba(250,250,250,0.35)", letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>{r.type}</div>

        {/* Verdict badge */}
        <div>
          <span style={{
            fontSize: 10, padding: "4px 10px", borderRadius: 4,
            fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            color: palette.accent,
            background: palette.accentBg,
            border: `1px solid ${palette.accent}30`,
          }}>
            {r.lbl}
          </span>
        </div>

        {/* Score */}
        <div style={{
          fontFamily: "'Be Vietnam Pro', sans-serif",
          fontSize: 20, fontWeight: 400,
          color: palette.accent,
          letterSpacing: "-0.02em",
        }}>{r.conf}</div>

        {/* Timestamp */}
        <div style={{
          fontFamily: "'Inter', monospace", fontSize: 10,
          color: "rgba(250,250,250,0.25)", letterSpacing: "0.02em",
        }}>{r.date}</div>

        {/* Expand chevron */}
        <div style={{
          color: "rgba(250,250,250,0.25)", fontSize: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.25s",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
        }}>↓</div>

        {/* Delete button */}
        <div
          onClick={async e => {
            e.stopPropagation();
            if (deleting || !r.id) return;
            setDeleting(true);
            await onDelete(r.id);
          }}
          title="Remove from archive"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: 5, cursor: "pointer",
            color: "rgba(250,250,250,0.2)",
            transition: "color 0.2s, background 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(250,250,250,0.2)"; e.currentTarget.style.background = "transparent"; }}
        >
          ✕
        </div>
      </div>

      {/* Expandable panel */}
      {expanded && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            borderTop: "1px solid rgba(250,250,250,0.06)",
            background: "rgba(250,250,250,0.02)",
          }}
        >
          {r.explanation ? (
            <div style={{ padding: "16px 20px 18px 68px" }}>
              <div style={{
                fontFamily: "'Inter', monospace", fontSize: 10,
                letterSpacing: "0.12em", textTransform: "uppercase",
                color: "rgba(250,250,250,0.35)", marginBottom: 10,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span>◈</span> AI Forensic Analyst
              </div>
              <div style={{
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontSize: 13, color: "rgba(250,250,250,0.65)",
                lineHeight: 1.85, whiteSpace: "pre-wrap",
              }}>
                {r.explanation}
              </div>
            </div>
          ) : (
            <div style={{ padding: "14px 20px 14px 68px" }}>
              <div style={{
                fontFamily: "'Inter', monospace", fontSize: 10,
                color: "rgba(250,250,250,0.2)", letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}>
                No AI explanation available for this case
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
/* ── MAIN APP ── */
export default function App() {
  const { currentUser, logout } = useAuth();

  const pathname = window.location.pathname;

  if (pathname === "/works") {
    return <WorksPage />;
  }

  const [initialMode] = useState(() => new URLSearchParams(window.location.search).get('mode'));
  const [mode, setModeKey] = useState(initialMode || "image");
  const [fileLoaded, setFileLoaded] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState([]);
  const [pipelineVisible, setPipelineVisible] = useState(false);
  const [verdict, setVerdict] = useState({ score: null, color: null, glow: null, word: "Awaiting Input", note: "Submit a file to begin" });
  const [results, setResults] = useState([]);
  const [visibleScores, setVisibleScores] = useState([]);
  const [activeNav, setActiveNav] = useState("Analysis");
  const [audioSrc, setAudioSrc] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [history, setHistory] = useState([]);
  const [archive, setArchive] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [addedToArchive, setAddedToArchive] = useState(false);
  const [xaiData, setXaiData] = useState({ tokenImportance: [], sentenceScores: [] });
  const [gradcam, setGradcam] = useState(null);   // ← GradCAM heatmap (base64 PNG)
  const [referenceFile, setReferenceFile] = useState(null);
  const [referenceSrc, setReferenceSrc] = useState(null);
  const referenceRef = useRef(null);
  const [geminiExplanation, setGeminiExplanation] = useState(null);
  const [xaiOpen, setXaiOpen] = useState(false);

  const fileRef = useRef(null);
  const cfg = CFG[mode];
  const aboutRef = useRef(null);


  const loadArchive = useCallback(async () => {
    if (!currentUser) return;
    setArchiveLoading(true);
    try {
      const q = query(
        collection(db, "users", currentUser.uid, "archive"),
        orderBy("timestamp", "desc")
      );
      const snap = await getDocs(q);
      setArchive(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Failed to load archive:", e);
    } finally {
      setArchiveLoading(false);
    }
  }, [currentUser]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "archive", id));
      setArchive(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }, [currentUser]);
  useEffect(() => { loadArchive(); }, [loadArchive]);

  const addToArchive = useCallback(async () => {
    if (!currentUser || verdict.score == null) return;
    const now = new Date();
    const entry = {
      glyph: getModeGlyph(mode),
      name: mode === "text" ? `"${textInput.slice(0, 32)}…"` : fileName,
      size: mode === "text" ? `${textInput.split(/\s+/).length} words` : fileSize + " MB",
      type: mode.charAt(0).toUpperCase() + mode.slice(1),
      cls: verdict.color === "var(--danger2)" ? "v-fake"
        : verdict.color === "var(--warn2)" ? "v-unc" : "v-real",
      lbl: verdict.word === "Forgery Confirmed" ? "Forged"
        : verdict.word === "Synthetic Detected" ? "Synthetic"
          : verdict.word === "Inconclusive" ? "Inconclusive" : "Authentic",
      conf: verdict.score.toFixed(1) + "%",
      confClr: verdict.color,
      timestamp: now.toISOString(),
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} · ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      explanation: geminiExplanation || null,
    };
    try {
      await addDoc(collection(db, "users", currentUser.uid, "archive"), entry);
      setArchive(prev => [entry, ...prev]);
      setAddedToArchive(true);
      setTimeout(() => setAddedToArchive(false), 3000);
    } catch (e) {
      console.error("Failed to save to archive:", e);
    }
  }, [currentUser, verdict, mode, textInput, fileName, fileSize]);

  // Reset all result state when mode changes
  useEffect(() => {
    setVerdict({ score: null, color: null, glow: null, word: "Awaiting Input", note: "Submit a file to begin" });
    setResults([]);
    setPipelineVisible(false);
    setXaiData({ tokenImportance: [], sentenceScores: [] });
    setGradcam(null);   // ← reset GradCAM on mode switch
    setReferenceFile(null);
    setReferenceSrc(null);
    setGeminiExplanation(null);
    setAddedToArchive(false);
    setXaiOpen(false);
  }, [mode]);
  /* About word-reveal animation — only fires scrolling down */
  useEffect(() => {
    if (!aboutRef.current) return;
    let prevY = window.scrollY;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!aboutRef.current) return;
        const words = aboutRef.current.querySelectorAll('.about-word');
        const scrollingDown = window.scrollY >= prevY;
        prevY = window.scrollY;
        if (entry.isIntersecting && scrollingDown) {
          words.forEach(w => { w.style.animation = 'none'; w.style.opacity = '0'; });
          void aboutRef.current.offsetHeight;
          words.forEach(w => { w.style.animation = ''; w.style.animationPlayState = 'running'; });
        } else if (!entry.isIntersecting && !scrollingDown) {
          words.forEach(w => { w.style.animation = 'none'; w.style.opacity = '0'; });
        }
      },
      { threshold: 0 }
    );
    obs.observe(aboutRef.current);
    const onScroll = () => { prevY = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { obs.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  function loadFile(f) {
    setFile(f);
    setFileLoaded(true);
    setFileName(f.name);
    setFileSize((f.size / 1024 / 1024).toFixed(2));
    setVerdict({ score: null, color: null, glow: null, word: "Awaiting Input", note: "Submit a file to begin" });
    setResults([]);
    setPipelineVisible(false);
    setGradcam(null);   // ← reset GradCAM on new file
    setGeminiExplanation(null);

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
      r.onload = e => setTextInput(e.target.result);
      r.readAsText(f);
      setPreviewSrc(null);
      setAudioSrc(null);
    } else if (f.type.startsWith("video/")) {
      setPreviewSrc(URL.createObjectURL(f));
      setAudioSrc(null);
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

  const runAnalysis = useCallback(async () => {
    const canRun = mode === "text" ? textInput.trim().length > 20 : fileLoaded;
    if (!canRun || analysing) return;

    setAnalysing(true);
    setPipelineVisible(true);
    setXaiData({ tokenImportance: [], sentenceScores: [] });
    setGradcam(null);
    setGeminiExplanation(null);

    const steps = cfg.steps.map(s => ({ label: s, state: "pending" }));
    setPipelineSteps(steps);
    for (let i = 0; i < steps.length; i++) {
      setPipelineSteps(prev => prev.map((s, j) => j === i ? { ...s, state: "running" } : s));
      await sleep(360 + Math.random() * 260);
      setPipelineSteps(prev => prev.map((s, j) => j === i ? { ...s, state: "done" } : s));
    }

    let score = null, prediction = null;
    let explanationText = null;   // ← single variable shared across all branches

    try {
      const formData = new FormData();

      if (mode === "image") {
        formData.append("image", file);
        const res = await fetch(`${API}/predict-image-v2`, { method: "POST", body: formData });
        const d = await res.json();
        score = d.fake_probability;
        prediction = d.prediction;
        setGradcam(d.gradcam || null);
        if (d.gradcam) {
          const explainRes = await fetch(`${API}/explain-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prediction: d.prediction,
              fake_probability: d.fake_probability,
              real_probability: d.real_probability,
              gradcam: d.gradcam,
            }),
          });
          const explainData = await explainRes.json();
          explanationText = explainData.explanation || null;   // ← capture locally
          setGeminiExplanation(explanationText);
        }

      } else if (mode === "audio") {
        formData.append("audio", file);
        const res = await fetch(`${API}/predict-audio`, { method: "POST", body: formData });
        const d = await res.json();
        score = d.score ?? d.fake_probability;
        prediction = d.prediction;
        // audio has no explanation endpoint, explanationText stays null

      } else if (mode === "signature") {
        formData.append("signature", file);
        formData.append("reference", referenceFile);
        const res = await fetch(`${API}/predict-signature`, { method: "POST", body: formData });
        const d = await res.json();
        score = d.fake_probability;
        prediction = d.prediction;
        setGradcam(d.gradcam || null);
        if (d.gradcam) {
          const explainRes = await fetch(`${API}/explain-signature`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prediction: d.prediction,
              fake_probability: d.fake_probability,
              real_probability: d.real_probability,
              gradcam: d.gradcam,
            }),
          });
          const explainData = await explainRes.json();
          explanationText = explainData.explanation || null;   // ← capture locally
          setGeminiExplanation(explanationText);
        }

      } else if (mode === "video") {
        formData.append("video", file);
        const res = await fetch(`${API}/predict-video`, { method: "POST", body: formData });
        const d = await res.json();
        score = d.fake_probability;
        prediction = d.prediction;
        setGradcam(d.gradcam || null);
        setXaiData({
          tokenImportance: [],
          sentenceScores: (d.frame_scores || []).map((s, i) => ({
            sentence: `Frame ${i + 1}`,
            fake_probability: s,
          })),
        });
        if (d.gradcam) {
          const explainRes = await fetch(`${API}/explain-video`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prediction: d.prediction,
              fake_probability: d.fake_probability,
              real_probability: d.real_probability,
              gradcam: d.gradcam,
            }),
          });
          const explainData = await explainRes.json();
          explanationText = explainData.explanation || null;   // ← capture locally
          setGeminiExplanation(explanationText);
        }

      } else if (mode === "text") {
        const res = await fetch(`${API}/predict-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textInput }),
        });
        const d = await res.json();
        score = d.fake_probability;
        prediction = d.prediction;
        setXaiData({ tokenImportance: d.token_importance || [], sentenceScores: d.sentence_scores || [] });
        // text has no gemini explanation, explanationText stays null
      }

    } catch (err) {
      console.error("API error:", err);
      setAnalysing(false);
      setVerdict({ score: 0, color: "var(--danger2)", glow: "rgba(239,68,68,.4)", word: "Connection Error", note: "Could not reach the backend server" });
      return;
    }

    if (score == null) {
      setAnalysing(false);
      setVerdict({ score: 0, color: "var(--danger2)", glow: "rgba(239,68,68,.4)", word: "Error", note: "Backend returned invalid response" });
      return;
    }

    const isFake = (typeof prediction === "string"
      ? prediction.toLowerCase() === "fake"
      : Boolean(prediction)) || score > 68;
    const isUnc = score >= 45 && score <= 68;
    const color = isFake ? "var(--danger2)" : isUnc ? "var(--warn2)" : "var(--safe2)";
    const glow = isFake ? "rgba(239,68,68,.4)" : isUnc ? "rgba(212,165,85,.38)" : "rgba(74,222,128,.4)";
    const word = isFake ? (mode === "signature" ? "Forgery Confirmed" : "Synthetic Detected") : isUnc ? "Inconclusive" : "Authentic";

    setVerdict({ score, color, glow, word, note: `${score.toFixed(1)}% synthetic probability` });
    setResults(cfg.results.map(r => ({ ...r, score })));
    setVisibleScores([]);
    await sleep(80);
    cfg.results.forEach((_, i) => setTimeout(() => setVisibleScores(prev => [...prev, i]), i * 200));
    setXaiOpen(false); // reset toggle on new analysis

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} · ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    setHistory(prev => [{
      glyph: getModeGlyph(mode),
      name: mode === "text" ? `"${textInput.slice(0, 32)}…"` : fileName,
      size: mode === "text" ? `${textInput.split(/\s+/).length} words` : fileSize + " MB",
      type: mode.charAt(0).toUpperCase() + mode.slice(1),
      cls: isFake ? "v-fake" : isUnc ? "v-unc" : "v-real",
      lbl: isFake ? (mode === "signature" ? "Forged" : "Synthetic") : isUnc ? "Inconclusive" : "Authentic",
      conf: score.toFixed(1) + "%",
      confClr: color,
      date: dateStr,
      explanation: explanationText,   // ← now correctly captured, not from stale state
    }, ...prev]);

    setAnalysing(false);
  }, [fileLoaded, analysing, mode, cfg, file, fileName, fileSize, textInput, referenceFile]);

  if (!currentUser) return <AuthPage />;

  const canSubmit = mode === "text"
    ? textInput.trim().length > 20
    : mode === "signature"
      ? fileLoaded && referenceFile !== null
      : fileLoaded;

  const aboutText =
    "Miraje is a modern deepfake detection system focused on identifying synthetic media through forensic AI, signal analysis, and transformer-based reasoning.";

  return (
    <>
      {/* ── HEADER ── */}
      <header className="bidaya-header">
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="brand-wordmark">Miraje</div>
        </div>
        <nav className="header-nav">
          {["Home", "Analysis", "Archive"].map(n => (
            <button
              key={n}
              className={`nav-link${activeNav === n ? " active" : ""}`}
              onClick={() => {
                if (n === "Home") {
                  window.location.href = '/';
                  return;
                }
                setActiveNav(n);
                if (n === "Analysis") {
                  setTimeout(() => {
                    document.getElementById('services-sec')?.scrollIntoView({ behavior: 'smooth' });
                  }, 0);
                }
              }}
            >
              {n}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span style={{
              fontFamily: "'Be Vietnam Pro', sans-serif",
              fontSize: 16,
              fontWeight: 500,
              color: "rgba(43,49,51,0.85)",
              letterSpacing: "-0.01em",
            }}>
              {currentUser.displayName ?? currentUser.email.split("@")[0]}
            </span>
          </div>
          <button
            onClick={logout}
            title="Logout"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              border: "none",
              borderRadius: 6,
              color: "rgba(43,49,51,0.7)",
              background: "none",
              cursor: "pointer",
              transition: "color .2s",
            }}
            onMouseEnter={e => { e.target.style.color = "var(--danger2)"; }}
            onMouseLeave={e => { e.target.style.color = "rgba(43,49,51,0.7)"; }}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── LANDING ONLY: Hero + About + Carousel + Services ── */}
      {!initialMode && activeNav !== "Archive" && (
        <>
          <div className="slide-stack">

            {/* HERO */}
            <div className="hero bidaya-hero">
              <span className="shooting-star shooting-star-a" aria-hidden="true" />
              <span className="shooting-star shooting-star-b" aria-hidden="true" />
              <div className="hero-badge">Advanced Deepfake Detection</div>
              <h1 className="hero-title">
                Nothing is what <br />
                <em className="hero-italic">it appears.</em>
              </h1>
              <p className="hero-desc">
                We craft strategic detection experiences that help you reveal what is real and what was constructed.
              </p>
              <div className="hero-actions">
                <button className="btn-primary" onClick={() => document.getElementById('services-sec')?.scrollIntoView({ behavior: 'smooth' })}>
                  Get Started
                </button>
                <button className="btn-icon" onClick={() => document.getElementById('services-sec')?.scrollIntoView({ behavior: 'smooth' })}>
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ABOUT */}
            <section id="about-section" className="about-section" ref={aboutRef}>
              <div className="about-container">
                <div className="about-text">
                  <div className="about-line">
                    {aboutText.split(" ").map((word, i) => (
                      <span key={i} className="about-word" style={{ "--d": `${i * 0.06}s` }}>
                        {word}&nbsp;
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* CAROUSEL */}
          <section className="carousel-section">
            <WheelCarousel />
          </section>

          {/* DETECTION SERVICES */}
          <section id="services-sec" className="services-section">
            <h2 className="services-heading">Detection Modules</h2>
            <div className="services-list">
              {DETECTION_SERVICES.map((svc, i) => (
                <ServiceRow key={svc.key} service={svc} index={i} />
              ))}
            </div>
            <AllWorksButton />
          </section>
        </>
      )}

      {/* ── WORKSPACE (?mode=X only) ── */}
      {activeNav === "Archive" && (
        <div style={{ padding: "80px 5vw", maxWidth: 1200, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontFamily: "'Inter', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ghost)", marginBottom: 12 }}>
              Forensic Archive
            </div>
            <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 400, color: "var(--plum)", letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
              {archive.length} saved {archive.length === 1 ? "case" : "cases"}
            </h2>
          </div>

          {archiveLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--ghost)", fontFamily: "'Inter',monospace", fontSize: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--safe2)", animation: "pulse 2s infinite" }} />
              Loading archive…
            </div>
          ) : archive.length === 0 ? (
            <div style={{ padding: "80px 0", textAlign: "center" }}>
              <div style={{ fontSize: 48, color: "rgba(250,250,250,0.06)", marginBottom: 20 }}>◈</div>
              <div style={{ fontFamily: "'Inter', monospace", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ghost)" }}>
                No archived cases yet
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "rgba(250,250,250,0.25)" }}>
                Run an analysis and press "+ Archive" to save a case here
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {archive.map((r, i) => (
                <ArchiveRow key={r.id || i} r={r} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}

      {initialMode && activeNav !== "Archive" && (
        <main id="workspace-sec">
          <div className="ws-page">

            {/* ── HERO ROW ── */}
            <div className="ws-hero">
              <h1 className="ws-hero-title">
                {DETECTION_SERVICES.find(s => s.key === mode)?.name}
              </h1>
              <div className="ws-meta-row">
                <div className="ws-meta-item">
                  <div className="ws-meta-label">Module</div>
                  <div className="ws-meta-value">{mode.charAt(0).toUpperCase() + mode.slice(1)}</div>
                </div>
                <span className="ws-meta-sep">/</span>
                <div className="ws-meta-item">
                  <div className="ws-meta-label">Formats</div>
                  <div className="ws-meta-value">{cfg.fmts.slice(0, 3).join(', ')}</div>
                </div>
                <span className="ws-meta-sep">/</span>
                <div className="ws-meta-item">
                  <div className="ws-meta-label">Verdict</div>
                  <div className="ws-meta-value" style={{ color: verdict.color || 'rgba(250,250,250,0.5)' }}>
                    {verdict.word}
                  </div>
                </div>
              </div>
              <p className="ws-hero-desc">
                {DETECTION_SERVICES.find(s => s.key === mode)?.sub.split('·').map((s, i) => (
                  <span key={i}>{s.trim()}{i === 0 ? ' — ' : ''}</span>
                ))}
                Submit your file below to begin forensic analysis.
              </p>
            </div>

            {/* ── BIG MEDIA ZONE ── */}
            <div
              className="ws-media-zone"
              onDragOver={onDragOver}
              onDrop={onDrop}
              onClick={() => mode !== 'text' && mode !== 'signature' && fileRef.current?.click()}
            >
              {scanning && <div className="scan-beam" />}
              <div className="dc tl" /><div className="dc tr" /><div className="dc bl" /><div className="dc br" />

              {previewSrc && mode === 'image' && (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <img className="ws-media-img" src={previewSrc} alt="preview" />
                  <StampOverlay verdict={verdict} mode={mode} />
                </div>
              )}

              {previewSrc && mode === 'video' && (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <video className="ws-media-img" src={previewSrc} muted playsInline preload="metadata"
                    style={{ objectFit: 'cover' }} />
                  <StampOverlay verdict={verdict} mode={mode} />
                </div>
              )}
              {/* ADD THIS BLOCK HERE */}
              {mode === 'signature' && (
                <div
                  style={{ display: 'flex', width: '100%', height: '100%', gap: 2 }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Slot 1 — Query signature */}
                  <div
                    style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid rgba(250,250,250,0.06)', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                  >
                    {previewSrc
                      ? <img src={previewSrc} alt="query" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <div style={{ paddingTop: 16, fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: 13, color: "rgba(43,49,51,0.65)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>✦</div>
                        <div>SIGNATURE TO VERIFY</div>
                        <div style={{ opacity: 0.5, marginTop: 4, fontSize: 10 }}>Click to upload</div>
                      </div>
                    }
                    <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 9, letterSpacing: 2, color: 'var(--ghost)', fontFamily: "'Inter',monospace", textTransform: 'uppercase' }}>Query</div>
                  </div>

                  {/* Slot 2 — Reference signature */}
                  <div
                    style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); referenceRef.current?.click(); }}
                  >
                    {referenceSrc
                      ? <img src={referenceSrc} alt="reference" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <div style={{ textAlign: 'center', color: 'var(--fog)', fontFamily: "'Inter',monospace", fontSize: 11, letterSpacing: 1 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>✦</div>
                        <div>REFERENCE SIGNATURE</div>
                        <div style={{ opacity: 0.5, marginTop: 4, fontSize: 10 }}>Click to upload</div>
                      </div>
                    }
                    <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 9, letterSpacing: 2, color: 'var(--ghost)', fontFamily: "'Inter',monospace", textTransform: 'uppercase' }}>Reference</div>
                  </div>

                  <StampOverlay verdict={verdict} mode={mode} />
                </div>
              )}



              {audioSrc && (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="ws-audio-inner">
                    <div className="ws-audio-icon">♪</div>
                    <div className="ws-audio-name">{fileName}</div>
                    <div className="ws-audio-size">{fileSize} MB</div>
                    <audio controls src={audioSrc} className="ws-audio-player" />
                  </div>
                  <StampOverlay verdict={verdict} mode={mode} />
                </div>
              )}

              {mode === 'text' && (
                <div className="ws-text-inner" onClick={e => e.stopPropagation()}>
                  <textarea
                    className="ws-textarea"
                    placeholder="Paste your text here, or drop a .txt / .docx file onto this area…"
                    value={textInput}
                    onChange={e => {
                      setTextInput(e.target.value);
                      setFileLoaded(e.target.value.length > 0);
                      setFileName('Pasted Text');
                      setFileSize((e.target.value.length / 1024).toFixed(2));
                    }}
                  />
                 
                </div>
              )}

              {!previewSrc && !audioSrc && mode !== 'text' && mode !== 'signature' && (
                <div className="ws-empty">
                  <div className="ws-empty-glyph">{getModeGlyph(mode)}</div>
                  <div className="ws-empty-title">Drop to analyse</div>
                  <div className="ws-empty-sub">Drag & drop or click to browse</div>
                  <div className="ws-empty-fmts">
                    {cfg.fmts.map(f => <span key={f} className="dfmt">{f}</span>)}
                  </div>
                  <button className="drop-cta" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                    Browse Files
                  </button>
                </div>
              )}
              <StampOverlay verdict={verdict} mode={mode} />
            </div>
            <input
              type="file"
              ref={referenceRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files[0];
                if (!f) return;
                setReferenceFile(f);
                const r = new FileReader();
                r.onload = ev => setReferenceSrc(ev.target.result);
                r.readAsDataURL(f);
              }}
            />
            <input type="file" ref={fileRef} onChange={onFilePick} style={{ display: 'none' }} />

            {/* ── ANALYSIS BAR ── */}
            <div className="ws-action-bar">
              <div className="ws-action-left">
                {pipelineVisible && (
                  <div className="ws-pipeline">
                    {pipelineSteps.map((s, i) => (
                      <div key={i} className={`ws-pipe-step${s.state === 'done' ? ' done' : s.state === 'running' ? ' running' : ''}`}>
                        <span className="ws-pipe-dot" />
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {verdict.score != null && (
                  <div className="ws-verdict-inline">
                    <div className="ws-verdict-pill" style={{ borderColor: verdict.color }}>
                      <span className="ws-verdict-dot" style={{ background: verdict.color }} />
                      <span className="ws-verdict-word" style={{ color: verdict.color }}>{verdict.word}</span>
                      <span className="ws-verdict-divider" />
                      <span className="ws-verdict-note">{verdict.note}</span>
                    </div>
                  </div>
                )}
              </div>
              <button className="ws-run-btn" disabled={!canSubmit || analysing} onClick={runAnalysis}>
                {!canSubmit ? (mode === 'text' ? 'Enter text first' : mode === 'signature' ? (fileLoaded ? 'Add reference signature' : 'No file selected') : 'No file selected')
                  : analysing ? 'Analysing…'
                    : 'Initiate Analysis →'}
              </button>
            </div>

            {/* ── EXPLAINABILITY TOGGLE ── */}
            {(
              (mode === 'text' && (xaiData.tokenImportance.length > 0 || xaiData.sentenceScores.length > 0)) ||
              ((mode === 'image' || mode === 'signature') && gradcam) ||
              (mode === 'video' && gradcam)
            ) && (
              <div className="ws-results-section">
                {/* Toggle header */}
                <button
                  onClick={() => setXaiOpen(p => !p)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(250,250,250,0.10)",
                    border: "1px solid rgba(250,250,250,0.22)",
                    borderRadius: xaiOpen ? "10px 10px 0 0" : 10,
                    padding: "18px 22px",
                    cursor: "pointer",
                    transition: "background 0.2s, border-color 0.2s, border-radius 0.2s",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(250,250,250,0.16)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(250,250,250,0.10)"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Report icon in pill */}
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: "rgba(250,250,250,0.08)",
                      border: "1px solid rgba(250,250,250,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
                        stroke="rgba(250,250,250,0.75)" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{
                        fontFamily: "'Inter', monospace",
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "rgba(250,250,250,0.9)",
                      }}>
                        View Explainability Report
                      </div>
                      <div style={{
                        fontFamily: "'Inter', monospace",
                        fontSize: 11,
                        color: "rgba(250,250,250,0.4)",
                        marginTop: 3,
                        letterSpacing: "0.04em",
                      }}>
                        {mode === 'text' ? 'RoBERTa tokenisation · sentence-level breakdown'
                          : mode === 'video' ? 'BiLSTM temporal analysis · frame-level forensics'
                          : mode === 'signature' ? 'GradCAM · EfficientNet-B0 channel-wise attention'
                          : 'GradCAM · Vision Transformer + CNN encoder'}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    color: "rgba(250,250,250,0.5)",
                    fontSize: 18,
                    transition: "transform 0.3s cubic-bezier(.22,1,.36,1)",
                    transform: xaiOpen ? "rotate(180deg)" : "rotate(0deg)",
                    lineHeight: 1,
                  }}>↓</div>
                </button>

                {/* Collapsible body */}
                <div style={{
                  overflow: "hidden",
                  maxHeight: xaiOpen ? "9999px" : "0px",
                  transition: "max-height 0.45s cubic-bezier(.22,1,.36,1)",
                  background: "rgba(250,250,250,0.02)",
                  border: xaiOpen ? "1px solid rgba(250,250,250,0.09)" : "none",
                  borderTop: "none",
                  borderRadius: "0 0 10px 10px",
                }}>
                  <div style={{ padding: "28px 0 12px" }}>

                    {/* TEXT XAI */}
                    {mode === 'text' && (xaiData.tokenImportance.length > 0 || xaiData.sentenceScores.length > 0) && (
                      <div style={{ padding: "0 24px 16px" }}>
                        <XAIPanel tokenImportance={xaiData.tokenImportance} sentenceScores={xaiData.sentenceScores} />
                      </div>
                    )}

                    {/* IMAGE / SIGNATURE GRADCAM */}
                    {(mode === 'image' || mode === 'signature') && gradcam && (
                      <div style={{ padding: "0 24px 16px" }}>
                        <div style={{
                          display: "flex",
                          gap: 24,
                          alignItems: "stretch",
                          flexWrap: "wrap",
                        }}>
                          {/* Heatmap image */}
                          <div style={{ flex: "1 1 340px", maxWidth: 520, minHeight: 320 }}>
                            <img
                              src={`data:image/png;base64,${gradcam}`}
                              alt="GradCAM heatmap"
                              style={{
                                width: "100%",
                                height: "auto",
                                minHeight: 280,
                                objectFit: "contain",
                                borderRadius: 8,
                                border: "1px solid rgba(250,250,250,0.08)",
                                display: "block",
                              }}
                            />
                          </div>

                          {/* Info cards column */}
                          <div style={{ flex: "1 1 380px", display: "flex", flexDirection: "column", gap: 16 }}>

                            {/* How to read this */}
                            <div style={{
                              background: "rgba(250,250,250,0.03)",
                              borderRadius: 10,
                              border: "1px solid rgba(250,250,250,0.09)",
                              padding: "22px 24px",
                            }}>
                              <div style={{
                                fontFamily: "'Inter', monospace",
                                fontSize: 15,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                color: "rgba(250,250,250,1)",
                                marginBottom: 14,
                                fontWeight: 600,
                              }}>
                                How to read this
                              </div>
                              <div style={{ fontSize: 17, color: "rgba(250,250,250,1)", lineHeight: 1.8 }}>
                                <span style={{ color: "#ef4444" }}>■</span>{" "}
                                <strong style={{ color: "#ffffff", fontWeight: 600 }}>Red / Orange</strong>
                                {" "}regions most strongly influenced the synthetic detection.{"  "}
                                <span style={{ color: "#60a5fa" }}>■</span>{" "}
                                <strong style={{ color: "#ffffff", fontWeight: 600 }}>Blue / Green</strong>
                                {" "}regions carried low forensic significance.
                              
                              </div>
                            </div>

                            {/* AI Forensic Analyst */}
                            {geminiExplanation && (
                              <div style={{
                                background: "rgba(250,250,250,0.03)",
                                borderRadius: 10,
                                border: "1px solid rgba(250,250,250,0.09)",
                                padding: "22px 24px",
                              }}>
                                <div style={{
                                  fontFamily: "'Inter', monospace",
                                  fontSize: 15,
                                  letterSpacing: "0.1em",
                                  textTransform: "uppercase",
                                  color: "rgba(250,250,250,1)",
                                  marginBottom: 14,
                                  fontWeight: 600,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}>
                                  <span>◈</span> AI Forensic Analyst
                                </div>
                                <div style={{
                                  fontFamily: "'Be Vietnam Pro', sans-serif",
                                  fontSize: 17,
                                  color: "rgba(250,250,250,1)",
                                  lineHeight: 1.85,
                                  whiteSpace: "pre-wrap",
                                  overflowY: "auto",
                                  maxHeight: 320,
                                }}>
                                  {geminiExplanation}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* VIDEO COMPOSITE XAI */}
                    {mode === 'video' && gradcam && (
                      <div style={{ padding: "0 24px 16px" }}>
                        <div style={{ overflow: "hidden", position: "relative", paddingBottom: "24%" }}>
                          <img
                            src={`data:image/png;base64,${gradcam}`}
                            alt="Video deepfake analysis"
                            style={{
                              position: "absolute",
                              width: "100%",
                              top: "-50%",
                              display: "block",
                              borderRadius: 8,
                              border: "1px solid rgba(250,250,250,0.08)",
                            }}
                          />
                        </div>
                        {geminiExplanation && (
                          <div style={{
                            marginTop: 20,
                            padding: "22px 24px",
                            borderRadius: 10,
                            border: "1px solid rgba(250,250,250,0.09)",
                            background: "rgba(250,250,250,0.03)",
                            whiteSpace: "pre-wrap",
                          }}>
                            <div style={{
                              fontSize: 15,
                              fontWeight: 600,
                              color: "rgba(250,250,250,1)",
                              textTransform: "uppercase",
                              letterSpacing: "0.1em",
                              fontFamily: "'Inter', monospace",
                              marginBottom: 14,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}>
                              <span>◈</span> AI Forensic Analyst
                            </div>
                            <div style={{ fontSize: 17, color: "rgba(250,250,250,1)", fontFamily: "'Be Vietnam Pro', sans-serif", lineHeight: 1.85 }}>
                              {geminiExplanation}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}
            {/* ── HISTORY TABLE ── */}
            <div className="ws-results-section">
              <div className="sec-head">Recent Cases</div>
              <div className="table-wrap">
                <div className="t-head">
                  <div>File</div><div>Type</div><div>Verdict</div><div>Score</div><div>Timestamp</div><div></div>
                </div>
                {history.length === 0 ? (
                  <div style={{ padding: '28px 24px', color: 'var(--ghost)', fontFamily: "'Inter',monospace", fontSize: 11, letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase' }}>
                    No cases analysed yet
                  </div>
                ) : history.map((r, i) => (
                  <div key={i} className="t-row">
                    <div className="t-file">
                      <div className="t-glyph">{r.glyph}</div>
                      <div>
                        <div className="t-fname">{r.name}</div>
                        <div className="t-fsize">{r.size}</div>
                      </div>
                    </div>
                    <div className="t-type">{r.type}</div>
                    <div><span className={`rc-verdict ${r.cls}`}>{r.lbl}</span></div>
                    <div className="t-conf" style={{ color: r.confClr }}>{r.conf}</div>
                    <div className="t-date">{r.date}</div>
                    <div>
                      <button
                        onClick={async () => {
                          if (r._archived) return;
                          const now = new Date();
                          const entry = { ...r, timestamp: now.toISOString() };
                          try {
                            await addDoc(collection(db, "users", currentUser.uid, "archive"), entry);
                            setHistory(prev => prev.map((row, j) => j === i ? { ...row, _archived: true } : row));
                            setArchive(prev => [{ ...entry, id: Date.now().toString() }, ...prev]);
                          } catch (e) {
                            console.error("Archive failed:", e);
                          }
                        }}
                        style={{
                          fontSize: 10,
                          fontFamily: "'Inter', monospace",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: r._archived ? "var(--safe2)" : "var(--ghost)",
                          background: "none",
                          border: "none",
                          cursor: r._archived ? "default" : "pointer",
                          padding: "4px 0",
                          transition: "color 0.2s",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r._archived ? "✓ Archived" : "+ Archive"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      )}

      {/* ── FOOTER ── */}
      <Footer />
    </>
  );
}
