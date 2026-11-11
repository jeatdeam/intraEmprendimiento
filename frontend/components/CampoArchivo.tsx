"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Download, FileSpreadsheet, LoaderCircle, OctagonX, Upload } from "lucide-react";
import { revisarArchivo, revisarEjemplo } from "@/lib/api";
import type { Modo, Problema, Revision } from "@/lib/types";
import { Apps } from "./Apps";

const ETIQUETA: Record<Problema["tipo"], { txt: string; Ico: typeof CircleAlert }> = {
  falla: { txt: "Falla de máquina", Ico: OctagonX },
  error: { txt: "Dato mal escrito", Ico: CircleAlert },
  bajo: { txt: "Bajo el rango", Ico: ArrowDown },
  alto: { txt: "Sobre el rango", Ico: ArrowUp },
};

// Guarda las revisiones ya hechas para mostrarlas otra vez si el empleado vuelve a esta pantalla.
const cache = new Map<string, Revision>();

interface Props {
  id: string;
  modo: Modo;
  valor: string;
  onCambio: (revisionId: string) => void;
}

/** Sube un Excel/CSV, lo revisa en el servidor y muestra lo que encontró antes de enviarlo a la IA. */
export default function CampoArchivo({ id, modo, valor, onCambio }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [rev, setRev] = useState<Revision | null>(() => cache.get(valor) ?? null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const practica = modo === "practica";

  async function revisar(p: Promise<Revision>) {
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

  // En práctica se carga solo el archivo ficticio.
  useEffect(() => {
    if (practica && !cache.has(valor)) revisar(revisarEjemplo());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elegir = (f?: File | null) => { if (f) revisar(revisarArchivo(f, modo)); };

  const r = rev?.resumen;
  return (
    <div className="archivo">
      {!practica && (
        <div
          className={`zona-archivo ${arrastrando ? "on" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files[0]); }}
        >
          <FileSpreadsheet size={34} aria-hidden="true" />
          <Apps apps={["excel", "csv"]} />
          <span>Arrastra aquí el archivo o</span>
          <button type="button" id={id} className="btn sec" onClick={() => input.current?.click()} disabled={cargando}>
            <Upload size={20} aria-hidden="true" /> {rev ? "Elegir otro archivo" : "Elegir archivo"}
          </button>
          <input ref={input} type="file" hidden accept=".xlsx,.xlsm,.csv,.txt"
            onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      )}
      <a className="descarga" href={practica ? "/api/archivo/ejemplo" : "/api/archivo/plantilla"}>
        <Download size={18} aria-hidden="true" /> {practica ? "Descargar el archivo de ejemplo" : "Descargar la plantilla vacía"}
      </a>

      {cargando && <p className="revisando" aria-live="polite"><LoaderCircle size={20} className="gira" aria-hidden="true" /> Revisando el archivo…</p>}
      {error && <p className="error" role="alert"><CircleAlert size={20} aria-hidden="true" /> {error}</p>}

      {rev && r && !cargando && (
        <div className="revision" aria-live="polite">
          <p className="rev-titulo">
            <FileSpreadsheet size={20} aria-hidden="true" /> <b>{rev.archivo}</b>
            <span>{rev.filas} filas · {r.equipos} equipos{r.desde ? ` · ${r.desde} a ${r.hasta}` : ""}</span>
          </p>
          <div className="contadores">
            <span className="cont st-ok"><CircleCheck size={18} aria-hidden="true" /> {r.validas} correctas</span>
            <span className="cont st-falla"><OctagonX size={18} aria-hidden="true" /> {r.fallas} fallas</span>
            <span className="cont st-error"><CircleAlert size={18} aria-hidden="true" /> {r.errores} errores</span>
            <span className="cont st-rango"><ArrowDown size={18} aria-hidden="true" /> {r.bajos} bajos</span>
            <span className="cont st-rango"><ArrowUp size={18} aria-hidden="true" /> {r.altos} altos</span>
          </div>
          {rev.estructura.length > 0 && (
            <ul className="estructura">{rev.estructura.map((e) => <li key={e}><CircleAlert size={16} aria-hidden="true" /> {e}</li>)}</ul>
          )}
          {rev.problemas.length > 0 && (
            <details>
              <summary>Ver los {rev.problemas.length} problemas encontrados</summary>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead><tr><th>Fila</th><th>Qué pasa</th><th>Columna</th><th>Valor</th><th>Detalle</th></tr></thead>
                  <tbody>
                    {rev.problemas.map((p, i) => {
                      const { txt, Ico } = ETIQUETA[p.tipo];
                      return (
                        <tr key={i}>
                          <td>{p.fila}</td>
                          <td><span className={`estado st-${p.tipo}`}><Ico size={15} aria-hidden="true" /> {txt}</span></td>
                          <td>{p.columna}</td>
                          <td className="num">{p.valor || "(vacío)"}</td>
                          <td>{p.mensaje}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <p className="hint">Al enviar, la IA explica estos resultados con el skill elegido y los datos quedan en la gráfica.</p>
        </div>
      )}
    </div>
  );
}
