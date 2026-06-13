import { useState, useEffect, useRef, useCallback } from "react";
import './Miraje.css'
import { useAuth } from './AuthContext';
import AuthPage from './AuthPage';
import UIFace from './assets/UI-face.png';


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
    }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── ENHANCED ANIMATED STAR CANVAS ── */
function StarCanvas() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const c = canvasRef.current;
        const ctx = c.getContext("2d");
        let W = 0, H = 0, raf, lastTs = 0;

        function resize() {
            W = c.width = window.innerWidth;
            H = c.height = window.innerHeight;
        }
        resize();
        window.addEventListener("resize", resize);

        // Stars in pixel coords, velocity in pixels-per-second
        const stars = Array.from({ length: 320 }, () => ({
            x: Math.random() * (W || window.innerWidth),
            y: Math.random() * ((H || window.innerHeight) * 0.65),
            r: Math.random() * 1.6 + 0.3,
            baseOp: Math.random() * 0.65 + 0.25,
            twinkleSpeed: Math.random() * 1.5 + 0.5,
            phase: Math.random() * Math.PI * 2,
            vx: (Math.random() - 0.5) * 10,   // ±10 px/sec drift
            vy: (Math.random() - 0.5) * 3.5,  // ±3.5 px/sec vertical
            warm: Math.random() < 0.18,
        }));

        // Shooting star
        let shoot = null;
        let nextShootDelay = 2000 + Math.random() * 3000;
        let shootTimer = 0;

        // Crossing stars (travel across the sky)
        let crossers = [];
        let nextCrossDelay = 4000 + Math.random() * 4000;
        let crossTimer = 0;

        function spawnCrosser() {
            const fromLeft = Math.random() < 0.5;
            crossers.push({
                x: fromLeft ? -20 : W + 20,
                y: H * 0.05 + Math.random() * H * 0.45,
                vx: fromLeft ? (60 + Math.random() * 80) : -(60 + Math.random() * 80),
                vy: (Math.random() - 0.5) * 20,
                r: 0.8 + Math.random() * 0.7,
                tailLen: 80 + Math.random() * 60,
                life: 0,
                maxLife: 3500 + Math.random() * 2000,
                warm: Math.random() < 0.3,
            });
        }

        function spawnShoot() {
            shoot = {
                x: W * 0.1 + Math.random() * W * 0.8,
                y: H * 0.02 + Math.random() * H * 0.25,
                len: 140 + Math.random() * 100,
                age: 0,
                life: 900, // ms
                angle: Math.PI / 4 + (Math.random() - 0.5) * 0.5,
            };
        }

        function draw(ts) {
            const dt = Math.min((ts - lastTs) / 1000, 0.05); // seconds, capped at 50ms
            lastTs = ts;

            ctx.clearRect(0, 0, W, H);
            const t = ts / 1000;

            // Move & draw each star
            stars.forEach(s => {
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                // Wrap at edges
                if (s.x < -4) s.x = W + 4;
                if (s.x > W + 4) s.x = -4;
                if (s.y < -4) s.y = H * 0.65;
                if (s.y > H * 0.65) s.y = -4;

                const twinkle = 0.45 + 0.55 * Math.sin(t * s.twinkleSpeed + s.phase);
                const o = s.baseOp * twinkle;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = s.warm ? `rgba(255,228,160,${o})` : `rgba(235,242,255,${o})`;
                ctx.fill();

                // Cross sparkle on bright large stars
                if (s.r > 1.3 && o > 0.5) {
                    const sl = s.r * 3.5;
                    ctx.globalAlpha = o * 0.4;
                    ctx.strokeStyle = s.warm ? `rgba(255,215,120,1)` : `rgba(190,215,255,1)`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath(); ctx.moveTo(s.x - sl, s.y); ctx.lineTo(s.x + sl, s.y); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(s.x, s.y - sl); ctx.lineTo(s.x, s.y + sl); ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            });

            // Shooting star logic
            shootTimer += dt * 1000;
            if (shootTimer >= nextShootDelay && !shoot) {
                spawnShoot();
                shootTimer = 0;
                nextShootDelay = 3000 + Math.random() * 6000;
            }
            if (shoot) {
                shoot.age += dt * 1000;
                const prog = shoot.age / shoot.life;
                if (prog >= 1) {
                    shoot = null;
                } else {
                    const alpha = prog < 0.3 ? prog / 0.3 : prog > 0.7 ? (1 - prog) / 0.3 : 1;
                    const ex = shoot.x + Math.cos(shoot.angle) * shoot.len * prog;
                    const ey = shoot.y + Math.sin(shoot.angle) * shoot.len * prog;
                    const grad = ctx.createLinearGradient(shoot.x, shoot.y, ex, ey);
                    grad.addColorStop(0, 'rgba(255,245,210,0)');
                    grad.addColorStop(0.5, `rgba(255,245,210,${alpha * 0.9})`);
                    grad.addColorStop(1, 'rgba(255,245,210,0)');
                    ctx.save();
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 1.8;
                    ctx.beginPath();
                    ctx.moveTo(shoot.x, shoot.y);
                    ctx.lineTo(ex, ey);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // Crossing stars logic
            crossTimer += dt * 1000;
            if (crossTimer >= nextCrossDelay && crossers.length < 3) {
                spawnCrosser();
                crossTimer = 0;
                nextCrossDelay = 3000 + Math.random() * 5000;
            }
            crossers = crossers.filter(c => {
                c.life += dt * 1000;
                c.x += c.vx * dt;
                c.y += c.vy * dt;
                if (c.life >= c.maxLife || c.x < -200 || c.x > W + 200) return false;
                const prog = c.life / c.maxLife;
                const alpha = prog < 0.15 ? prog / 0.15 : prog > 0.8 ? (1 - prog) / 0.2 : 1;
                const tailX = c.x - Math.sign(c.vx) * c.tailLen;
                const grad = ctx.createLinearGradient(tailX, c.y, c.x, c.y);
                grad.addColorStop(0, 'rgba(255,245,210,0)');
                grad.addColorStop(1, c.warm ? `rgba(255,220,140,${alpha * 0.85})` : `rgba(200,225,255,${alpha * 0.85})`);
                ctx.save();
                ctx.strokeStyle = grad;
                ctx.lineWidth = c.r;
                ctx.beginPath();
                ctx.moveTo(tailX, c.y);
                ctx.lineTo(c.x, c.y);
                ctx.stroke();
                // head dot
                ctx.beginPath();
                ctx.arc(c.x, c.y, c.r * 1.5, 0, Math.PI * 2);
                ctx.fillStyle = c.warm ? `rgba(255,230,160,${alpha})` : `rgba(220,235,255,${alpha})`;
                ctx.fill();
                ctx.restore();
                return true;
            });

            raf = requestAnimationFrame(draw);
        }

        raf = requestAnimationFrame(draw);
        return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf); };
    }, []);

    return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }} />;
}

