"use client";
import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ArrowDown, ArrowUp, CircleAlert, CircleCheck, Download, FileSpreadsheet, FolderOpen, LoaderCircle, OctagonX, Sparkles, Upload,
} from "lucide-react";
import { obtenerListosDatos, revisarArchivo, revisarEjemplo, revisarEnvioDatos, revisarListoDatos } from "@/lib/api";
import type { ArchivoEjemplo, Envio, Modo, Problema, Revision } from "@/lib/types";
import { Apps } from "./Apps";
import FilaArchivo from "./FilaArchivo";
import VisorEnvio from "./VisorEnvio";
import { EstadoArchivo, fechaHora } from "./MiHistorial";

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
  usuario?: string;         // id del usuario: con él se muestran sus archivos enviados y los de ejemplo
  enviados?: Envio[];       // archivos que el usuario ya subió (de su historial)
}

/**
 * Sube un Excel/CSV, lo revisa en el servidor y muestra lo que encontró antes de enviarlo a la IA.
 * Debajo están los archivos de datos que el usuario ya envió y 5 archivos de ejemplo: se arrastran al recuadro.
 */
export default function CampoArchivo({ id, modo, valor, onCambio, usuario, enviados }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [rev, setRev] = useState<Revision | null>(() => cache.get(valor) ?? null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [ejemplos, setEjemplos] = useState<ArchivoEjemplo[]>([]);
  const [elegido, setElegido] = useState("");          // clave del archivo de la lista que está cargado
  const [visor, setVisor] = useState<number | null>(null);   // archivo enviado abierto en el panel de la derecha
  const practica = modo === "practica";

  async function revisar(p: Promise<Revision>, clave = "") {
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

  // Es una demo: siempre se carga solo el archivo ficticio (en práctica y en trabajo real).
  useEffect(() => {
    if (!cache.has(valor)) revisar(revisarEjemplo(modo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!usuario) return;
    let vigente = true;
    obtenerListosDatos(usuario).then((l) => { if (vigente) setEjemplos(l); }, () => { if (vigente) setEjemplos([]); });
    return () => { vigente = false; };
  }, [usuario]);

  // Archivos de datos (Excel / CSV) que el usuario ya envió.
  const mios = (enviados ?? []).filter((e) => e.revision?.tipo === "archivo");

  /** Carga un archivo de las listas: "envio:12" (ya enviado) o "listo:inversores" (de ejemplo). */
  const cargar = (clave: string) => {
    if (!usuario || cargando) return;
    const [tipo, ref] = clave.split(":");
    if (tipo === "envio" && mios.some((e) => String(e.id) === ref)) revisar(revisarEnvioDatos(usuario, Number(ref), modo), clave);
    else if (tipo === "listo" && ejemplos.some((l) => l.id === ref)) revisar(revisarListoDatos(usuario, ref, modo), clave);
  };

  const elegir = (f?: File | null) => { if (f) revisar(revisarArchivo(f, modo)); };
  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    const propio = e.dataTransfer.files?.[0];
    if (propio) { if (!practica) elegir(propio); return; }
    cargar(e.dataTransfer.getData("text/plain"));
  };

  const r = rev?.resumen;
  return (
    <div className="archivo">
      {(!practica || usuario) && (
        <div
          className={`zona-archivo ${arrastrando ? "on" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)} onDrop={soltar}
        >
          <FileSpreadsheet size={34} aria-hidden="true" />
          <Apps apps={["excel", "csv"]} />
          {practica ? (
            <span id={id} tabIndex={-1}>Arrastra aquí uno de los archivos de abajo, o tócalo</span>
          ) : (
            <>
              <span>{usuario ? "Arrastra aquí un archivo de tu equipo o uno de la lista de abajo" : "Arrastra aquí el archivo o"}</span>
              <button type="button" id={id} className="btn sec" onClick={() => input.current?.click()} disabled={cargando}>
                <Upload size={20} aria-hidden="true" /> {rev ? "Elegir otro archivo" : "Elegir archivo"}
              </button>
              <input ref={input} type="file" hidden accept=".xlsx,.xlsm,.csv,.txt"
                onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ""; }} />
            </>
          )}
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

      {usuario && (
        <div className="elegibles">
          <section aria-labelledby={`${id}_mios`}>
            <h3 id={`${id}_mios`} className="elegibles-tit"><FolderOpen size={18} aria-hidden="true" /> Tus archivos enviados</h3>
            {mios.length ? (
              <ul className="elegibles-lista">
                {mios.map((e) => (
                  <FilaArchivo key={e.id} clave={`envio:${e.id}`} archivo={e.archivo ?? "archivo"} activo={elegido === `envio:${e.id}`}
                    onElegir={() => setVisor(e.id)}>
                    <small>{fechaHora(e.creado)}{e.modo === "practica" && <span className="hist-modo">Práctica</span>}</small>
                    <EstadoArchivo e={e} />
                  </FilaArchivo>
                ))}
              </ul>
            ) : (
              <p className="elegibles-vacio">Todavía no has enviado archivos de datos.</p>
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
