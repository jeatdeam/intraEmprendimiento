"use client";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { CircleAlert, CircleCheck, CircleX, Copy, FileCheck, GripVertical, LoaderCircle, RotateCcw, ScanSearch, Upload, X } from "lucide-react";
import { compararDocumento, evaluarListo, obtenerListos } from "@/lib/api";
import type { Comparacion, Listo, Usuario } from "@/lib/types";
import AntesDespues from "./AntesDespues";
import { IconoApp } from "./Apps";

const EXTENSION: Record<string, string> = {
  docx: "word", pdf: "pdf", pptx: "powerpoint", xlsx: "excel", xlsm: "excel", csv: "csv", txt: "texto", md: "texto",
};
/** Programa con el que se abre un archivo, según su extensión (para el ícono). */
export const appDeArchivo = (archivo: string) => EXTENSION[archivo.split(".").pop()?.toLowerCase() ?? ""] ?? "texto";

/** Lo que está en el recuadro: uno de los archivos listos o un documento propio soltado desde el equipo. */
type EnRecuadro = { listo: Listo; propio?: undefined } | { propio: File; listo?: undefined };

/**
 * Archivos ficticios listos para evaluar: se arrastran (o se tocan) al recuadro, y al pulsar Evaluar se ve si
 * pasan el formato oficial, con las dos hojas del antes y el después. Nada de esto se guarda en el historial.
 */
