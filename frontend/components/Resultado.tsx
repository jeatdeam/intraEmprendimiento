"use client";
import { useEffect, useState } from "react";
import { Check, CircleCheck, Copy, Eye, Hourglass, House, Info, Printer, RefreshCw, Square, Volume2 } from "lucide-react";
import Documento from "./Documento";
import type { Skill, Tarea } from "@/lib/types";
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

interface Props {
  tarea: Tarea;
  skill: Skill;
  texto: string;
  planta: string;
  origen: "ia" | "simulado";
  practica: boolean;
  onOtroSkill: () => void;
  onOtraTarea: () => void;
  onAviso: (msg: string) => void;
}

export default function Resultado({ tarea, skill, texto, planta, origen, practica, onOtroSkill, onOtraTarea, onAviso }: Props) {
  const [hablando, setHablando] = useState(false);

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
      <div className="result" tabIndex={0} aria-label="Resultado de la IA"><Documento texto={texto} planta={planta} /></div>
      {origen === "simulado" && !practica && (
        <div className="aviso glass">
          <Info size={20} aria-hidden="true" /> La IA real todavía no está conectada en el servidor: este resultado es una simulación.
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
