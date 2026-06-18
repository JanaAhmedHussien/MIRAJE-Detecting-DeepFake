import { useState } from "react";
import { useAuth } from "./AuthContext";
import videoCardImg from './assets/modules/video_card.jpg';
import audioCardImg from './assets/modules/audio_card.jpg';

const WORKS = [
  {
    key: "image",
    title: "Visual Forgery Detection",
    category: "GAN Fingerprinting",
    img: "https://framerusercontent.com/images/uKWmthnJjBqgNr2fy7Th72CwK18.png",
  },
  {
    key: "video",
    title: "Deepfake Video Analysis",
    category: "Temporal Coherence",
    img: videoCardImg,
  },
  {
    key: "audio",
    title: "Synthetic Voice Identification",
    category: "Spectral Forensics",
    img: audioCardImg,
  },
  {
    key: "signature",
    title: "Signature Forgery Forensics",
    category: "Stroke Dynamics",
    img: "https://framerusercontent.com/images/VhISKNWI9OBLHkvGRYnKNtRakM.png",
  },
  {
    key: "text",
    title: "AI-Authored Text Detection",
    category: "LLM Pattern Recognition",
    img: "https://framerusercontent.com/images/EKOgTR9G2g6XvBP7MM3OTP1Ubo.png",
  },
];

function WorkCard({ work, index }) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={`/?mode=${work.key}`}
      className="wk-card"
      style={{ animationDelay: `${index * 0.09}s` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="wk-img-wrap">
        <img
          src={work.img}
          alt={work.title}
          className="wk-img"
          style={{
            transform: hovered ? "scale(1.04)" : "scale(1)",
            transition: "transform 0.85s cubic-bezier(.2,.8,.2,1)",
          }}
        />
      </div>

      <div className="wk-meta">
        <div className="wk-title">{work.title}</div>
        <div className="wk-category">{work.category}</div>
      </div>
    </a>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-col">
          <div className="footer-col-label">Navigate</div>
          <a href="/" className="footer-link">Home</a>
          <a href="/#about-section" className="footer-link">About</a>
          <a href="/works" className="footer-link">All Modules</a>
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
            <input type="email" placeholder="your@email.com" className="footer-newsletter-input" />
            <button className="footer-newsletter-btn">→</button>
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
          Miraje
        </span>
      </div>
    </footer>
  );
}

export default function WorksPage() {
  const { currentUser, logout } = useAuth();

  return (
    <>
      {/* HEADER */}
      <header className="bidaya-header">
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="brand-wordmark">Miraje</div>
        </div>
        <nav className="header-nav">
          {["Analysis", "Archive", "Reports", "System"].map(n => (
            <a key={n} href="/" className="nav-link">{n}</a>
          ))}
        </nav>
        <div className="header-actions">
          {currentUser && (
            <>
              <span style={{
                fontFamily: "'Inter',monospace", fontSize: 9,
                color: "rgba(43,49,51,0.5)", letterSpacing: 1,
                maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {currentUser.displayName ?? currentUser.email.split("@")[0]}
              </span>
              <button
                onClick={logout}
                style={{
                  border: "1px solid rgba(43,49,51,0.18)", borderRadius: 4,
                  color: "rgba(43,49,51,0.6)", fontFamily: "'Inter',monospace",
                  fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
                  padding: "5px 13px", background: "none", cursor: "pointer",
                  transition: "color .2s, border-color .2s",
                }}
                onMouseEnter={e => { e.target.style.color = "var(--danger2)"; e.target.style.borderColor = "rgba(239,68,68,.4)"; }}
                onMouseLeave={e => { e.target.style.color = "rgba(43,49,51,0.6)"; e.target.style.borderColor = "rgba(43,49,51,0.18)"; }}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </header>

      {/* HERO */}
      <section className="wk-hero">
        <a href="/" className="mc-back-btn" style={{ marginBottom: 48, display: "inline-flex" }}>
          ← Back to Home
        </a>
        <h1 className="wk-hero-title">
          Elevating Detection to<br />New Heights
        </h1>
        <p className="wk-hero-sub">
          We specialize in revealing manipulated media through forensic AI — five modules,
          one mission: expose what's fake.
        </p>
      </section>

      {/* GRID */}
      <main className="wk-main">
        <div className="wk-grid">
          {WORKS.map((w, i) => (
            <WorkCard key={`${w.key}-${i}`} work={w} index={i} />
          ))}
        </div>
      </main>

      <Footer />
    </>
  );
}