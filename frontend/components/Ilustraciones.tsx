/** Ilustraciones SVG animadas (sin dependencias). Respetan prefers-reduced-motion vía CSS. */

/** Logo: sol + aspa eólica. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="logo-svg">
      <defs>
        <linearGradient id="lg-sol" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd166" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="lg-fondo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#0e7490" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#lg-fondo)" />
      <circle cx="17" cy="17" r="7" fill="url(#lg-sol)" />
      <g className="aspas" style={{ transformOrigin: "31px 27px" }}>
        <path d="M31 27 L31 12 Q33 18 31 27Z" fill="#fff" />
        <path d="M31 27 L44 34.5 Q38 31 31 27Z" fill="#fff" />
        <path d="M31 27 L18 34.5 Q24 31 31 27Z" fill="#fff" />
      </g>
      <rect x="30" y="27" width="2" height="15" rx="1" fill="#fff" />
      <circle cx="31" cy="27" r="2" fill="#0e7490" stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
}

/** Orbe de IA que "piensa": anillos girando y núcleo latiendo. */
export function OrbeIA({ size = 150 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" aria-hidden="true" className="orbe">
      <defs>
        <radialGradient id="og-nucleo" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ecfdf5" />
          <stop offset=".45" stopColor="#34d399" />
          <stop offset="1" stopColor="#0e7490" />
        </radialGradient>
        <linearGradient id="og-anillo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <circle className="orbe-halo" cx="80" cy="80" r="62" fill="#34d399" opacity=".18" />
      <g className="orbe-giro">
        <circle cx="80" cy="80" r="66" fill="none" stroke="url(#og-anillo)" strokeWidth="3" strokeDasharray="60 30 12 30" strokeLinecap="round" />
      </g>
      <g className="orbe-giro-inv">
        <circle cx="80" cy="80" r="52" fill="none" stroke="#0e7490" strokeOpacity=".5" strokeWidth="2" strokeDasharray="4 10" strokeLinecap="round" />
      </g>
      <circle className="orbe-nucleo" cx="80" cy="80" r="34" fill="url(#og-nucleo)" />
      <g className="orbe-chispa" fill="#fff">
        <path d="M80 62 L84 76 L98 80 L84 84 L80 98 L76 84 L62 80 L76 76Z" opacity=".95" />
      </g>
    </svg>
  );
}

/** Ilustración de bienvenida: paisaje con paneles solares y aerogeneradores. */
export function Paisaje() {
  return (
    <svg viewBox="0 0 360 180" className="paisaje" aria-hidden="true">
      <defs>
        <linearGradient id="p-sol" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="p-loma" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ee7b7" stopOpacity=".9" />
          <stop offset="1" stopColor="#10b981" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id="p-cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0ea5e9" />
          <stop offset=".65" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#bae6fd" />
        </linearGradient>
        <linearGradient id="p-panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="1" stopColor="#0e7490" />
        </linearGradient>
      </defs>
      {/* Cielo azul detrás para que las hélices blancas se vean sobre la tarjeta clara */}
      <rect width="360" height="180" rx="22" fill="url(#p-cielo)" />
      <circle className="p-sol" cx="290" cy="50" r="26" fill="url(#p-sol)" />
      <path d="M0 150 Q90 100 180 135 T360 120 V180 H0Z" fill="url(#p-loma)" />
      {[[70, 70], [130, 52], [200, 78]].map(([x, h], i) => (
        <g key={i}>
          <rect x={x - 1.5} y={150 - h} width="3" height={h} rx="1.5" fill="#fff" opacity=".95" />
          <g className="p-aspas" style={{ transformOrigin: `${x}px ${150 - h}px`, animationDuration: `${4 + i}s` }}>
            <path d={`M${x} ${150 - h} l0 -26 q3 12 0 26z`} fill="#fff" />
            <path d={`M${x} ${150 - h} l22.5 13 q-11 -4 -22.5 -13z`} fill="#fff" />
            <path d={`M${x} ${150 - h} l-22.5 13 q11 -4 22.5 -13z`} fill="#fff" />
          </g>
          <circle cx={x} cy={150 - h} r="3" fill="#0e7490" stroke="#fff" strokeWidth="1.5" />
        </g>
      ))}
      {[230, 268, 306].map((x) => (
        <g key={x}>
          <path d={`M${x} 158 l30 0 l-8 -16 l-30 0z`} fill="url(#p-panel)" stroke="#fff" strokeWidth="1.2" />
          <path d={`M${x - 4} 150 l30 0`} stroke="#fff" strokeOpacity=".5" />
          <rect x={x + 9} y="158" width="2" height="8" fill="#fff" opacity=".8" />
        </g>
      ))}
    </svg>
  );
}
