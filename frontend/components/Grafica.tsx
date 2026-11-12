"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, CircleAlert, CircleCheck, Inbox, LoaderCircle, OctagonX, RefreshCw } from "lucide-react";
import { obtenerHistorial } from "@/lib/api";
import type { DiaSerie, EstadoDato, Historial, Modo, Serie } from "@/lib/types";

const ESTADOS: Record<EstadoDato, { txt: string; Ico: typeof CircleAlert }> = {
  ok: { txt: "Normal", Ico: CircleCheck },
  bajo: { txt: "Bajo el rango", Ico: ArrowDown },
  alto: { txt: "Sobre el rango", Ico: ArrowUp },
  error: { txt: "Dato mal escrito", Ico: CircleAlert },
  falla: { txt: "Falla de máquina", Ico: OctagonX },
};
const PERIODOS = [7, 30, 90];

const fechaCorta = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
const num = (v: number) => v.toLocaleString("es", { maximumFractionDigits: 1 });

function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const d = new Date(`${desde}T12:00:00`);
  const fin = new Date(`${hasta}T12:00:00`);
  while (d <= fin) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
  return out;
}

function ticksBonitos(min: number, max: number, n = 4): number[] {
  const paso0 = (max - min) / n || 1;
  const mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((p) => p >= paso0) ?? paso0;
  const out: number[] = [];
  for (let v = Math.floor(min / paso) * paso; v <= max + paso * 0.01; v += paso) out.push(Number(v.toFixed(6)));
  return out;
}

/** Marcador con forma distinta por estado (no depende solo del color). */
export function Marca({ estado, x, y }: { estado: EstadoDato; x: number; y: number }) {
  const c = `mk mk-${estado}`;
  if (estado === "bajo") return <path className={c} d={`M${x - 6},${y - 4} L${x + 6},${y - 4} L${x},${y + 6} Z`} />;
  if (estado === "alto") return <path className={c} d={`M${x - 6},${y + 4} L${x + 6},${y + 4} L${x},${y - 6} Z`} />;
  if (estado === "error") return <rect className={c} x={x - 5} y={y - 5} width={10} height={10} rx={2} />;
  if (estado === "falla") return <path className={c} d={`M${x},${y - 7} L${x + 7},${y} L${x},${y + 7} L${x - 7},${y} Z`} />;
  return <circle className={c} cx={x} cy={y} r={4} />;
}

function Leyenda({ conBanda }: { conBanda: boolean }) {
  return (
    <ul className="leyenda" aria-label="Qué significa cada marca">
      {conBanda && <li><svg width="22" height="14" aria-hidden="true"><rect className="banda" x="0" y="1" width="22" height="12" rx="3" /></svg> Rango normal</li>}
      {(["ok", "bajo", "alto", "error", "falla"] as EstadoDato[]).map((e) => (
        <li key={e}><svg width="18" height="18" aria-hidden="true"><Marca estado={e} x={9} y={9} /></svg> {ESTADOS[e].txt}</li>
      ))}
    </ul>
  );
}

