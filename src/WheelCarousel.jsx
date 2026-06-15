import { useRef, useEffect } from "react";

const IMAGES = [
    "https://framerusercontent.com/images/uKWmthnJjBqgNr2fy7Th72CwK18.png",
    "https://framerusercontent.com/images/qvHVjBQ3YMUybtpO7OOKQOKHNA.png",
    "https://framerusercontent.com/images/TWOqDfYTYLpmjpIpzH23KjDxJmA.png",
    "https://framerusercontent.com/images/s1S9fPZ18MTx8XwZarkezh4Bk.png",
    "https://framerusercontent.com/images/EKOgTR9G2g6XvBP7MM3OTP1Ubo.png",
    "https://framerusercontent.com/images/fr3tcuvrhcc92fVb42dWaZgMiY0.png",
    "https://framerusercontent.com/images/VhISKNWI9OBLHkvGRYnKNtRakM.png",
    "https://framerusercontent.com/images/v9iF5w3VgVnlMzAUePKmFOO3Q.png",
    "https://framerusercontent.com/images/TB7DyRCNPXNMXOqT2fzIVSHG62Q.png",
    "https://framerusercontent.com/images/m1Btx6bE4pp2WXx5i6WKFn78.png",
    "https://framerusercontent.com/images/v60krc4Q1kxdiaOdGzy14IKqJw.png",
    "https://framerusercontent.com/images/2u8ygvlIQjHTx6WH7YbBrA9UcEU.png",
];
const RADIUS = 460;



export default function WheelCarousel() {
    const spinnerRef = useRef(null);
    const rafRef = useRef(null);
    const angleRef = useRef(0);

    useEffect(() => {
        let last = performance.now();
        const tick = (now) => {
            const dt = now - last;
            last = now;
            angleRef.current = (angleRef.current - (dt / 1000) * 6) % 360;
            if (spinnerRef.current) {
                spinnerRef.current.style.transform =
                    `rotateX(-42deg) rotateY(${angleRef.current + 15}deg)`;
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, []);

    return (
        <section style={{
            perspective: "1200px",
            perspectiveOrigin: "50% 40%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "160px 5vw 240px",
            overflow: "visible",
        }}>
            {/* Outer tilt wrapper — zero-size so it's a pure pivot point */}
            <div style={{
                transformStyle: "preserve-3d",
                transform: "rotateX(24deg) rotateY(-24deg)",
                width: 0,
                height: 0,
            }}>
                {/* Spinning ring */}
                <div ref={spinnerRef} style={{
                    transformStyle: "preserve-3d",
                    width: 0,
                    height: 0,
                }}>
                    {IMAGES.map((src, i) => (
                        <div key={i} style={{
                            position: "absolute",
                            width: 220,
                            height: 160,
                            top: -80,
                            left: -110,
                            transformStyle: "preserve-3d",
                            transform: `rotateY(${i * 30}deg) translateZ(${RADIUS}px)`,
                        }}>
                            <img src={src} draggable={false} alt={`Project ${i + 1}`}
                                style={{
                                    width: "100%", height: "100%",
                                    objectFit: "cover", borderRadius: 8,
                                    opacity: 0.85, display: "block",
                                    pointerEvents: "none", userSelect: "none",
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}