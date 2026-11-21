"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft, ChartLine, ChevronRight, CircleAlert, CircleCheck, CircleX, Copy, FolderOpen, Inbox, LoaderCircle,
  MessagesSquare, Printer, RotateCcw, TriangleAlert,
} from "lucide-react";
import { obtenerEnvio } from "@/lib/api";
import type { Envio, EnvioDetalle, HistorialUsuario, Usuario } from "@/lib/types";
import { IconoApp } from "./Apps";
import Documento from "./Documento";
import { IconoBurbuja } from "./Icono";
import { iniciales } from "./Inicio";
import ListosParaEvaluar, { appDeArchivo as app } from "./ListosParaEvaluar";


export const fechaHora = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Sello del resultado de un archivo subido: aceptado / no aceptado, o cuántas alertas tuvo el archivo de datos. */
export function EstadoArchivo({ e }: { e: Envio }) {
  const r = e.revision;
  if (!r) return null;
  if (r.tipo === "documento") {
    return r.aceptado
      ? <span className="estado st-ok"><CircleCheck size={15} aria-hidden="true" /> Aceptado</span>
      : <span className="estado st-falla"><CircleX size={15} aria-hidden="true" /> No aceptado</span>;
  }
  const alertas = r.errores + r.bajos + r.altos + r.fallas;
  return alertas
    ? <span className="estado st-bajo"><TriangleAlert size={15} aria-hidden="true" /> {alertas} {alertas === 1 ? "alerta" : "alertas"}</span>
    : <span className="estado st-ok"><CircleCheck size={15} aria-hidden="true" /> Sin alertas</span>;
}

function Item({ e, onAbrir }: { e: Envio; onAbrir: (e: Envio) => void }) {
  return (
    <li>
      <button className="hist-item" onClick={() => onAbrir(e)}>
        {e.archivo ? <span className="hist-ico"><IconoApp id={app(e.archivo)} size={34} /></span> : <IconoBurbuja nombre={e.tarea_id} />}
        <span className="hist-txt">
          <b>{e.archivo ?? e.tarea}</b>
          <small>
            {e.archivo ? `${e.tarea} · ` : ""}skill {e.skill} · {fechaHora(e.creado)}
            {e.modo === "practica" && <span className="hist-modo">Práctica</span>}
          </small>
          <span className="hist-resumen">{e.resumen}</span>
          <EstadoArchivo e={e} />
        </span>
        <ChevronRight size={18} className="hist-ir" aria-hidden="true" />
      </button>
    </li>
  );
}

interface Props {
  usuario: Usuario;
  historial: HistorialUsuario | null;
  error: string;
  onAbrir: (e: Envio) => void;
  onGrafica: () => void;
  onVolver: () => void;
  onAviso: (msg: string) => void;
  volverA: string;
}

/** Historial del usuario: sus consultas a la IA y los archivos que subió para revisar. */
export default function MiHistorial({ usuario, historial, error, onAbrir, onGrafica, onVolver, onAviso, volverA }: Props) {
  const docs = historial?.archivos.filter((a) => a.revision?.tipo === "documento") ?? [];
  const aceptados = docs.filter((a) => a.revision?.tipo === "documento" && a.revision.aceptado).length;

  return (
    <>
      <button className="back" onClick={onVolver}><ArrowLeft size={20} aria-hidden="true" /> {volverA}</button>
      <header className="cabecera glass hist-cabecera">
        <span className={`avatar grande ${usuario.perfil}`} aria-hidden="true">{iniciales(usuario.nombre)}</span>
        <div>
          <h1 tabIndex={-1}>Historial de {usuario.nombre}</h1>
          <p className="lead">{usuario.cargo} · perfil <b>{usuario.perfil_nombre}</b>. Toca cualquier fila para volver a ver el resultado.</p>
        </div>
      </header>

      {error && <p className="error" role="alert"><CircleAlert size={20} aria-hidden="true" /> {error}</p>}
      {!historial && !error && <p className="revisando"><LoaderCircle size={20} className="gira" aria-hidden="true" /> Cargando…</p>}

      {historial && (
        <>
          <div className="tiles">
            <div className="tile glass"><span>Consultas a la IA</span><b>{historial.consultas.length}</b></div>
            <div className="tile glass"><span>Archivos subidos</span><b>{historial.archivos.length}</b></div>
            <div className="tile glass"><span>Documentos aceptados</span><b>{aceptados} de {docs.length}</b></div>
          </div>

          <div className="hist-cols">
            <section className="panel glass" aria-labelledby="histConsultas">
              <h2 id="histConsultas" className="hist-tit"><MessagesSquare size={20} aria-hidden="true" /> Consultas</h2>
              {historial.consultas.length ? (
                <ul className="hist-lista">{historial.consultas.map((e) => <Item key={e.id} e={e} onAbrir={onAbrir} />)}</ul>
              ) : (
                <p className="hist-vacio"><Inbox size={28} aria-hidden="true" /> Todavía no hay consultas. Cuando envíes una tarea a la IA aparecerá aquí.</p>
              )}
            </section>
            <section className="panel glass" aria-labelledby="histArchivos">
              <h2 id="histArchivos" className="hist-tit"><FolderOpen size={20} aria-hidden="true" /> Archivos subidos</h2>
              {historial.archivos.length ? (
                <ul className="hist-lista">{historial.archivos.map((e) => <Item key={e.id} e={e} onAbrir={onAbrir} />)}</ul>
              ) : (
                <p className="hist-vacio"><Inbox size={28} aria-hidden="true" /> Todavía no hay archivos. Los documentos y archivos de datos que revises aparecerán aquí.</p>
              )}
            </section>
          </div>

          <ListosParaEvaluar usuario={usuario} onAviso={onAviso} />

          <button className="btn sec ver-grafica" onClick={onGrafica}>
            <ChartLine size={22} aria-hidden="true" /> Ver mis gráficas
          </button>
        </>
      )}
    </>
  );
}

