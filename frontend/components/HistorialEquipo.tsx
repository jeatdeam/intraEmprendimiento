"use client";
import { useEffect, useRef, useState } from "react";
import { ChartLine, ChevronDown, ChevronUp, CircleAlert, CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { obtenerHistorialEquipo } from "@/lib/api";
import type { HistorialEquipo as Hist, Modo } from "@/lib/types";
import { Marca } from "./Grafica";

const corta = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const diaSemana = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es", { weekday: "short" }).replace(".", "");
const num = (v: number) => v.toLocaleString("es", { maximumFractionDigits: 1 });
const larga = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });

/** Mini gráfica de una variable: banda del rango normal, línea, marcas por estado y días malos sombreados. */
function Mini({ v, fechas, malos, sel, onSel, ancho }: {
  v: Hist["variables"][number]; fechas: string[]; malos: Set<string>; sel: number; onSel: (i: number) => void; ancho: number;
}) {
  const H = 64, M = { l: 6, r: 6, t: 8, b: 8 };
  const pw = ancho - M.l - M.r, ph = H - M.t - M.b;
  const vals = fechas.map((f) => v.dias[f]?.valor).filter((x): x is number => x !== undefined);
  const lo = Math.min(...vals, v.min ?? Infinity), hi = Math.max(...vals, v.max ?? -Infinity);
  const pad = (hi - lo) * 0.12 || 1;
  const y = (x: number) => M.t + ph - ((x - (lo - pad)) / (hi - lo + 2 * pad)) * ph;
  const col = pw / fechas.length;
  const x = (i: number) => M.l + col * (i + 0.5);
  let d = "";
  fechas.forEach((f, i) => {
    const p = v.dias[f];
    if (!p) return;
    d += `${i > 0 && v.dias[fechas[i - 1]] ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)} `;
  });
  return (
    <svg width={ancho} height={H} aria-hidden="true" onMouseLeave={() => onSel(-1)}>
      {fechas.map((f, i) => malos.has(f) && <rect key={f} className="dia-malo" x={x(i) - col / 2 + 1} y={0} width={col - 2} height={H} rx={4} />)}
      {sel >= 0 && <rect className="dia-sel" x={x(sel) - col / 2 + 1} y={0} width={col - 2} height={H} rx={4} />}
      {v.min !== null && v.max !== null && (
        <rect className="banda" x={M.l} width={pw} y={y(v.max)} height={Math.max(0, y(v.min) - y(v.max))} />
      )}
      <path className="mini-linea" d={d} />
      {fechas.map((f, i) => v.dias[f] && <Marca key={f} estado={v.dias[f].estado} x={x(i)} y={y(v.dias[f].valor)} />)}
      {fechas.map((f, i) => (
        <rect key={f} className="hit" x={x(i) - col / 2} y={0} width={col} height={H} onMouseEnter={() => onSel(i)} onClick={() => onSel(i)} />
      ))}
    </svg>
  );
}

export default function HistorialEquipo({ equipo, modo }: { equipo: string; modo: Modo }) {
  const [h, setH] = useState<Hist | null>(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(true);
  const [sel, setSel] = useState(-1);
  const [fijo, setFijo] = useState(-1);
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(300);

  useEffect(() => {
    setH(null); setError(""); setFijo(-1);
    obtenerHistorialEquipo(equipo, modo).then(setH, (e) => setError((e as Error).message));
  }, [equipo, modo]);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(220, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [h, abierto]);

  const malos = new Set(h?.dias_mal ?? []);
  // Día que se muestra: el que se señala, el que se tocó, o el último día con problemas (si no hay, hoy).
  const ultimoMalo = h ? h.fechas.map((f) => malos.has(f)).lastIndexOf(true) : -1;
  const activo = sel >= 0 ? sel : fijo >= 0 ? fijo : ultimoMalo >= 0 ? ultimoMalo : (h ? h.fechas.length - 1 : -1);
  const diaActivo = h && activo >= 0 && activo < h.fechas.length ? h.fechas[activo] : null;

  return (
    <aside className="panel-equipo glass" aria-label="Historial del equipo">
      <button type="button" className="pe-cabecera" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
        <ChartLine size={20} aria-hidden="true" />
        <span><b>Días anteriores de {equipo}</b><small>Últimos 7 días reportados</small></span>
        {abierto ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
      </button>

      {abierto && (
        <>
          {error && <p className="error"><CircleAlert size={18} aria-hidden="true" /> {error}</p>}
          {!h && !error && <p className="revisando"><LoaderCircle size={18} className="gira" aria-hidden="true" /> Cargando…</p>}
          {h && (
            <>
              <div className="pe-dias" role="group" aria-label="Días">
                {h.fechas.map((f, i) => {
                  const mal = malos.has(f), hay = h.variables.some((v) => v.dias[f]);
                  return (
                    <button type="button" key={f} className={`pe-dia ${mal ? "mal" : hay ? "bien" : "vacio"} ${i === activo ? "on" : ""}`}
                      onClick={() => setFijo(i)} aria-pressed={i === activo}
                      aria-label={`${larga(f)}: ${mal ? "con problemas" : hay ? "sin problemas" : "sin datos"}`}>
                      <span>{diaSemana(f)}</span>
                      {mal ? <CircleX size={18} aria-hidden="true" /> : hay ? <CircleCheck size={18} aria-hidden="true" /> : <span className="guion">–</span>}
                      <small>{corta(f)}</small>
                    </button>
                  );
                })}
              </div>
              <p className="pe-resumen">
                {malos.size ? <><b className="st-falla">{malos.size} de 7 días</b> con valores fuera de rango o fallas.</> : <b className="st-ok">Los 7 días estuvieron bien.</b>}
              </p>

              <div ref={caja} className="pe-graficas">
                {h.variables.length === 0 && <p className="hint">Todavía no hay mediciones de este equipo.</p>}
                {h.variables.map((v) => {
                  const p = diaActivo ? v.dias[diaActivo] : undefined;
                  return (
                    <div key={v.id} className="pe-var">
                      <div className="pe-var-tit">
                        <span>{v.nombre} <small>{v.min !== null ? `normal ${num(v.min)}–${num(v.max!)} ${v.unidad}` : v.unidad}</small></span>
                        {p && <b className={`st-${p.estado}`}>{num(p.valor)} {v.unidad}</b>}
                      </div>
                      <Mini v={v} fechas={h.fechas} malos={malos} sel={activo} onSel={setSel} ancho={ancho} />
                    </div>
                  );
                })}
              </div>

              {diaActivo && (
                <div className="pe-detalle" aria-live="polite">
                  <b>{larga(diaActivo)}</b>
                  {(h.eventos[diaActivo] ?? []).length ? (
                    <ul>
                      {h.eventos[diaActivo].map((e, i) => (
                        <li key={i} className={`st-${e.estado}`}>
                          {e.estado === "falla" ? <CircleX size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
                          <span>{e.detalle}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="st-ok"><CircleCheck size={16} aria-hidden="true" /> Sin problemas este día.</p>}
                </div>
              )}
            </>
          )}
        </>
      )}
    </aside>
  );
}
