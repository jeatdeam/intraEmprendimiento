
/**
 * Íconos de los programas con los que funciona una tarea (Word, Excel, PDF, Gmail, Outlook…).
 *
 * Los que están en CON_SVG usan el archivo frontend/public/apps/<id>.svg.
 * El resto muestra una insignia propia simple (color + letra).
 * Para agregar uno: guarda el .svg en public/apps/ y suma su id a CON_SVG.
 */
const CON_SVG = new Set(["word", "excel", "pdf", "powerpoint"]);
const APPS: Record<string, { nombre: string; color: string; letra: string }> = {
  word: { nombre: "Word", color: "#185abd", letra: "W" },
  excel: { nombre: "Excel", color: "#107c41", letra: "X" },
  powerpoint: { nombre: "PowerPoint", color: "#c43e1c", letra: "P" },
  pdf: { nombre: "PDF", color: "#c5221f", letra: "PDF" },
  csv: { nombre: "CSV", color: "#3f5a4e", letra: "CSV" },
  texto: { nombre: "Texto", color: "#5f6b66", letra: "TXT" },
  gmail: { nombre: "Gmail", color: "#d93025", letra: "M" },
  outlook: { nombre: "Outlook", color: "#0f6cbd", letra: "O" },
};

function Insignia({ id, size }: { id: string; size: number }) {
  const a = APPS[id];
  const fs = a.letra.length > 1 ? size * 0.36 : size * 0.6;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <rect width={size} height={size} rx={size * 0.26} fill={a.color} />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontSize={fs} fontWeight="800"
        fontFamily="Arial, sans-serif">{a.letra}</text>
    </svg>
  );
}

export function IconoApp({ id, size = 22, titulo = false }: { id: string; size?: number; titulo?: boolean }) {
  if (!APPS[id]) return null;
  if (!CON_SVG.has(id)) return <Insignia id={id} size={size} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/apps/${id}.svg`} width={size} height={size} alt="" title={titulo ? APPS[id].nombre : undefined} />;
}

/** soloIconos: solo los íconos, sin texto ni fondo (para la parte de arriba de las tarjetas). */
export function Apps({ apps, soloIconos = false }: { apps: string[]; soloIconos?: boolean }) {
  if (soloIconos) {
    return (
      <span className="apps-iconos" role="img" aria-label={`Funciona con: ${apps.map((a) => APPS[a]?.nombre).join(", ")}`}>
        {apps.filter((a) => APPS[a]).map((a, i, lista) => {
          // Forma de "S": cada ícono sube o baja siguiendo una onda a lo ancho de la fila.
          const n = lista.length;
          const y = n >= 3 ? -11 * Math.sin((2 * Math.PI * i) / (n - 1)) : (i % 2 ? 7 : -7);
          return (
            <span key={a} className="app-onda" style={{ transform: `translateY(${y.toFixed(1)}px)` }}>
              <IconoApp id={a} size={30} titulo />
            </span>
          );
        })}
      </span>
    );
  }
  return (
    <ul className="apps" aria-label={`Funciona con: ${apps.map((a) => APPS[a]?.nombre).join(", ")}`}>
      {apps.filter((a) => APPS[a]).map((a) => (
        <li key={a} className="app"><IconoApp id={a} /> {APPS[a].nombre}</li>
      ))}
    </ul>
  );
}
