interface Props {
  size?: number;
  color?: string;
  className?: string;
}

/** SOLV-001 precision diamond logomark — works at any size */
export default function SolvLogo({ size = 20, color = "var(--amber)", className }: Props) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r  = s / 2 - 1;           // diamond radius (outer)
  const td = r * 0.20;             // tick gap from center
  const cr = s * 0.095;            // center dot radius

  // Diamond polygon points: top, right, bottom, left
  const pts = [
    `${cx},${cy - r}`,
    `${cx + r},${cy}`,
    `${cx},${cy + r}`,
    `${cx - r},${cy}`,
  ].join(" ");

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer diamond */}
      <polygon
        points={pts}
        stroke={color}
        strokeWidth={s * 0.065}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Crosshair ticks (only render if size >= 14) */}
      {s >= 14 && (
        <>
          <line x1={cx}        y1={cy - r + 1}    x2={cx}        y2={cy - td} stroke={color} strokeWidth={s * 0.065} strokeLinecap="round"/>
          <line x1={cx}        y1={cy + td}        x2={cx}        y2={cy + r - 1} stroke={color} strokeWidth={s * 0.065} strokeLinecap="round"/>
          <line x1={cx - r + 1} y1={cy}            x2={cx - td}   y2={cy}    stroke={color} strokeWidth={s * 0.065} strokeLinecap="round"/>
          <line x1={cx + td}   y1={cy}             x2={cx + r - 1} y2={cy}   stroke={color} strokeWidth={s * 0.065} strokeLinecap="round"/>
        </>
      )}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={cr} fill={color}/>
    </svg>
  );
}
