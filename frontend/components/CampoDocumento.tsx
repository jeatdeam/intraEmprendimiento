"use client";
import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, CircleX, Download, FileText, LoaderCircle, Upload } from "lucide-react";
import { cambiarFormato, revisarDocumento, revisarDocumentoEjemplo } from "@/lib/api";
import type { Modo, RevisionFormato } from "@/lib/types";
import { Apps } from "./Apps";

// Revisiones ya hechas, para mostrarlas otra vez si el empleado vuelve a esta pantalla.
const cache = new Map<string, RevisionFormato>();

interface Props {
  id: string;
  modo: Modo;
  formato: string;          // turno | planta | semanal | falla (sale del skill elegido)
  valor: string;
  onCambio: (revisionId: string) => void;
}

/** Sube un Word/PDF/texto y muestra si cumple el formato oficial elegido con el skill. */
export default function CampoDocumento({ id, modo, formato, valor, onCambio }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [rev, setRev] = useState<RevisionFormato | null>(() => cache.get(valor) ?? null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const practica = modo === "practica";

  async function revisar(p: Promise<RevisionFormato>) {
    setCargando(true);
    setError("");
    try {
      const r = await p;
      cache.set(r.id, r);
      setRev(r);
      onCambio(r.id);
    } catch (e) {
      setRev(null);
      onCambio("");
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const previa = cache.get(valor);
    if (previa && previa.formato !== formato) revisar(cambiarFormato(previa.id, formato, modo)); // cambió el skill
    else if (!previa && practica) revisar(revisarDocumentoEjemplo(formato));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formato]);

  const elegir = (f?: File | null) => { if (f) revisar(revisarDocumento(f, formato, modo)); };
  const grupos = rev ? [...new Set(rev.checks.map((c) => c.grupo))] : [];

  return (
    <div className="archivo">
      {!practica && (
        <div
          className={`zona-archivo ${arrastrando ? "on" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files[0]); }}
        >
          <FileText size={34} aria-hidden="true" />
          <span>Arrastra aquí tu documento o</span>
          <button type="button" id={id} className="btn sec" onClick={() => input.current?.click()} disabled={cargando}>
            <Upload size={20} aria-hidden="true" /> {rev ? "Elegir otro documento" : "Elegir documento"}
          </button>
          <Apps apps={["word", "pdf", "powerpoint", "texto"]} />
          <span className="hint">.docx, .pdf, .pptx o .txt · máximo 4 MB.</span>
          <input ref={input} type="file" hidden accept=".docx,.pdf,.pptx,.txt,.md"
            onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ""; }} />
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
          <p className="hint">Al enviar, la IA lee el documento y te explica qué corregir según el skill «{rev.nombre}».</p>
        </div>
      )}
    </div>
  );
}