export default function ListosParaEvaluar({ usuario, onAviso }: { usuario: Usuario; onAviso: (msg: string) => void }) {
  const [listos, setListos] = useState<Listo[] | null>(null);
  const [error, setError] = useState("");
  const [enRecuadro, setEnRecuadro] = useState<EnRecuadro | null>(null);
  const [encima, setEncima] = useState(false);
  const [evaluando, setEvaluando] = useState(false);
  const [resultado, setResultado] = useState<Comparacion | null>(null);
  const [veredictos, setVeredictos] = useState<Record<string, boolean>>({});
  const refResultado = useRef<HTMLDivElement>(null);
  const refArchivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vigente = true;
    setListos(null);
    setEnRecuadro(null);
    setResultado(null);
    setVeredictos({});
    setError("");
    obtenerListos(usuario.id).then((l) => { if (vigente) setListos(l); }, (e: Error) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [usuario.id]);

  useEffect(() => {
    if (!resultado) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    refResultado.current?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
  }, [resultado]);

  const poner = (x: EnRecuadro | null) => { setEnRecuadro(x); setResultado(null); setError(""); };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setEncima(false);
    const propio = e.dataTransfer.files?.[0];
    if (propio) return poner({ propio });
    const listo = listos?.find((l) => l.id === e.dataTransfer.getData("text/plain"));
    if (listo) poner({ listo });
  };

  const evaluar = async () => {
    if (!enRecuadro) return;
    setEvaluando(true);
    setError("");
    try {
      const res = enRecuadro.listo ? await evaluarListo(usuario.id, enRecuadro.listo.id) : await compararDocumento(enRecuadro.propio);
      setResultado(res);
      if (enRecuadro.listo) setVeredictos((v) => ({ ...v, [enRecuadro.listo.id]: res.antes.aceptado }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEvaluando(false);
    }
  };

  const copiar = () =>
    navigator.clipboard?.writeText(resultado?.despues.texto ?? "").then(() => onAviso("Documento corregido copiado"), () => onAviso("No se pudo copiar"));

  const nombre = enRecuadro?.listo?.archivo ?? enRecuadro?.propio?.name ?? "";
  const problemas = resultado ? resultado.antes.total - resultado.antes.cumple + resultado.antes.observaciones.length : 0;

  return (
    <section className="panel glass listos" aria-labelledby="histListos">
      <h2 id="histListos" className="hist-tit"><FileCheck size={20} aria-hidden="true" /> Archivos listos para evaluar</h2>
      <p className="listos-lead">
        Arrastra un archivo al recuadro (o tócalo) y pulsa <b>Evaluar</b> para saber si pasa el formato oficial.
        Son archivos de ejemplo de tu trabajo en {usuario.area === "planta" ? "planta" : "oficina"}; evaluarlos no cambia tu historial.
      </p>

      {!listos && !error && <p className="revisando"><LoaderCircle size={20} className="gira" aria-hidden="true" /> Cargando…</p>}

      {listos && (
        <div className="listos-cols">
          <ul className="listos-lista">
            {listos.map((l) => (
              <li key={l.id}>
                <button
                  className={`listo${enRecuadro?.listo?.id === l.id ? " on" : ""}`} draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "copy"; }}
                  onClick={() => poner({ listo: l })} aria-pressed={enRecuadro?.listo?.id === l.id}
                >
                  <span className="hist-ico"><IconoApp id={appDeArchivo(l.archivo)} size={32} /></span>
                  <span className="hist-txt">
                    <b>{l.archivo}</b>
                    <small>{l.formato_nombre} · {l.codigo}</small>
                    <span className="hist-resumen">{l.detalle}</span>
                    {l.id in veredictos && (veredictos[l.id]
                      ? <span className="estado st-ok"><CircleCheck size={15} aria-hidden="true" /> Pasa el formato</span>
                      : <span className="estado st-falla"><CircleX size={15} aria-hidden="true" /> No pasa el formato</span>)}
                  </span>
                  <GripVertical size={18} className="listo-agarre" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <div
            className={`zona-archivo listos-zona${encima ? " on" : ""}${enRecuadro ? " llena" : ""}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setEncima(true); }}
            onDragLeave={() => setEncima(false)} onDrop={soltar}
          >
            {enRecuadro ? (
              <>
                <IconoApp id={appDeArchivo(nombre)} size={54} />
                <b className="listos-nombre">{nombre}</b>
                <span>
                  {enRecuadro.listo ? `Se evalúa contra: ${enRecuadro.listo.formato_nombre} (${enRecuadro.listo.codigo})`
                    : "Documento de tu equipo: se evalúa contra el formato al que más se parece"}
                </span>
                <div className="row listos-botones">
                  <button className="btn pri" onClick={evaluar} disabled={evaluando}>
                    {evaluando ? <LoaderCircle size={20} className="gira" aria-hidden="true" /> : <ScanSearch size={20} aria-hidden="true" />}
                    {evaluando ? "Evaluando…" : "Evaluar"}
                  </button>
                  <button className="btn sec" onClick={() => poner(null)} disabled={evaluando}><X size={20} aria-hidden="true" /> Quitar</button>
                </div>
              </>
            ) : (
              <>
                <Upload size={34} aria-hidden="true" />
                <b>Suelta aquí el archivo</b>
                <span>Arrastra uno de la lista, o un Word, PDF o texto de tu equipo.</span>
                <button className="btn sec" onClick={() => refArchivo.current?.click()}>Elegir un archivo de mi equipo</button>
              </>
            )}
            <input
              ref={refArchivo} type="file" accept=".docx,.pdf,.pptx,.txt,.md" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) poner({ propio: f }); e.target.value = ""; }}
            />
          </div>
        </div>
      )}

      {error && <p className="error" role="alert"><CircleAlert size={20} aria-hidden="true" /> {error}</p>}

      {resultado && (
        <div ref={refResultado} className="listos-resultado">
          <p className={`veredicto ${resultado.antes.aceptado ? "si" : "no"}`} role="status">
            {resultado.antes.aceptado ? <CircleCheck size={26} aria-hidden="true" /> : <CircleX size={26} aria-hidden="true" />}
            <span>
              <b>{resultado.antes.aceptado ? "Pasa el formato" : "No pasa el formato"}</b>
              {resultado.archivo} · {resultado.nombre} ({resultado.codigo} rev. {resultado.revision}) · cumple {resultado.antes.cumple} de {resultado.antes.total} puntos.
              {resultado.antes.aceptado ? " No hay nada que corregir." : ` ${problemas === 1 ? "Hay 1 problema marcado" : `Hay ${problemas} problemas marcados`} en la hoja del antes.`}
              {resultado.pendientes > 0 && ` En el después ${resultado.pendientes === 1 ? "queda 1 dato" : `quedan ${resultado.pendientes} datos`} por completar a mano.`}
            </span>
          </p>
          <AntesDespues c={resultado} />
          <div className="row acciones">
            {!resultado.antes.aceptado && (
              <button className="btn pri" onClick={copiar}><Copy size={20} aria-hidden="true" /> Copiar el documento corregido</button>
            )}
            <button className="btn sec" onClick={() => poner(null)}><RotateCcw size={20} aria-hidden="true" /> Evaluar otro archivo</button>
          </div>
        </div>
      )}
    </section>
  );
}
