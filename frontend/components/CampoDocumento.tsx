"use client";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { CircleAlert, CircleCheck, CircleX, Download, FileText, FolderOpen, LoaderCircle, Sparkles, Upload } from "lucide-react";
import { antesDespues, cambiarFormato, evaluarListo, obtenerListos, revisarDocumento, revisarDocumentoEjemplo, revisarEnvio, revisarListo } from "@/lib/api";
import type { Comparacion, Envio, Listo, Modo, RevisionFormato } from "@/lib/types";
import SliderFormato from "./SliderFormato";
import VisorEnvio from "./VisorEnvio";
import { Apps } from "./Apps";
import FilaArchivo from "./FilaArchivo";
import { EstadoArchivo, fechaHora } from "./MiHistorial";

// Revisiones ya hechas, para mostrarlas otra vez si el empleado vuelve a esta pantalla.
const cache = new Map<string, RevisionFormato>();

interface Props {
  id: string;
  modo: Modo;
  formato: string;          // turno | planta | semanal | falla (sale del skill elegido)
  valor: string;
  onCambio: (revisionId: string) => void;
  usuario?: string;         // id del usuario: con él se muestran sus archivos enviados y los de ejemplo
  enviados?: Envio[];       // archivos que el usuario ya subió (de su historial)
}

/**
 * Sube un Word/PDF/texto y muestra si cumple el formato oficial elegido con el skill.
 * Debajo están los archivos que el usuario ya envió con ese formato y 5 archivos de ejemplo: se arrastran al recuadro.
 */
