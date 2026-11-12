/** Ilustraciones SVG animadas (sin dependencias). Respetan prefers-reduced-motion vía CSS. */

/** Logo: disco oscuro con un sol de arena y un aspa eólica blanca. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="logo-svg">
      <defs>
        <linearGradient id="lg-fondo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#505055" />
          <stop offset="1" stopColor="#2a2a2d" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill="url(#lg-fondo)" />
      <circle cx="24" cy="24" r="23.5" fill="none" stroke="#fff" strokeOpacity=".16" />
      <circle cx="17" cy="18" r="5.5" fill="#ecc09a" />
      <g className="aspas" style={{ transformOrigin: "29px 25px" }}>
        <path d="M29 25 L29 11.5 Q31 17 29 25Z" fill="#fff" />
        <path d="M29 25 L40.7 31.8 Q35 29.4 29 25Z" fill="#fff" />
        <path d="M29 25 L17.3 31.8 Q22.6 28 29 25Z" fill="#fff" />
      </g>
      <rect x="28.1" y="25" width="1.8" height="13" rx=".9" fill="#fff" />
      <circle cx="29" cy="25" r="2" fill="#2a2a2d" stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
}