function Chart({ serie, dias, fallasForm }: { serie: Serie; dias: string[]; fallasForm: Record<string, string[]> }) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(720);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(300, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const porDia = useMemo(() => Object.fromEntries(serie.dias.map((d) => [d.fecha, d])), [serie]);
  const H = 320, M = { l: 52, r: 14, t: 18, b: 34 };
  const pw = ancho - M.l - M.r, ph = H - M.t - M.b;
  const vals = serie.dias.map((d) => d.valor).filter((v): v is number => v !== null);
  const lo = Math.min(0, ...vals, serie.min ?? 0);
  const hi = Math.max(...vals, serie.max ?? 0, 1) * 1.08;
  const ticks = ticksBonitos(lo, hi);
  const yMax = ticks[ticks.length - 1];
  const yMin = ticks[0];
  const y = (v: number) => M.t + ph - ((v - yMin) / (yMax - yMin)) * ph;
  const bandaX = pw / dias.length;
  const x = (i: number) => M.l + bandaX * (i + 0.5);
  const cadaN = Math.ceil(dias.length / Math.max(2, Math.floor(pw / 70)));

  // Línea: solo une días seguidos que tienen valor.
  let d = "";
  dias.forEach((f, i) => {
    const v = porDia[f]?.valor;
    if (v == null) return;
    const prev = i > 0 ? porDia[dias[i - 1]]?.valor : null;
    d += `${prev == null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
  });

  const tecla = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = sel ?? (e.key === "ArrowRight" ? -1 : dias.length);
    setSel(Math.min(dias.length - 1, Math.max(0, i + (e.key === "ArrowRight" ? 1 : -1))));
  };

  const fSel = sel !== null ? dias[sel] : null;
  const dSel: DiaSerie | undefined = fSel ? porDia[fSel] : undefined;
  const fallaSel = fSel ? fallasForm[fSel] : undefined;
  const izq = sel !== null && x(sel) > ancho * 0.6;

  return (
    <div className="chart" ref={caja} tabIndex={0} onKeyDown={tecla} onBlur={() => setSel(null)}
      aria-label={`Gráfica de ${serie.nombre}. Usa las flechas izquierda y derecha para recorrer los días.`}>
      <svg width={ancho} height={H} role="img" aria-hidden="true" onMouseLeave={() => setSel(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={M.l} x2={ancho - M.r} y1={y(t)} y2={y(t)} />
            <text className="eje" x={M.l - 8} y={y(t) + 4} textAnchor="end">{num(t)}</text>
          </g>
        ))}
        {serie.min !== null && serie.max !== null && (
          <g>
            <rect className="banda" x={M.l} width={pw} y={y(serie.max)} height={Math.max(0, y(serie.min) - y(serie.max))} />
            <line className="banda-borde" x1={M.l} x2={ancho - M.r} y1={y(serie.max)} y2={y(serie.max)} />
            <line className="banda-borde" x1={M.l} x2={ancho - M.r} y1={y(serie.min)} y2={y(serie.min)} />
            <text className="eje banda-txt" x={ancho - M.r - 6} y={y(serie.max) + 15} textAnchor="end">
              Rango normal {num(serie.min)}–{num(serie.max)} {serie.unidad}
            </text>
          </g>
        )}
        {dias.map((f, i) => (i % cadaN === 0 || i === dias.length - 1) && (
          <text key={f} className="eje" x={x(i)} y={H - 10} textAnchor="middle">{fechaCorta(f)}</text>
        ))}
        <text className="eje" x={8} y={12}>{serie.unidad}</text>
        {sel !== null && <line className="cruz" x1={x(sel)} x2={x(sel)} y1={M.t} y2={M.t + ph} />}
        <path className="linea" d={d} />
        {dias.map((f, i) => {
          const p = porDia[f];
          return (
            <g key={f}>
              {p?.valor != null && <Marca estado={p.estado} x={x(i)} y={y(p.valor)} />}
              {fallasForm[f] && <Marca estado="falla" x={x(i)} y={M.t + ph - 2} />}
            </g>
          );
        })}
        {dias.map((f, i) => (
          <rect key={f} className="hit" x={x(i) - bandaX / 2} y={M.t} width={bandaX} height={ph}
            onMouseEnter={() => setSel(i)} />
        ))}
      </svg>
      {fSel && (
        <div className="tooltip" style={{ left: x(sel!), transform: `translateX(${izq ? "calc(-100% - 14px)" : "14px"})` }}>
          <b>{fechaLarga(fSel)}</b>
          {dSel ? (
            <>
              <span className="tt-valor">{dSel.valor != null ? `${num(dSel.valor)} ${serie.unidad}` : "Sin valor"}
                {dSel.registros > 1 && <small> (promedio de {dSel.registros})</small>}</span>
              <span className={`estado st-${dSel.estado}`}>{(() => { const { Ico, txt } = ESTADOS[dSel.estado]; return <><Ico size={15} aria-hidden="true" /> {txt}</>; })()}</span>
              {dSel.detalle.map((t) => <small key={t}>{t}</small>)}
            </>
          ) : <small>Sin datos este día</small>}
          {fallaSel && <span className="estado st-falla"><OctagonX size={15} aria-hidden="true" /> Falla reportada: {fallaSel.join(", ")}</span>}
        </div>
      )}
    </div>
  );
}

export default function Grafica({ modo, onVolver }: { modo: Modo; onVolver: () => void }) {
  const [dias, setDias] = useState(30);
  const [hist, setHist] = useState<Historial | null>(null);
  const [serieId, setSerieId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargar(n = dias) {
    setCargando(true);
    setError("");
    try {
      const h = await obtenerHistorial(modo, n);
      setHist(h);
      setSerieId((s) => (h.series.some((x) => x.id === s) ? s : h.series.find((x) => x.min !== null)?.id ?? h.series[0]?.id ?? ""));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(dias); }, [dias, modo]);

  const serie = hist?.series.find((s) => s.id === serieId);
  const rango = hist ? diasEntre(hist.desde, hist.hasta) : [];
  // Fallas reportadas con el formulario que mencionan al equipo de la serie elegida.
  const fallasForm = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (!hist || !serie || serie.nombre === "Fallas reportadas") return out;
    const codigo = serie.nombre.split(" (")[0].toLowerCase();
    hist.series.find((s) => s.nombre === "Fallas reportadas")?.dias.forEach((d) => {
      const m = d.detalle.filter((t) => t.toLowerCase().includes(codigo));
      if (m.length) out[d.fecha] = m;
    });
    return out;
  }, [hist, serie]);
  const diasFalla = hist ? new Set(hist.alertas.filter((a) => a.estado === "falla").map((a) => a.fecha)).size : 0;
  const diasAlerta = hist ? new Set(hist.alertas.map((a) => a.fecha)).size : 0;

  return (
    <>
      <button className="back" onClick={onVolver}><ArrowLeft size={20} aria-hidden="true" /> Volver a las tareas</button>
      <header className="cabecera glass">
        <h1 tabIndex={-1}>Gráfica diaria</h1>
        <p className="lead">
          Valores de cada día según los formularios enviados y los archivos revisados
          {modo === "practica" ? " en modo práctica (datos ficticios)" : ""}. Las marcas muestran los días fuera de rango o con fallas.
        </p>
      </header>

      <div className="filtros">
        <label className="field sin-margen">
          <span className="label">Qué ver</span>
          <select value={serieId} onChange={(e) => setSerieId(e.target.value)} disabled={!hist?.series.length}>
            {hist?.series.map((s) => <option key={s.id} value={s.id}>{s.nombre}{s.alertas ? ` · ${s.alertas} días con alerta` : ""}</option>)}
          </select>
        </label>
        <div className="segmento" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button key={p} className={p === dias ? "on" : ""} aria-pressed={p === dias} onClick={() => setDias(p)}>{p} días</button>
          ))}
        </div>
        <button className="hbtn" onClick={() => cargar()}><RefreshCw size={18} aria-hidden="true" /> Actualizar</button>
      </div>

      {error && <p className="error" role="alert"><CircleAlert size={20} aria-hidden="true" /> {error}</p>}
      {cargando && !hist && <p className="revisando"><LoaderCircle size={20} className="gira" aria-hidden="true" /> Cargando…</p>}

      {hist && (
        <>
          <div className="tiles">
            <div className="tile glass"><span>Envíos en {dias} días</span><b>{hist.envios.total}</b></div>
            <div className="tile glass"><span>Días con alguna alerta</span><b>{diasAlerta}</b></div>
            <div className="tile glass"><span>Días con falla de máquina</span><b>{diasFalla}</b></div>
          </div>

          {!hist.series.length ? (
            <div className="panel glass vacio">
              <Inbox size={40} aria-hidden="true" />
              <p><b>Todavía no hay datos para graficar.</b><br />
                Envía un <i>Reporte de turno</i>, unas <i>Lecturas de producción</i>, una <i>Falla</i> o revisa un
                <i> archivo de datos</i> y aparecerán aquí.</p>
            </div>
          ) : serie && (
            <div className="panel glass">
              <h2>{serie.nombre}</h2>
              {serie.dias.some((d) => d.valor !== null) ? (
                <>
                  <Chart key={serie.id + dias} serie={serie} dias={rango} fallasForm={fallasForm} />
                  <Leyenda conBanda={serie.min !== null} />
                  <details>
                    <summary>Ver los valores diarios en tabla</summary>
                    <div className="tabla-scroll">
                      <table className="tabla">
                        <thead><tr><th>Día</th><th>Valor ({serie.unidad})</th><th>Estado</th><th>Detalle</th></tr></thead>
                        <tbody>
                          {[...serie.dias].reverse().map((d) => {
                            const { Ico, txt } = ESTADOS[d.estado];
                            return (
                              <tr key={d.fecha}>
                                <td>{fechaCorta(d.fecha)}</td>
                                <td className="num">{d.valor != null ? num(d.valor) : "—"}</td>
                                <td><span className={`estado st-${d.estado}`}><Ico size={15} aria-hidden="true" /> {txt}</span></td>
                                <td>{d.detalle.join(" · ")}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              ) : (
                <p className="hint">Esta serie no tiene valores numéricos: son avisos. Míralos en la lista de abajo.</p>
              )}
            </div>
          )}

          {hist.alertas.length > 0 && (
            <div className="panel glass">
              <h2>Días fuera de rango o con fallas</h2>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead><tr><th>Día</th><th>Qué / quién</th><th>Qué pasó</th><th>Detalle</th></tr></thead>
                  <tbody>
                    {hist.alertas.map((a, i) => {
                      const { Ico, txt } = ESTADOS[a.estado];
                      return (
                        <tr key={i}>
                          <td>{fechaCorta(a.fecha)}</td>
                          <td>{a.serie}</td>
                          <td><span className={`estado st-${a.estado}`}><Ico size={15} aria-hidden="true" /> {txt}</span></td>
                          <td>{a.detalle.join(" · ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {hist.envios.por_tarea.length > 0 && (
            <div className="panel glass">
              <h2>Formularios enviados</h2>
              <ul className="envios">
                {hist.envios.por_tarea.map((e) => <li key={e.tarea}><span>{e.tarea}</span><b>{e.n}</b></li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}