/* ── SVG SAND DUNES ── */
function SandDunes() {
    return (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2, pointerEvents: "none" }}>
            <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ width: "100%", height: 120, display: "block" }}>
                <defs>
                    <linearGradient id="dune1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2c1e08" />
                        <stop offset="100%" stopColor="#0e0d06" />
                    </linearGradient>
                </defs>
                <path d="M0,80 C120,45 280,100 440,65 C600,30 720,90 900,55 C1080,20 1250,75 1440,50 L1440,120 L0,120 Z" fill="url(#dune1)" />
            </svg>
            <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style={{ width: "100%", height: 90, display: "block", marginTop: -2 }}>
                <defs>
                    <linearGradient id="dune2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#221608" />
                        <stop offset="100%" stopColor="#090806" />
                    </linearGradient>
                    <linearGradient id="duneRidge" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,225,140,0.12)" />
                        <stop offset="100%" stopColor="rgba(255,225,140,0)" />
                    </linearGradient>
                </defs>
                <path d="M0,50 C200,20 400,70 600,30 C800,-10 1000,60 1200,25 C1320,8 1380,40 1440,20 L1440,90 L0,90 Z" fill="url(#dune2)" />
                <path d="M0,50 C200,20 400,70 600,30 C800,-10 1000,60 1200,25 C1320,8 1380,40 1440,20" fill="none" stroke="url(#duneRidge)" strokeWidth="3" />
            </svg>
        </div>
    );
}

