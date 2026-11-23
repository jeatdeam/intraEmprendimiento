"use client";
/**
 * Panel al costado del formulario: los reportes anteriores de esa tarea (de toda la planta, últimos 7 días),
 * un calendario con el estado de cada día y un botón que abre la gráfica de lo que se midió en esos reportes
 * (voltaje, temperatura, energía…). Si la tarea no mide nada, la gráfica es cuántos reportes hubo cada día.
 */
import { useEffect, useRef, useState } from "react";
import { ChartColumn, ChartLine, ChevronDown, ChevronUp, CircleAlert, CircleCheck, CircleX, FileText, History, LoaderCircle } from "lucide-react";
import { obtenerReportesTarea } from "@/lib/api";
import type { Area, EstadoDato, Modo, ReportesTarea } from "@/lib/types";
import { Mini } from "./HistorialEquipo";
import { fechaHora } from "./MiHistorial";

const corta = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const diaSemana = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es", { weekday: "short" }).replace(".", "");
const larga = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
const num = (v: number) => v.toLocaleString("es", { maximumFractionDigits: 1 });

const ESTADO: Record<EstadoDato, { txt: string; cls: string; Ico: typeof CircleCheck }> = {
  ok: { txt: "Normal", cls: "st-ok", Ico: CircleCheck },
  bajo: { txt: "Bajo", cls: "st-bajo", Ico: CircleAlert },
  alto: { txt: "Alto", cls: "st-alto", Ico: CircleAlert },
  error: { txt: "Con errores", cls: "st-error", Ico: CircleAlert },
  falla: { txt: "Con falla", cls: "st-falla", Ico: CircleX },
};

