import { useEffect, useState, useRef } from "react";

interface SecurityCheckProps {
  onVerified: () => void;
}

export function SecurityCheck({ onVerified }: SecurityCheckProps) {
  const [clicked, setClicked] = useState(false);
  const [dots, setDots] = useState(0);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const rayId = useRef(Math.random().toString(36).substring(2, 18).toUpperCase());

  const DOT_COUNT = 8;

  useEffect(() => {
    if (!clicked) return;

    const dotInterval = setInterval(() => {
      setDots((d) => (d + 1) % DOT_COUNT);
    }, 200);

    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 100;
        const increment = p < 60 ? Math.random() * 8 + 4 : Math.random() * 3 + 1;
        return Math.min(p + increment, 100);
      });
    }, 120);

    const completeTimer = setTimeout(() => {
      setProgress(100);
      setDone(true);
    }, 2800);

    const exitTimer = setTimeout(() => {
      onVerified();
    }, 3400);

    return () => {
      clearInterval(dotInterval);
      clearInterval(progressInterval);
      clearTimeout(completeTimer);
      clearTimeout(exitTimer);
    };
  }, [clicked, onVerified]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col justify-center px-8 md:px-16"
      style={{ background: "#0a0a0a" }}
    >
      <div className="max-w-lg">
        <h1 className="text-white text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
          {clicked ? <>Performing security<br />verification</> : <>Security<br />verification</>}
        </h1>

        <p className="text-white/40 text-sm leading-relaxed mb-10 max-w-sm">
          {clicked
            ? "This website uses a security service to protect against malicious bots and unauthorized access. Please wait while we verify your browser."
            : "This website uses a security service to protect against malicious bots. Please verify you are human to continue."}
        </p>

        <div
          className="rounded-2xl px-5 py-4 flex items-center justify-between"
          style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-4">
            {!clicked ? (
              <button
                onClick={() => setClicked(true)}
                className="flex items-center gap-3 group cursor-pointer select-none"
              >
                <div
                  className="w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 group-hover:border-white/60"
                  style={{ borderColor: "#333", background: "#0c0c0c" }}
                >
                  <div className="w-2.5 h-2.5 rounded-sm opacity-0 group-hover:opacity-30 transition-opacity" style={{ background: "#ff2d2d" }} />
                </div>
                <span className="text-white/80 text-sm font-medium">I am human</span>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                {done ? (
                  <div
                    className="w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: "#ff2d2d", background: "#ff2d2d22" }}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#ff2d2d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ) : (
                  <div className="relative w-6 h-6 flex-shrink-0">
                    {Array.from({ length: DOT_COUNT }).map((_, i) => {
                      const angle = (i / DOT_COUNT) * 2 * Math.PI;
                      const x = 50 + 38 * Math.cos(angle);
                      const y = 50 + 38 * Math.sin(angle);
                      const isActive = i === dots || i === (dots + 1) % DOT_COUNT || i === (dots + 2) % DOT_COUNT;
                      return (
                        <div
                          key={i}
                          className="absolute rounded-full transition-opacity duration-200"
                          style={{
                            width: 4,
                            height: 4,
                            left: `${x}%`,
                            top: `${y}%`,
                            transform: "translate(-50%, -50%)",
                            background: "#ff2d2d",
                            opacity: isActive ? 1 : 0.2,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
                <span className="text-white text-sm font-medium">
                  {done ? "Verification complete" : "Verifying..."}
                </span>
              </div>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-white/80 text-xs font-bold tracking-widest uppercase">
              PiF<span style={{ color: "#888" }}> Market</span>
            </p>
            <p className="text-white/30 text-[10px] mt-0.5">Security · Protected</p>
          </div>
        </div>

        <div className="mt-4 h-0.5 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background: "#ff2d2d",
            }}
          />
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-white/20 text-[11px]">
           Ray ID: {rayId.current} · Protected by security service
        </p>
      </div>
    </div>
  );
}
