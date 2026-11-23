"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, ChevronDown, CircleAlert, CircleCheck, Database, LoaderCircle, RefreshCw, Sparkles,
  TriangleAlert, OctagonAlert,
} from "lucide-react";
import { obtenerInspecciones } from "@/lib/api";
import type { Inspeccion, MedidaInspeccion, Modo } from "@/lib/types";
import { fechaHora } from "./MiHistorial";

const VARIABLES = [
  { id: "Voltaje", corto: "Voltaje", u: "V" },
  { id: "Corriente", corto: "Corriente", u: "A" },
  { id: "Temperatura", corto: "Temp.", u: "°C" },
  { id: "Vibración", corto: "Vibración", u: "mm/s" },
] as const;

const ESTADOS: Record<Inspeccion["estado"], { txt: string; cls: string; Ico: typeof CircleCheck }> = {
  ok: { txt: "Normal", cls: "st-ok", Ico: CircleCheck },
  alerta: { txt: "Fuera de rango", cls: "st-bajo", Ico: TriangleAlert },
  falla: { txt: "Con falla", cls: "st-error", Ico: CircleAlert },
  critico: { txt: "Crítico", cls: "st-falla", Ico: OctagonAlert },
};

const num = (v: number) => v.toLocaleString("es", { maximumFractionDigits: 1 });

function Celda({ m }: { m?: MedidaInspeccion }) {
  if (!m) return <td className="num tenue">—</td>;
  const fuera = m.estado !== "ok";
  return (
    <td className={`num ${fuera ? "st-bajo fuera" : ""}`} title={`Normal: ${num(m.min)}–${num(m.max)} ${m.unidad}`}>
      {fuera && (m.estado === "alto" ? <ArrowUp size={13} aria-label="alto" /> : <ArrowDown size={13} aria-label="bajo" />)}
      {num(m.valor)}
    </td>
  );
}