/* ── CURSOR ── */
function Cursor() {
    const curRef = useRef(null);
    const ringRef = useRef(null);
    useEffect(() => {
        let mx = 0, my = 0, rx = 0, ry = 0, raf;
        const onMove = e => {
            mx = e.clientX; my = e.clientY;
            if (curRef.current) {
                curRef.current.style.left = (mx - 3) + "px";
                curRef.current.style.top = (my - 3) + "px";
            }
        };
        document.addEventListener("mousemove", onMove);
        function loop() {
            rx += (mx - rx - 12) * .1; ry += (my - ry - 12) * .1;
            if (ringRef.current) {
                ringRef.current.style.left = rx + "px";
                ringRef.current.style.top = ry + "px";
            }
            raf = requestAnimationFrame(loop);
        }
        loop();
        const addHov = () => {
            document.querySelectorAll("button,.mode-tile,.drop-zone,.stat,.result-card,.t-row").forEach(el => {
                el.addEventListener("mouseenter", () => { curRef.current?.classList.add("hov"); ringRef.current?.classList.add("hov"); });
                el.addEventListener("mouseleave", () => { curRef.current?.classList.remove("hov"); ringRef.current?.classList.remove("hov"); });
            });
        };
        setTimeout(addHov, 600);
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
            <svg width="118" height="118" viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
                <circle className="vr-bg" cx="55" cy="55" r="47" />
                <circle className="vr-track" cx="55" cy="55" r="47" />
                <circle className="vr-fill" cx="55" cy="55" r="47"
                    style={{
                        strokeDashoffset: offset,
                        stroke: color || "var(--rim2)",
                        filter: glow ? `drop-shadow(0 0 8px ${glow})` : "none"
                    }}
                />
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
                color: clr,
                textShadow: `0 0 22px ${g}`,
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

/* ── HERO STATS STRIP (Optional Enhancement) ── */
function HeroStats() {
    const stats = [
        { val: "99.4%", label: "Detection Accuracy" },
        { val: "12ms", label: "Analysis Latency" },
        { val: "4", label: "Detection Modes" },
        { val: "∞", label: "Files Processed" },
    ];
    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1,
            background: "rgba(232,192,64,0.10)",
            border: "1px solid rgba(232,192,64,0.14)",
            borderRadius: 12,
            overflow: "hidden",
            animation: "fadeUp .8s var(--ease-out) .9s both",
            marginTop: 32,
        }}>
            {stats.map((s, i) => (
                <div key={i} style={{
                    background: "rgba(4,6,12,0.96)",
                    padding: "18px 20px",
                    textAlign: "center",
                    borderRight: i < 3 ? "1px solid rgba(232,192,64,0.08)" : "none",
                }}>
                    <div style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 28,
                        fontWeight: 300,
                        color: "var(--gold)",
                        textShadow: "0 0 30px rgba(232,192,64,0.35)",
                        marginBottom: 4,
                    }}>{s.val}</div>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 7,
                        letterSpacing: 2,
                        color: "var(--sand-mid)",
                        textTransform: "uppercase",
                    }}>{s.label}</div>
                </div>
            ))}
        </div>
    );
}

