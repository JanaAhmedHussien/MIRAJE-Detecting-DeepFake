import { useState } from "react";

export default function AllWorksButton({ onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="all-works-wrap">
      <a
        href="/works"
        className={`all-works-btn${hovered ? " hovered" : ""}`}
        style={{ border: "none" }} 
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="all-works-label">ALL WORKS</span>
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="all-works-arrow"
          style={{
            transform: hovered ? "translate(2px, -2px)" : "translate(0,0)",
            transition: "transform 0.3s cubic-bezier(.22,1,.36,1)",
          }}
        >
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </a>
    </div>
  );
}