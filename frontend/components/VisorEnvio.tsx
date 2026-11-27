"use client";
/**
 * Panel que se abre a la derecha al tocar un archivo ya enviado: muestra el documento (o la tabla del archivo de
 * datos) y POR QUÉ fue aceptado o no: los puntos del formato oficial que cumple y los que no.
 *
 * Con `usuario` abre un envío de esa persona; con `modo` (sin usuario) abre un reporte anterior de toda la planta
 * (panel "Reportes anteriores"), que también puede ser una consulta sin archivo: entonces muestra lo que se escribió
 * y el documento que entregó la IA.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck, CircleX, FileText, LoaderCircle, Upload, X } from "lucide-react";
import { obtenerMotivo, obtenerReporte } from "@/lib/api";
import type { Modo, MotivoEnvio, ReporteVisto } from "@/lib/types";
import Documento from "./Documento";
import { fechaHora } from "./MiHistorial";

export default function VisorEnvio({ usuario, modo, envio, planta = "Central Renovable", onUsar, onCerrar }: {
  usuario?: string; modo?: Modo; envio: number; planta?: string; onUsar?: () => void; onCerrar: () => void;
}) {
  const [m, setM] = useState<MotivoEnvio | ReporteVisto | null>(null);
  const [error, setError] = useState("");
  const cerrar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let vigente = true;
    setM(null); setError("");
    const pedido: Promise<MotivoEnvio | ReporteVisto> = usuario ? obtenerMotivo(usuario, envio) : obtenerReporte(envio, modo ?? "real");
    pedido.then((x) => { if (vigente) setM(x); }, (e) => { if (vigente) setError((e as Error).message); });
    return () => { vigente = false; };
  }, [usuario, modo, envio]);

  useEffect(() => {
    cerrar.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCerrar]);

  const grupos = m?.tipo === "documento" ? [...new Set(m.checks.map((c) => c.grupo))] : [];
  const fallan = m?.tipo === "documento" ? m.checks.filter((c) => !c.ok) : [];
  const rep = m && "resultado" in m ? m : null;      // reporte anterior: trae lo escrito y el resultado de la IA

  // Va directo al <body>: dentro del formulario, el vidrio (backdrop-filter) encerraría el panel fijo.
  return createPortal(
    <div className="visor-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <aside className="visor glass" role="dialog" aria-modal="true" aria-labelledby="visor-t">
        <header className="visor-top">
          <FileText size={20} aria-hidden="true" />
          <div>
            <b id="visor-t">{m?.archivo ?? rep?.tarea ?? "Archivo enviado"}</b>
            {m && <small>Enviado el {fechaHora(m.creado)}{rep?.nombre ? ` por ${rep.nombre}` : ""}{rep ? ` · skill ${rep.skill}` : ""}</small>}
          </div>
          <button ref={cerrar} type="button" className="chat-icono" onClick={onCerrar} aria-label="Cerrar"><X size={19} aria-hidden="true" /></button>
        </header>

        <div className="visor-cuerpo">
          {error && <p className="error" role="alert"><CircleAlert size={18} aria-hidden="true" /> {error}</p>}
          {!m && !error && <p className="revisando"><LoaderCircle size={18} className="gira" aria-hidden="true" /> Cargando el archivo…</p>}

          {m?.tipo === "consulta" && (
            <>
              {rep && rep.campos.length > 0 && (
                <section className="visor-porque">
                  <h3>Lo que se escribió</h3>
                  <dl className="visor-campos">
                    {rep.campos.map((c) => <div key={c.label}><dt>{c.label}</dt><dd>{c.valor}</dd></div>)}
                  </dl>
                </section>
              )}
              <section className="visor-doc">
                <h3>El documento que entregó la IA</h3>
                {rep?.resultado
                  ? <div className="result"><Documento texto={rep.resultado} planta={planta} fecha={m.creado} /></div>
                  : <p className="hint">De este reporte solo se guardaron los datos que se escribieron, no el documento.</p>}
              </section>
            </>
          )}

          {m && m.tipo !== "consulta" && (
            <>
              <div className={`veredicto ${m.aceptado ? "si" : "no"}`}>
                {m.aceptado ? <CircleCheck size={26} aria-hidden="true" /> : <CircleX size={26} aria-hidden="true" />}
                <div>
                  <b>{m.tipo === "documento" ? (m.aceptado ? "Documento aceptado" : "Documento no aceptado")
                    : (m.aceptado ? "Archivo sin alertas" : "Archivo con alertas")}</b>
                  <span>{m.tipo === "documento" ? `Cumple ${m.cumple} de ${m.total} puntos del formato ${m.formato} (${m.codigo})`
                    : `${m.filas} filas de ${m.resumen.equipos} equipos`}</span>
                </div>
              </div>

              <section className="visor-porque">
                <h3>¿Por qué {m.aceptado ? "fue aceptado" : "no fue aceptado"}?</h3>
                {m.tipo === "documento" ? (
                  <>
                    <p>
                      {m.aceptado
                        ? <>Tiene todo lo que pide el formato oficial <b>{m.codigo}</b>: el código y la revisión, los datos de la cabecera
                          completos y válidos, todas las secciones obligatorias con contenido y en el orden correcto, y las firmas.</>
                        : <>No cumple {fallan.length === 1 ? "1 punto" : `${fallan.length} puntos`} del formato oficial <b>{m.codigo}</b>:
                          {" "}{fallan.map((c) => c.label.toLowerCase()).join(", ")}. Para que sea aceptado debe cumplir todos.</>}
                    </p>
                    {grupos.map((g) => (
                      <div key={g} className="checks">
                        <span className="checks-tit">{g}</span>
                        <ul>
                          {m.checks.filter((c) => c.grupo === g).map((c) => (
                            <li key={c.label} className={c.ok ? "st-ok" : "st-falla"}>
                              {c.ok ? <CircleCheck size={16} aria-hidden="true" /> : <CircleX size={16} aria-hidden="true" />}
                              <span><b>{c.label}</b>{!c.ok && <> — {c.detalle}</>}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {m.observaciones.length > 0 && (
                      <ul className="estructura">{m.observaciones.map((o) => <li key={o}><CircleAlert size={15} aria-hidden="true" /> {o}</li>)}</ul>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      {m.aceptado
                        ? <>Todas las filas tienen las columnas de la plantilla, valores posibles y dentro de los rangos normales de cada equipo.</>
                        : <>Se encontraron <b>{m.resumen.errores}</b> errores, <b>{m.resumen.bajos + m.resumen.altos}</b> valores fuera de rango
                          y <b>{m.resumen.fallas}</b> posibles fallas. {m.resumen.validas} de {m.filas} filas están bien.</>}
                    </p>
                    {m.estructura.length > 0 && <ul className="estructura">{m.estructura.map((o) => <li key={o}><CircleAlert size={15} aria-hidden="true" /> {o}</li>)}</ul>}
                    {m.problemas.length > 0 && (
                      <ul className="visor-problemas">
                        {m.problemas.slice(0, 12).map((p, i) => (
                          <li key={i} className={p.tipo === "error" || p.tipo === "falla" ? "st-falla" : "st-bajo"}>
                            <CircleAlert size={15} aria-hidden="true" />
                            <span><b>Fila {p.fila} · {p.columna}</b> ({p.valor || "vacío"}): {p.mensaje}</span>
                          </li>
                        ))}
                        {m.problemas.length > 12 && <li className="hint">… y {m.problemas.length - 12} más.</li>}
                      </ul>
                    )}
                  </>
                )}
              </section>

              <section className="visor-doc">
                <h3>{m.tipo === "documento" ? "El documento enviado" : "El archivo enviado (primeras filas)"}</h3>
                {m.tipo === "documento" ? (
                  <div className="result"><Documento texto={m.documento} planta={planta} /></div>
                ) : (
                  <div className="tabla-scroll">
                    <table className="tabla">
                      <thead><tr>{m.tabla[0]?.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
                      <tbody>{m.tabla.slice(1).map((f, i) => <tr key={i}>{f.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                )}
              </section>

              {rep?.resultado && (
                <details className="visor-doc visor-ia">
                  <summary>Ver lo que respondió la IA</summary>
                  <div className="result"><Documento texto={rep.resultado} planta={planta} fecha={m.creado} /></div>
                </details>
              )}
            </>
          )}
        </div>

        {onUsar && m && (
          <footer className="visor-pie">
            <button type="button" className="btn pri" onClick={() => { onUsar(); onCerrar(); }}>
              <Upload size={18} aria-hidden="true" /> Usar este archivo en el formulario
            </button>
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}