export default function BaseInspecciones({ modo, resaltar, volverA, onVolver }: {
  modo: Modo; resaltar: number | null; volverA: string; onVolver: () => void;
}) {
  const [filas, setFilas] = useState<Inspeccion[] | null>(null);
  const [error, setError] = useState("");
  const [equipo, setEquipo] = useState("");
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(resaltar);
  const nueva = useRef<HTMLTableRowElement>(null);

  const cargar = () => {
    setError("");
    obtenerInspecciones(modo).then(setFilas, (e) => setError((e as Error).message));
  };
  useEffect(cargar, [modo]);   // eslint-disable-line react-hooks/exhaustive-deps

  // La inspección recién enviada queda a la vista
  useEffect(() => {
    if (filas && resaltar) nueva.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [filas, resaltar]);

  const equipos = useMemo(() => {
    const m = new Map<string, string>();
    filas?.forEach((f) => m.set(f.equipo.id, f.equipo.nombre));
    return [...m].sort(([a], [b]) => a.localeCompare(b));
  }, [filas]);

  const vista = (filas ?? []).filter((f) => (!equipo || f.equipo.id === equipo) && (!soloAlertas || f.estado !== "ok"));
  const cuenta = {
    total: vista.length,
    equipos: new Set(vista.map((f) => f.equipo.id)).size,
    fallas: vista.filter((f) => f.falla).length,
    fuera: vista.filter((f) => Object.values(f.medidas).some((m) => m && m.estado !== "ok")).length,
  };

  return (
    <>
      <button className="back" onClick={onVolver}><ArrowLeft size={20} aria-hidden="true" /> {volverA}</button>
      <header className="cabecera glass hist-cabecera">
        <span className="burbuja"><Database size={22} aria-hidden="true" /></span>
        <div>
          <h1 tabIndex={-1} style={{ margin: 0 }}>Base de datos de inspecciones</h1>
          <p className="lead" style={{ margin: "4px 0 0" }}>
            Cada inspección enviada se guarda aquí con sus mediciones, la falla encontrada y quién la hizo.
            {modo === "practica" ? " Estás en modo práctica: son datos ficticios." : ""}
          </p>
        </div>
      </header>

      <div className="bd-resumen">
        <div className="panel glass"><b>{cuenta.total}</b><span>inspecciones</span></div>
        <div className="panel glass"><b>{cuenta.equipos}</b><span>equipos</span></div>
        <div className="panel glass"><b className="st-bajo">{cuenta.fuera}</b><span>con mediciones fuera de rango</span></div>
        <div className="panel glass"><b className="st-error">{cuenta.fallas}</b><span>con falla registrada</span></div>
      </div>

      <div className="filtros">
        <div className="field">
          <label htmlFor="bd-equipo">Equipo</label>
          <select id="bd-equipo" value={equipo} onChange={(e) => setEquipo(e.target.value)}>
            <option value="">Todos los equipos</option>
            {equipos.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>
        </div>
        <label className="bd-check">
          <input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} />
          Solo las que tienen alertas o fallas
        </label>
        <button className="hbtn" onClick={cargar}><RefreshCw size={16} aria-hidden="true" /> Actualizar</button>
      </div>

      <section className="panel glass">
        {error && <p className="error" role="alert"><CircleAlert size={20} aria-hidden="true" /> {error}</p>}
        {!filas && !error && <p className="bd-cargando"><LoaderCircle className="gira" size={20} aria-hidden="true" /> Cargando inspecciones…</p>}
        {filas && !vista.length && <p className="bd-cargando">No hay inspecciones con ese filtro.</p>}
        {vista.length > 0 && (
          <div className="tabla-scroll">
            <table className="tabla bd-tabla">
              <thead>
                <tr>
                  <th>N°</th><th>Fecha</th><th>Equipo</th><th>Inspector</th>
                  {VARIABLES.map((v) => <th key={v.id} className="num">{v.corto} <small>({v.u})</small></th>)}
                  <th>Falla</th><th>Estado</th><th aria-label="Ver detalle" />
                </tr>
              </thead>
              <tbody>
                {vista.map((f) => {
                  const st = ESTADOS[f.estado];
                  const esNueva = f.id === resaltar;
                  const ver = abierta === f.id;
                  return (
                    <Fragment key={f.id}>
                      <tr ref={esNueva ? nueva : undefined} className={`bd-fila ${esNueva ? "nueva" : ""} ${ver ? "abierta" : ""}`}
                        onClick={() => setAbierta(ver ? null : f.id)}>
                        <td className="num tenue">#{f.id}</td>
                        <td className="bd-fecha">
                          {fechaHora(f.creado)}
                          {esNueva && <span className="tag bd-nueva"><Sparkles size={11} aria-hidden="true" /> Recién guardada</span>}
                        </td>
                        <td><b>{f.equipo.id}</b><small className="bd-sub">{f.equipo.tipo}</small></td>
                        <td>{f.inspector || "—"}{f.ejemplo && <small className="bd-sub">datos de ejemplo</small>}</td>
                        {VARIABLES.map((v) => <Celda key={v.id} m={f.medidas[v.id]} />)}
                        <td>{f.falla ? <>{f.falla}<small className="bd-sub">gravedad {f.gravedad.toLowerCase()}</small></> : <span className="tenue">Sin falla</span>}</td>
                        <td><span className={`estado ${st.cls}`}><st.Ico size={15} aria-hidden="true" /> {st.txt}</span></td>
                        <td>
                          <button className="bd-ver" aria-expanded={ver} aria-label={ver ? "Ocultar detalle" : "Ver detalle"}
                            onClick={(e) => { e.stopPropagation(); setAbierta(ver ? null : f.id); }}>
                            <ChevronDown size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                      {ver && (
                        <tr className="bd-detalle">
                          <td colSpan={11}>
                            <p><b>{f.equipo.nombre}</b> · {f.equipo.ubicacion}</p>
                            <p>{f.detalle || "Sin observaciones."}</p>
                            <p className="bd-rangos">
                              {VARIABLES.map((v) => {
                                const m = f.medidas[v.id];
                                return m ? <span key={v.id}>{v.id}: normal {num(m.min)}–{num(m.max)} {m.unidad}</span> : null;
                              })}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