export default function CampoDocumento({ id, modo, formato, valor, onCambio, usuario, enviados }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [rev, setRev] = useState<RevisionFormato | null>(() => cache.get(valor) ?? null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [ejemplos, setEjemplos] = useState<Listo[]>([]);
  const [elegido, setElegido] = useState("");          // clave del archivo de la lista que está cargado
  const [visor, setVisor] = useState<number | null>(null);   // archivo enviado abierto en el panel de la derecha
  const [comparar, setComparar] = useState<Comparacion[]>([]);   // grupos del slider: formato normal vs formato con skill
  const practica = modo === "practica";

  // Slider after/before: el documento cargado primero y luego 3 archivos de ejemplo del mismo formato.
  useEffect(() => {
    if (!rev) { setComparar([]); return; }
    let vigente = true;
    const otros = usuario ? ejemplos.filter((l) => elegido !== `listo:${l.id}`).slice(0, 3) : [];
    Promise.allSettled([
      antesDespues(rev.id, modo, usuario ?? ""),
      ...otros.map((l) => evaluarListo(usuario!, l.id)),
    ]).then((rs) => {
      if (vigente) setComparar(rs.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])));
    });
    return () => { vigente = false; };
  }, [rev, ejemplos, elegido, modo, usuario]);

  async function revisar(p: Promise<RevisionFormato>, clave = "") {
    setCargando(true);
    setError("");
    try {
      const r = await p;
      cache.set(r.id, r);
      setRev(r);
      setElegido(clave);
      onCambio(r.id);
    } catch (e) {
      setRev(null);
      setElegido("");
      onCambio("");
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const previa = cache.get(valor);
    if (previa && previa.formato !== formato) revisar(cambiarFormato(previa.id, formato, modo)); // cambió el skill
    else if (!previa) revisar(revisarDocumentoEjemplo(formato, modo));   // es una demo: siempre llega con un ejemplo cargado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formato]);

  useEffect(() => {
    if (!usuario) return;
    let vigente = true;
    obtenerListos(usuario, formato).then((l) => { if (vigente) setEjemplos(l); }, () => { if (vigente) setEjemplos([]); });
    return () => { vigente = false; };
  }, [usuario, formato]);

  // Documentos que el usuario ya envió para revisar con este mismo formato.
  const documentos = (enviados ?? []).filter((e) => e.revision?.tipo === "documento");
  const mios = documentos.filter((e) => e.skill_id === `fmt_${formato}`);

  /** Carga un archivo de las listas: "envio:12" (ya enviado) o "listo:turno-2" (de ejemplo). */
  const cargar = (clave: string) => {
    if (!usuario || cargando) return;
    const [tipo, ref] = clave.split(":");
    if (tipo === "envio" && mios.some((e) => String(e.id) === ref)) revisar(revisarEnvio(usuario, Number(ref), formato, modo), clave);
    else if (tipo === "listo" && ejemplos.some((l) => l.id === ref)) revisar(revisarListo(usuario, ref, formato, modo), clave);
  };

  const elegir = (f?: File | null) => { if (f) revisar(revisarDocumento(f, formato, modo)); };
  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    const propio = e.dataTransfer.files?.[0];
    if (propio) { if (!practica) elegir(propio); return; }
    cargar(e.dataTransfer.getData("text/plain"));
  };
  const grupos = rev ? [...new Set(rev.checks.map((c) => c.grupo))] : [];

  return (
    <div className="archivo">
      {(!practica || usuario) && (
        <div
          className={`zona-archivo ${arrastrando ? "on" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)} onDrop={soltar}
        >
          <FileText size={34} aria-hidden="true" />
          {practica ? (
            <span id={id} tabIndex={-1}>Arrastra aquí uno de los archivos de abajo, o tócalo</span>
          ) : (
            <>
              <span>{usuario ? "Arrastra aquí un documento de tu equipo o uno de la lista de abajo" : "Arrastra aquí tu documento o"}</span>
              <button type="button" id={id} className="btn sec" onClick={() => input.current?.click()} disabled={cargando}>
                <Upload size={20} aria-hidden="true" /> {rev ? "Elegir otro documento" : "Elegir documento"}
              </button>
              <Apps apps={["word", "pdf", "powerpoint", "texto"]} />
              <span className="hint">.docx, .pdf, .pptx o .txt · máximo 4 MB.</span>
              <input ref={input} type="file" hidden accept=".docx,.pdf,.pptx,.txt,.md"
                onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ""; }} />
            </>
          )}
        </div>
      )}
      <div className="row descargas">
        <a className="descarga" href={`/api/documento/plantilla?formato=${formato}`}>
          <Download size={18} aria-hidden="true" /> Descargar la plantilla oficial (Word)
        </a>
        {practica && (
          <a className="descarga" href={`/api/documento/ejemplo?formato=${formato}`}>
            <Download size={18} aria-hidden="true" /> Descargar el documento de ejemplo
          </a>
        )}
      </div>

      {cargando && <p className="revisando" aria-live="polite"><LoaderCircle size={20} className="gira" aria-hidden="true" /> Revisando el documento…</p>}
      {error && <p className="error" role="alert"><CircleAlert size={20} aria-hidden="true" /> {error}</p>}

      {rev && !cargando && (
        <div className="revision" aria-live="polite">
          <p className="rev-titulo">
            <FileText size={20} aria-hidden="true" /> <b>{rev.archivo}</b>
            <span>Formato {rev.nombre} · {rev.codigo} rev. {rev.revision}</span>
          </p>
          <div className={`veredicto ${rev.aceptado ? "si" : "no"}`}>
            {rev.aceptado ? <CircleCheck size={26} aria-hidden="true" /> : <CircleX size={26} aria-hidden="true" />}
            <div>
              <b>{rev.aceptado ? "Formato aceptado" : "Formato no aceptado"}</b>
              <span>Cumple {rev.cumple} de {rev.total} puntos del formato oficial</span>
            </div>
          </div>
          {comparar.length > 0 && <SliderFormato grupos={comparar} />}
          {grupos.map((g) => (
            <div key={g} className="checks">
              <span className="checks-tit">{g}</span>
              <ul>
                {rev.checks.filter((c) => c.grupo === g).map((c) => (
                  <li key={c.label} className={c.ok ? "st-ok" : "st-falla"}>
                    {c.ok ? <CircleCheck size={17} aria-hidden="true" /> : <CircleX size={17} aria-hidden="true" />}
                    <span><b>{c.label}</b>{!c.ok && <> — {c.detalle}</>}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {rev.observaciones.length > 0 && (
            <ul className="estructura">{rev.observaciones.map((o) => <li key={o}><CircleAlert size={16} aria-hidden="true" /> {o}</li>)}</ul>
          )}
          <p className="hint">
            Al enviar, la IA lee el documento y te explica qué corregir según el skill «{rev.nombre}»
            {rev.aceptado ? "." : ", y verás el antes y el después con cada error marcado."}
          </p>
        </div>
      )}

      {usuario && (
        <div className="elegibles">
          <section aria-labelledby={`${id}_mios`}>
            <h3 id={`${id}_mios`} className="elegibles-tit"><FolderOpen size={18} aria-hidden="true" /> Tus archivos enviados</h3>
            {mios.length ? (
              <ul className="elegibles-lista">
                {mios.map((e) => (
                  <FilaArchivo key={e.id} clave={`envio:${e.id}`} archivo={e.archivo ?? "documento"} activo={elegido === `envio:${e.id}`}
                    onElegir={() => setVisor(e.id)}>
                    <small>{fechaHora(e.creado)}{e.modo === "practica" && <span className="hist-modo">Práctica</span>}</small>
                    <EstadoArchivo e={e} />
                  </FilaArchivo>
                ))}
              </ul>
            ) : (
              <p className="elegibles-vacio">Todavía no has enviado documentos con este formato.</p>
            )}
            {documentos.length > mios.length && (
              <p className="elegibles-vacio">
                Tienes {documentos.length - mios.length} {documentos.length - mios.length === 1 ? "documento más" : "documentos más"} de
                otros formatos en «Mi historial».
              </p>
            )}
          </section>
          <section aria-labelledby={`${id}_ejemplos`}>
            <h3 id={`${id}_ejemplos`} className="elegibles-tit"><Sparkles size={18} aria-hidden="true" /> Archivos de ejemplo</h3>
            <ul className="elegibles-lista">
              {ejemplos.map((l) => (
                <FilaArchivo key={l.id} clave={`listo:${l.id}`} archivo={l.archivo} activo={elegido === `listo:${l.id}`}
                  onElegir={() => cargar(`listo:${l.id}`)}>
                  <small>{l.detalle}</small>
                </FilaArchivo>
              ))}
            </ul>
          </section>
          <p className="hint">Toca uno de tus archivos enviados para verlo a la derecha con el motivo por el que fue aceptado o no. Los de ejemplo se cargan al tocarlos o arrastrarlos al recuadro.</p>
        </div>
      )}
      {visor !== null && usuario && (
        <VisorEnvio usuario={usuario} envio={visor} onUsar={() => cargar(`envio:${visor}`)} onCerrar={() => setVisor(null)} />
      )}
    </div>
  );
}
