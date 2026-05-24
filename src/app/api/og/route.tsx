import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#03050A",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          position: "relative",
        }}
      >
        {/* Grid dot background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(232,160,16,0.12) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Diamond logomark */}
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          fill="none"
          style={{ marginBottom: "32px", zIndex: 1 }}
        >
          <polygon
            points="36,2 70,36 36,70 2,36"
            stroke="#E8A010"
            strokeWidth="4"
            strokeLinejoin="round"
            fill="none"
          />
          <line x1="36" y1="3"  x2="36" y2="21" stroke="#E8A010" strokeWidth="4" strokeLinecap="round"/>
          <line x1="36" y1="51" x2="36" y2="69" stroke="#E8A010" strokeWidth="4" strokeLinecap="round"/>
          <line x1="3"  y1="36" x2="21" y2="36" stroke="#E8A010" strokeWidth="4" strokeLinecap="round"/>
          <line x1="51" y1="36" x2="69" y2="36" stroke="#E8A010" strokeWidth="4" strokeLinecap="round"/>
          <circle cx="36" cy="36" r="6.5" fill="#E8A010"/>
        </svg>

        {/* Wordmark */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: 700,
            letterSpacing: "0.2em",
            color: "#E8A010",
            zIndex: 1,
            marginBottom: "20px",
          }}
        >
          SOLV-001
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "26px",
            color: "#7A8CA0",
            letterSpacing: "0.08em",
            zIndex: 1,
            marginBottom: "48px",
          }}
        >
          It earns. It reasons. It compounds.
        </div>

        {/* Tech pills */}
        <div style={{ display: "flex", gap: "16px", zIndex: 1 }}>
          {["EIP-3009", "x402", "USYC Yield", "Arc Testnet"].map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 20px",
                border: "1px solid rgba(232,160,16,0.25)",
                color: "#CDD8E8",
                fontSize: "18px",
                letterSpacing: "0.05em",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            fontSize: "16px",
            color: "#38485A",
            letterSpacing: "0.1em",
            zIndex: 1,
          }}
        >
          Autonomous AI Agent Finance · Circle Tools · Arc Testnet
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
