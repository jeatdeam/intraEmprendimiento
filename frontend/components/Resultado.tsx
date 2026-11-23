"use client";
import { useEffect, useState } from "react";
import { ArrowRightLeft, Check, CircleCheck, CircleX, Copy, Database, Eye, Hourglass, House, Info, Plus, Printer, RefreshCw, Square, TriangleAlert, Volume2 } from "lucide-react";
import { antesDespues } from "@/lib/api";
import type { Comparacion, Skill, Tarea } from "@/lib/types";
import SliderAntesDespues from "./SliderAntesDespues";
import SliderFormato from "./SliderFormato";
import Documento from "./Documento";
import { Coach, Pasos } from "./Ayudas";
import RobotTrabajando from "./RobotTrabajando";

/** Pantalla mientras la IA trabaja: muestra los pasos del skill uno por uno. */
export function Procesando({ skill, practica, pasoActual }: { skill: Skill; practica: boolean; pasoActual: number }) {
  return (
    <>
      <Pasos actual={4} />
      <div className="panel glass proc" aria-live="polite">
        <RobotTrabajando />
        <h1 tabIndex={-1}>La IA está trabajando…</h1>
        <p className="lead" style={{ margin: 0 }}>Aplicando el skill <b>{skill.nombre}</b></p>
        <ul>
          {skill.pasos.map((p, i) => (
            <li key={p} className={i < pasoActual ? "ok" : i === pasoActual ? "now" : ""}>
              <span className="marca">{i < pasoActual ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : null}</span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <Coach visible={practica} icono={Hourglass} titulo="Paso 4: la IA trabaja">
        Ahora la IA sigue los pasos del skill que elegiste, uno por uno. Normalmente tarda solo unos segundos.
      </Coach>
    </>
  );
}

/** Hoja del "antes": los datos tal como se escribieron en el formulario, sin el skill. */
function HojaEntrada({ tarea, entrada }: { tarea: Tarea; entrada: { label: string; valor: string }[] }) {
  return (
    <div className="hoja hoja-entrada">
      <p className="hl hl-titulo"><span>{tarea.nombre.toUpperCase()}</span></p>
      <p className="he-sub">Datos tal como se escribieron, sin ordenar ni dar formato</p>
      {entrada.map((c) => (
        <div key={c.label} className="he-campo">
          <b>{c.label}</b>
          <p>{c.valor}</p>
        </div>
      ))}
    </div>
  );
}

interface Props {
  tarea: Tarea;
  entrada: { label: string; valor: string }[];   // lo que recibió el skill (el "antes")
  skill: Skill;
  texto: string;
  planta: string;
  origen: "ia" | "simulado";
  practica: boolean;
  usuario: string;          // id del usuario
  revision: string;         // id de la revisión del documento subido ("" si la tarea no lleva documento)
  onOtroSkill: () => void;
  onOtraTarea: () => void;
  onBaseDatos?: () => void;   // inspección: ver la fila recién guardada en la base de datos
  onAviso: (msg: string) => void;
}

export default function Resultado({ tarea, entrada, skill, texto, planta, origen, practica, usuario, revision, onOtroSkill, onOtraTarea, onBaseDatos, onAviso }: Props) {
  const [hablando, setHablando] = useState(false);
  const [comparacion, setComparacion] = useState<Comparacion | null>(null);

  // Si se revisó un documento: sus dos hojas, el antes (con cada error marcado) y el después (corregido).
  useEffect(() => {
    if (!revision) return;
    let vigente = true;
    antesDespues(revision, practica ? "practica" : "real", usuario).then((c) => { if (vigente) setComparacion(c); }, () => {});
    return () => { vigente = false; };
  }, [revision, practica, usuario]);

  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);

  const copiar = () =>
    navigator.clipboard?.writeText(texto).then(() => onAviso("Texto copiado"), () => onAviso("No se pudo copiar"));

  const escuchar = () => {
    const voz = window.speechSynthesis;
    if (!voz) return onAviso("Tu navegador no puede leer en voz alta");
    if (voz.speaking) { voz.cancel(); setHablando(false); return; }
    const u = new SpeechSynthesisUtterance(texto.replace(/[☐•█─]+/g, " "));
    u.lang = "es-ES";
    u.rate = 0.95;
    u.onend = () => setHablando(false);
    voz.speak(u);
    setHablando(true);
  };

  return (
    <>
      <Pasos actual={5} />
      <header className="cabecera glass">
        <h1 tabIndex={-1} className="titulo-ok"><CircleCheck size={26} aria-hidden="true" /> ¡Listo! Este es el resultado</h1>
        <p className="lead">{tarea.nombre} · skill <b>{skill.nombre}</b></p>
      </header>
      <Coach visible={practica} icono={Eye} titulo="Paso 5: revisa siempre el resultado">
        La IA es una gran ayuda, pero <b>puede equivocarse</b>. Lee el resultado antes de usarlo. Tú eres quien
        decide. Prueba también otro skill para ver cómo cambia la respuesta.
      </Coach>
      {/* Antes y después: los dos documentos en un slider para ver la diferencia */}
      {revision ? (
        comparacion && (
          <section className="panel glass ad-panel" aria-labelledby="adTitulo">
            <h2 id="adTitulo">Antes y después de {comparacion.archivo}</h2>
            <p className="listos-lead">
              A la izquierda, el documento como lo subiste, con lo que está mal o falta marcado en su lugar. A la derecha, cómo
              queda corregido según el formato {comparacion.nombre} ({comparacion.codigo}).
              {comparacion.pendientes > 0 && ` ${comparacion.pendientes === 1 ? "Queda 1 dato" : `Quedan ${comparacion.pendientes} datos`} por completar a mano, en amarillo.`}
            </p>
            <ul className="ad-leyenda" aria-label="Qué significa cada color">
              <li className="m-error"><CircleX size={14} aria-hidden="true" /> Error o falta algo</li>
              <li className="m-aviso"><TriangleAlert size={14} aria-hidden="true" /> Fuera de orden o por completar</li>
              <li className="m-nuevo"><Plus size={14} aria-hidden="true" /> Agregado o corregido</li>
            </ul>
            <SliderFormato grupos={[comparacion]} />
            <div className="row acciones">
              <button className="btn sec" onClick={() => navigator.clipboard?.writeText(comparacion.despues.texto).then(
                () => onAviso("Documento corregido copiado"), () => onAviso("No se pudo copiar"))}>
                <Copy size={20} aria-hidden="true" /> Copiar el documento corregido
              </button>
            </div>
          </section>
        )
      ) : entrada.length > 0 && (
        <section className="panel glass ad-panel" aria-labelledby="adTitulo">
          <h2 id="adTitulo"><ArrowRightLeft size={22} aria-hidden="true" /> Antes y después</h2>
          <p className="listos-lead">
            A la izquierda, lo que escribiste en el formulario, tal cual. A la derecha, el documento que armó el skill
            <b> {skill.nombre}</b> con esos mismos datos. Arrastra la línea para ver la diferencia.
          </p>
          <SliderAntesDespues izq="Lo que escribiste" der="Con skill" izqCorta="Escrito" derCorta="Con skill"
            grupos={[{
              clave: "resultado", titulo: tarea.nombre, sub: `Skill ${skill.nombre}`,
              izq: <HojaEntrada tarea={tarea} entrada={entrada} />,
              der: <div className="result baf-result"><Documento texto={texto} planta={planta} /></div>,
              selloIzq: <span className="baf-sello no">Sin skill</span>,
              selloDer: <span className="baf-sello si"><CircleCheck size={13} aria-hidden="true" /> {skill.nombre}</span>,
            }]} />
        </section>
      )}
      <div className="result" tabIndex={0} aria-label="Resultado de la IA"><Documento texto={texto} planta={planta} /></div>
      {origen === "simulado" && !practica && (
        <div className="aviso glass">
          <Info size={20} aria-hidden="true" /> La IA real todavía no está conectada en el servidor: este resultado es una simulación.
        </div>
      )}
      {onBaseDatos && (
        <div className="aviso glass bd-aviso">
          <CircleCheck size={20} aria-hidden="true" />
          <span>La inspección quedó guardada en la <b>base de datos de inspecciones</b> con sus mediciones.</span>
          <button className="btn pri" onClick={onBaseDatos}><Database size={20} aria-hidden="true" /> Ver en la base de datos</button>
        </div>
      )}
      <div className="row acciones">
        <button className="btn pri" onClick={copiar}><Copy size={20} aria-hidden="true" /> Copiar texto</button>
        <button className="btn sec" onClick={() => window.print()}><Printer size={20} aria-hidden="true" /> Imprimir o guardar PDF</button>
        <button className="btn sec" onClick={escuchar}>
          {hablando ? <Square size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
          {hablando ? "Detener" : "Escuchar"}
        </button>
        {tarea.skills.length > 1 && (
          <button className="btn sec" onClick={onOtroSkill}><RefreshCw size={20} aria-hidden="true" /> Probar con otro skill</button>
        )}
        <button className="btn sec" onClick={onOtraTarea}><House size={20} aria-hidden="true" /> Hacer otra tarea</button>
      </div>
    </>
  );
}