/** Un envío guardado: lo que se escribió o subió y el documento que entregó la IA. */
export function EnvioGuardado({ usuario, envioId, planta, onVolver, onRepetir, onAviso }: {
  usuario: Usuario; envioId: number; planta: string; onVolver: () => void; onRepetir: (e: Envio) => void; onAviso: (msg: string) => void;
}) {
  const [envio, setEnvio] = useState<EnvioDetalle | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    setEnvio(null);
    setError("");
    obtenerEnvio(usuario.id, envioId).then((e) => { if (vigente) setEnvio(e); }, (e: Error) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [usuario.id, envioId]);

  const copiar = () =>
    navigator.clipboard?.writeText(envio?.texto ?? "").then(() => onAviso("Texto copiado"), () => onAviso("No se pudo copiar"));

  return (
    <>
      <button className="back" onClick={onVolver}><ArrowLeft size={20} aria-hidden="true" /> Volver al historial</button>
      {error && <p className="error" role="alert"><CircleAlert size={20} aria-hidden="true" /> {error}</p>}
      {!envio && !error && <p className="revisando"><LoaderCircle size={20} className="gira" aria-hidden="true" /> Cargando…</p>}
      {envio && (
        <>
          <header className="cabecera glass">
            <h1 tabIndex={-1}>{envio.archivo ?? envio.tarea}</h1>
            <p className="lead">
              {envio.archivo ? `${envio.tarea} · ` : ""}skill <b>{envio.skill}</b> · {fechaHora(envio.creado)} ·{" "}
              {envio.modo === "practica" ? "modo práctica" : "trabajo real"} <EstadoArchivo e={envio} />
            </p>
          </header>

          {envio.campos.length > 0 && (
            <details className="panel glass hist-detalle">
              <summary>Ver lo que escribiste</summary>
              <dl>
                {envio.campos.map((c) => <div key={c.label}><dt>{c.label}</dt><dd>{c.valor}</dd></div>)}
              </dl>
            </details>
          )}
          {envio.documento && (
            <details className="panel glass hist-detalle">
              <summary>Ver el documento que subiste</summary>
              <pre>{envio.documento}</pre>
            </details>
          )}

          <div className="result" tabIndex={0} aria-label="Resultado de la IA"><Documento texto={envio.texto} planta={planta} fecha={envio.creado} /></div>
          <div className="row acciones">
            <button className="btn pri" onClick={copiar}><Copy size={20} aria-hidden="true" /> Copiar texto</button>
            <button className="btn sec" onClick={() => window.print()}><Printer size={20} aria-hidden="true" /> Imprimir o guardar PDF</button>
            <button className="btn sec" onClick={() => onRepetir(envio)}><RotateCcw size={20} aria-hidden="true" /> Hacer esta tarea otra vez</button>
          </div>
        </>
      )}
    </>
  );
}