/* ── MAIN APP ── */
export default function Miraje() {
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
    const [history, setHistory] = useState([]);
    const fileRef = useRef(null);
    const cfg = CFG[mode];

    const [moduleSelected, setModuleSelected] = useState(false);

    useEffect(() => {
        setMetrics(cfg.metrics.map(m => ({ ...m, value: 0, label: "—" })));
        setVerdict({ score: null, color: null, glow: null, word: "Awaiting Input", note: "Submit a file to begin" });
        setResults([]); setPipelineVisible(false);
    }, [mode]);

    useEffect(() => {
        setMetrics(cfg.metrics.map(m => ({ ...m, value: 0, label: "—" })));
    }, [cfg.metrics]);

    const workspaceRef = useRef(null);
    function handleSetMode(k) {
        setModeKey(k);
        setModuleSelected(true);
        setFileLoaded(false); setPreviewSrc(null); setFileName(null); setFileSize(null);
        setFile(null);
        setAudioSrc(null);
        setTimeout(() => workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
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
        } else { setPreviewSrc(null); setAudioSrc(null); }
        setScanning(true);
        setTimeout(() => setScanning(false), 3200);
    }

    function onDragOver(e) { e.preventDefault(); }
    function onDrop(e) { e.preventDefault(); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); }
    function onFilePick(e) { if (e.target.files[0]) loadFile(e.target.files[0]); }

    const runAnalysis = useCallback(async () => {
        if (!fileLoaded || analysing) return;
        setAnalysing(true); setPipelineVisible(true);
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
            }

        } catch (err) { console.error("API error:", err); setAnalysing(false); return; }
        if (score == null) { setAnalysing(false); return; }
        const isFake = prediction === "fake";
        const isUnc = score >= 45 && score <= 68;
        const color = isFake ? "var(--danger2)" : isUnc ? "var(--warn2)" : "var(--safe2)";
        const glow = isFake ? "rgba(232,115,107,.4)" : isUnc ? "rgba(212,165,85,.38)" : "rgba(104,212,174,.4)";
        const word = isFake ? (mode === "signature" ? "Forgery Confirmed" : "Synthetic Detected") : isUnc ? "Inconclusive" : "Authentic";
        setVerdict({ score, color, glow, word, note: `${score.toFixed(1)}% synthetic probability` });
        setMetrics(cfg.metrics.map((m, i) => ({ ...m, value: Math.max(0, score - i * 6), label: (Math.max(0, score - i * 6)).toFixed(1) + "%" })));
        setResults(cfg.results.map(r => ({ ...r, score })));
        setVisibleScores([]);
        await sleep(80);
        cfg.results.forEach((_, i) => setTimeout(() => setVisibleScores(prev => [...prev, i]), i * 200));
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} · ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        setHistory(prev => [{
            glyph: getModeGlyph(mode), name: fileName, size: fileSize + " MB",
            type: mode.charAt(0).toUpperCase() + mode.slice(1),
            cls: isFake ? "v-fake" : isUnc ? "v-unc" : "v-real",
            lbl: isFake ? (mode === "signature" ? "Forged" : "Synthetic") : isUnc ? "Inconclusive" : "Authentic",
            conf: score.toFixed(1) + "%", confClr: color, date: dateStr
        }, ...prev]);
        setAnalysing(false);
    }, [fileLoaded, analysing, mode, cfg, file, fileName, fileSize]);

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
                    <div style={{ display: "flex", alignItems: "center", gap: 10, borderLeft: "1px solid rgba(232,192,64,0.12)", paddingLeft: 16 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--ghost)", letterSpacing: 1, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {currentUser.email}
                        </span>
                        <button
                            onClick={logout}
                            style={{
                                background: "none",
                                border: "1px solid rgba(232,192,64,0.2)",
                                borderRadius: 4,
                                color: "var(--ghost)",
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 8,
                                letterSpacing: 2,
                                textTransform: "uppercase",
                                padding: "5px 13px",
                                cursor: "none",
                                transition: "color .2s, border-color .2s, box-shadow .2s",
                            }}
                            onMouseEnter={e => { e.target.style.color = "var(--danger2)"; e.target.style.borderColor = "rgba(232,115,107,.4)"; }}
                            onMouseLeave={e => { e.target.style.color = "var(--ghost)"; e.target.style.borderColor = "rgba(232,192,64,0.2)"; }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* HERO SECTION */}
            <div className="hero">
                <div className="sky"><StarCanvas /></div>

                {/* SVG sand dune layers */}
                <SandDunes />

                <div className="horizon-glow" />
                <div className="horizon-line" />
                <div className="figure" />

                <div className="pool">
                    {[{ d: "3.2s", delay: "0s", op: .5 }, { d: "4.1s", delay: ".5s", op: .32 }, { d: "3.7s", delay: "1s", op: .2 }, { d: "5s", delay: "1.7s", op: .1 }].map((p, i) => (
                        <div key={i} className="pool-wave" style={{ "--d": p.d, "--delay": p.delay, "--op": p.op, bottom: i * 6 + "px" }} />
                    ))}
                </div>
                <div className="heat">
                    {[{ d: "3.5s", delay: "0s", op: .10 }, { d: "4.2s", delay: ".4s", op: .07 }, { d: "3.9s", delay: ".9s", op: .06 }, { d: "5.1s", delay: "1.5s", op: .04 }, { d: "4.6s", delay: "2.1s", op: .03 }].map((h, i) => (
                        <div key={i} className="heat-wave" style={{ "--d": h.d, "--delay": h.delay, "--op": h.op, bottom: i * 20 + "px" }} />
                    ))}
                </div>
                <div className="reflection">
                    {[{ d: "4s", delay: "0s", op: .14 }, { d: "5.5s", delay: ".7s", op: .09 }, { d: "4.8s", delay: "1.4s", op: .05 }, { d: "6s", delay: "2s", op: .03 }].map((r, i) => (
                        <div key={i} className="ref-band" style={{ "--d": r.d, "--delay": r.delay, "--op": r.op, bottom: i * 7 + "px" }} />
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
                    {/* FACE IMAGE — right column */}
                    <div className="hero-face-wrap" style={{ animation: "fadeUp 1.1s var(--ease-out) .5s both" }}>
                        <div className="hero-face-frame">
                            {/* Animated corner brackets */}
                            <div className="hf-corner hf-tl" />
                            <div className="hf-corner hf-tr" />
                            <div className="hf-corner hf-bl" />
                            <div className="hf-corner hf-br" />
                            {/* Scan line */}
                            <div className="hf-scan" />
                            {/* The image */}
                            <img src={UIFace} alt="AI face mesh" className="hero-face-img" />
                            {/* Overlay labels */}
                            <div className="hf-label hf-label-tl">MESH · v4.2</div>
                            <div className="hf-label hf-label-tr">GAN · DETECT</div>
                            <div className="hf-label hf-label-bl">LANDMARK · 468PT</div>
                            <div className="hf-label hf-label-br">ACTIVE</div>
                            {/* Bottom glow bar */}
                            <div className="hf-glow-bar" />
                        </div>
                    </div>
                </div>

                {/* Optional Hero Stats Strip - Uncomment if desired */}
                {/* <HeroStats /> */}

                <div className="scroll-hint">
                    <div className="sh-text">Scroll</div>
                    <div className="sh-line" />
                </div>
            </div>

            {/* MAIN CONTENT */}
            <main>
                <div className="page">

                    {/* MODULE CARDS — Target-style editorial cards */}
                    <div className="works-section">
                        <div className="works-header">
                            <div className="works-label">Detection Modules</div>
                            <h2 className="works-title">Choose your analysis type</h2>
                            <p className="works-sub">Select a module to begin deepfake detection analysis.</p>
                        </div>
                        <div className="works-grid">
                            {[
                                { key: "video",     tag: "Temporal Analysis",    title: "Video Detection",        desc: "Frame-by-frame face-swap, lip-sync manipulation & temporal coherence analysis.",     accent: "#6366f1" },
                                { key: "image",     tag: "Visual Forensics",     title: "Image Detection",        desc: "GAN fingerprinting, inpainting traces & pixel-level artifact detection in photos.",   accent: "#3b82f6" },
                                { key: "text",      tag: "NLP Analysis",         title: "Text Detection",         desc: "Stylometric analysis and linguistic pattern recognition for AI-generated text.",       accent: "#8b5cf6" },
                                { key: "signature", tag: "Biometric Forensics",  title: "Signature Verification", desc: "Stroke dynamics, tremor analysis & pen-lift pattern verification against templates.",  accent: "#06b6d4" },
                                { key: "audio",     tag: "Acoustic Forensics",   title: "Audio Forensics",        desc: "Voice cloning & synthetic speech detection via spectral and prosody analysis.",        accent: "#10b981" },
                            ].map((card, i) => (
                                <div
                                    key={card.key}
                                    className={`work-card${mode === card.key && moduleSelected ? ' work-card--active' : ''}`}
                                    onClick={() => handleSetMode(card.key)}
                                    style={{ '--card-accent': card.accent, animationDelay: `${i * 0.07}s` }}
                                >
                                    <div className="wc-tag">{card.tag}</div>
                                    <div className="wc-body">
                                        <h3 className="wc-title">{card.title}</h3>
                                        <p className="wc-desc">{card.desc}</p>
                                    </div>
                                    <div className="wc-footer">
                                        <span className="wc-cta">Start Analysis</span>
                                        <span className="wc-arrow">→</span>
                                    </div>
                                    <div className="wc-glow" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* WORKSPACE — only shown after a module is selected */}
                    {moduleSelected && (
                    <div ref={workspaceRef} style={{ scrollMarginTop: 100 }}>
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
                        <input type="file" ref={fileRef} onChange={onFilePick} style={{ display: "none" }} />

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

                            <div className="panel">
                                <div className="panel-head"><div className="panel-label">Signal Analysis</div></div>
                                <div className="metrics-body">
                                    {metrics.map((m, i) => <MetricBar key={i} name={m.n} color={m.c} value={m.value || 0} label={m.label || "—"} />)}
                                </div>
                            </div>

                            <button className="run-btn" disabled={!fileLoaded || analysing} onClick={runAnalysis}>
                                <span>{!fileLoaded ? "No File Selected" : analysing ? "Analysing…" : "Initiate Analysis"}</span>
                            </button>
                        </div>
                    </div>

                    {/* RESULTS */}
                    {results.length > 0 && (
                        <div style={{ marginBottom: 48 }}>
                            <div className="sec-head" style={{ marginBottom: 18 }}>Subsystem Results</div>
                            <div className="results-grid">
                                {results.map((r, i) => <ResultCard key={i} {...r} mode={mode} visible={visibleScores.includes(i)} />)}
                            </div>
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
                    )}

                </div>
            </main>
        </>
    );
}