export default function AgencySeal({ className }: { className?: string }) {
  const starCount = 13;
  const starR = 43;
  const stars = Array.from({ length: starCount }, (_, i) => {
    const a = (i * (360 / starCount) - 90) * (Math.PI / 180);
    return { x: +(50 + starR * Math.cos(a)).toFixed(2), y: +(50 + starR * Math.sin(a)).toFixed(2) };
  });

  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <path id="seal-top" d="M 11,50 A 39,39 0 0,1 89,50" />
        <path id="seal-bot" d="M 11,50 A 39,39 0 0,0 89,50" />
      </defs>

      {/* Outer border ring */}
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1.5" />

      {/* 13 stars */}
      {stars.map(({ x, y }, i) => (
        <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="5.5" fill="currentColor">
          ★
        </text>
      ))}

      {/* Inner content ring */}
      <circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" strokeWidth="0.75" />

      {/* Top arc: agency name */}
      <text fontSize="5.5" fontFamily="Arial, sans-serif" fontWeight="700" letterSpacing="1" fill="currentColor">
        <textPath href="#seal-top" startOffset="50%" textAnchor="middle">
          ALCOHOL · TOBACCO · TAX · TRADE
        </textPath>
      </text>

      {/* Bottom arc: parent department */}
      <text fontSize="5" fontFamily="Arial, sans-serif" fontWeight="600" letterSpacing="0.5" fill="currentColor">
        <textPath href="#seal-bot" startOffset="50%" textAnchor="middle">
          U.S. DEPT. OF THE TREASURY
        </textPath>
      </text>

      {/* Eagle — head */}
      <circle cx="50" cy="26" r="5" fill="currentColor" />
      {/* Beak (right-facing) */}
      <path d="M 55 26 L 61 29 L 55 31 Z" fill="currentColor" />
      {/* Left wing */}
      <path d="M 46 36 C 38 31 26 29 16 34 C 24 35 35 38 43 43 Z" fill="currentColor" />
      {/* Right wing */}
      <path d="M 54 36 C 62 31 74 29 84 34 C 76 35 65 38 57 43 Z" fill="currentColor" />
      {/* Body */}
      <path d="M 46 31 L 54 31 L 56 50 L 50 53 L 44 50 Z" fill="currentColor" />
      {/* Tail feathers */}
      <path
        d="M 44 50 L 38 62 M 47 51 L 43 63 M 50 53 L 50 65 M 53 51 L 57 63 M 56 50 L 62 62"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
