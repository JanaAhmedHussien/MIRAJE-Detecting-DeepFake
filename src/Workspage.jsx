import { useAuth } from "./AuthContext";
import videoCardImg from './assets/modules/video_card.jpg';
import audioCardImg from './assets/modules/audio_card.jpg';
import signatureCardImg from './assets/modules/signature_card.jpeg';
import textCardImg from './assets/modules/text_card.jpeg';
import imageCardImg from './assets/modules/image_card.jpeg';
import { useState, useRef, useEffect } from "react";
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
    img: signatureCardImg,
  },
  {
    key: "text",
    title: "AI-Authored Text Detection",
    category: "LLM Pattern Recognition",
    img: textCardImg ,
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

// WorksPage.jsx — replace the entire Footer function with this

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
const CAROUSEL_ITEMS = [...CAROUSEL_IMAGES, ...CAROUSEL_IMAGES];

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
        {CAROUSEL_ITEMS.map((src, i) => (
          <div key={i} className="fc-item" style={{ height: HEIGHTS[i % HEIGHTS.length] }}>
            <img src={src} alt="" loading="lazy" draggable={false} />
          </div>
        ))}
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
          {[["Home", "/"], ["Analysis", "/"], ["Works", "/works"]].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className={`nav-link${label === "Works" ? " active" : ""}`}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          {currentUser && (
            <>
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
                onMouseEnter={e => { e.currentTarget.style.color = "var(--danger2)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(43,49,51,0.7)"; }}
              >
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
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