/** Barras: cuántos reportes hubo cada día (para las tareas que no miden nada). */
function Barras({ fechas, conteo, malos, sel, onSel, ancho }: {
  fechas: string[]; conteo: Record<string, number>; malos: Set<string>; sel: number; onSel: (i: number) => void; ancho: number;
}) {
  const H = 70, max = Math.max(1, ...Object.values(conteo));
  const col = ancho / fechas.length;
  return (
    <svg width={ancho} height={H + 14} aria-hidden="true" onMouseLeave={() => onSel(-1)}>
      {fechas.map((f, i) => {
        const n = conteo[f] ?? 0, h = (n / max) * (H - 14);
        return (
          <g key={f} onMouseEnter={() => onSel(i)}>
            {i === sel && <rect className="dia-sel" x={i * col + 1} y={0} width={col - 2} height={H} rx={4} />}
            <rect className={`ra-barra ${malos.has(f) ? "mal" : ""}`} x={i * col + col * 0.22} y={H - h} width={col * 0.56} height={h} rx={4} />
            {n > 0 && <text className="ra-barra-n" x={i * col + col / 2} y={H - h - 4} textAnchor="middle">{n}</text>}
            <text className="ra-barra-d" x={i * col + col / 2} y={H + 12} textAnchor="middle">{corta(f)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ReportesAnteriores({ area, tarea, nombreTarea, modo, equipo }: {
  area: Area; tarea: string; nombreTarea: string; modo: Modo; equipo?: string;
}) {
  const [r, setR] = useState<ReportesTarea | null>(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(true);
  const [grafica, setGrafica] = useState(false);
  const [dia, setDia] = useState<string | null>(null);        // día elegido en el calendario (null = todos)
  const [verId, setVerId] = useState<number | null>(null);    // reporte desplegado
  const [sel, setSel] = useState(-1);
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(300);

  useEffect(() => {
    let vigente = true;
    setR(null); setError(""); setDia(null); setVerId(null);
    obtenerReportesTarea(area, tarea, modo, equipo).then((x) => { if (vigente) setR(x); }, (e) => { if (vigente) setError((e as Error).message); });
    return () => { vigente = false; };
  }, [area, tarea, modo, equipo]);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(220, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [r, abierto, grafica]);

  const malos = new Set(r?.dias_mal ?? []);
  const lista = r ? r.envios.filter((e) => !dia || e.dia === dia) : [];
  const conAlerta = r ? r.envios.filter((e) => e.estado !== "ok").length : 0;
  const iDia = r && dia ? r.fechas.indexOf(dia) : -1;

  return (
    <aside className="panel-equipo glass ra" aria-label="Reportes anteriores">
      <button type="button" className="pe-cabecera" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
        <History size={20} aria-hidden="true" />
        <span>
          <b>Reportes anteriores{equipo ? ` de ${equipo}` : ""}</b>
          <small>{nombreTarea} · últimos 7 días{r ? ` · ${r.envios.length} ${r.envios.length === 1 ? "reporte" : "reportes"}` : ""}</small>
        </span>
        {abierto ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
      </button>

      {abierto && (
        <>
          {error && <p className="error"><CircleAlert size={18} aria-hidden="true" /> {error}</p>}
          {!r && !error && <p className="revisando"><LoaderCircle size={18} className="gira" aria-hidden="true" /> Cargando…</p>}
          {r && (
            <>
              <div className="pe-dias" role="group" aria-label="Días (toca uno para ver solo sus reportes)">
                {r.fechas.map((f) => {
                  const n = r.conteo[f] ?? 0, mal = malos.has(f);
                  return (
                    <button type="button" key={f} className={`pe-dia ${mal ? "mal" : n ? "bien" : "vacio"} ${dia === f ? "on" : ""}`}
                      onClick={() => setDia(dia === f ? null : f)} aria-pressed={dia === f}
                      aria-label={`${larga(f)}: ${n ? `${n} ${n === 1 ? "reporte" : "reportes"}${mal ? ", con alertas" : ""}` : "sin reportes"}`}>
                      <span>{diaSemana(f)}</span>
                      {mal ? <CircleX size={18} aria-hidden="true" /> : n ? <CircleCheck size={18} aria-hidden="true" /> : <span className="guion">–</span>}
                      <small>{corta(f)}</small>
                      {n > 0 && <i className="ra-n">{n}</i>}
                    </button>
                  );
                })}
              </div>
              <p className="pe-resumen">
                {r.envios.length === 0 ? "Todavía no hay reportes de esta tarea."
                  : conAlerta ? <><b className="st-falla">{conAlerta} de {r.envios.length} reportes</b> con alertas, fallas o formato no aceptado.</>
                    : <b className="st-ok">Todos los reportes estuvieron bien.</b>}
              </p>

              {r.envios.length > 0 && (
                <>
                  <div className="ra-lista-tit">
                    <span>{dia ? `Reportes del ${larga(dia)}` : "Todos los reportes"}</span>
                    {dia && <button type="button" className="ra-todos" onClick={() => setDia(null)}>Ver todos</button>}
                  </div>
                  <ul className="ra-lista">
                    {lista.map((e) => {
                      const st = ESTADO[e.estado] ?? ESTADO.ok, ver = verId === e.id;
                      return (
                        <li key={e.id} className={ver ? "abierto" : ""}>
                          <button type="button" className="ra-item" onClick={() => setVerId(ver ? null : e.id)} aria-expanded={ver}>
                            <FileText size={16} aria-hidden="true" />
                            <span className="ra-item-txt">
                              <b>{e.archivo || e.resumen || e.campos.slice(0, 2).map((c) => c.valor).join(" · ") || `${nombreTarea}${equipo ? ` de ${equipo}` : ""}`}</b>
                              <small>{fechaHora(e.creado)} · {e.nombre || "—"}</small>
                            </span>
                            <span className={`estado ${st.cls}`}><st.Ico size={14} aria-hidden="true" /> {st.txt}</span>
                          </button>
                          {ver && (
                            <div className="ra-detalle">
                              {e.archivo && e.resumen && <p>{e.resumen}</p>}
                              {e.campos.map((c) => (
                                <p key={c.label}><b>{c.label}:</b> {c.valor.length > 220 ? `${c.valor.slice(0, 217)}…` : c.valor}</p>
                              ))}
                              {e.ejemplo && <p className="hint">Reporte de ejemplo (demo).</p>}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <button type="button" className="btn sec ra-btn-graf" onClick={() => setGrafica((g) => !g)} aria-expanded={grafica}>
                    {r.series.length ? <ChartLine size={18} aria-hidden="true" /> : <ChartColumn size={18} aria-hidden="true" />}
                    {grafica ? "Ocultar gráfica" : r.series.length ? "Ver gráfica de lo medido" : "Ver gráfica de reportes por día"}
                  </button>
                </>
              )}

              {grafica && (
                <div ref={caja} className="pe-graficas ra-graficas">
                  {r.series.length ? r.series.map((v) => {
                    const f = sel >= 0 ? r.fechas[sel] : dia ?? [...r.fechas].reverse().find((x) => v.dias[x]);
                    const p = f ? v.dias[f] : undefined;
                    return (
                      <div key={v.id} className="pe-var">
                        <div className="pe-var-tit">
                          <span>{v.nombre} <small>{v.min !== null && v.max !== null ? `normal ${num(v.min)}–${num(v.max)} ${v.unidad}` : v.unidad}</small></span>
                          {p && <b className={`st-${p.estado}`}>{num(p.valor)} {v.unidad}{f ? ` · ${corta(f)}` : ""}</b>}
                        </div>
                        <Mini v={v} fechas={r.fechas} malos={malos} sel={sel >= 0 ? sel : iDia} onSel={setSel} ancho={ancho} />
                      </div>
                    );
                  }) : (
                    <div className="pe-var">
                      <div className="pe-var-tit"><span>Reportes enviados por día</span></div>
                      <Barras fechas={r.fechas} conteo={r.conteo} malos={malos} sel={sel >= 0 ? sel : iDia} onSel={setSel} ancho={ancho} />
                    </div>
                  )}
                  <p className="hint">Los días sombreados tuvieron alertas. Pasa el cursor por la gráfica para ver cada día.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </aside>
  );
}
