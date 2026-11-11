"use client";
import { useRef, type FormEvent } from "react";
import { ArrowLeft, CircleAlert, Lock, PencilLine, RotateCcw, Sparkles } from "lucide-react";
import type { Skill, Tarea } from "@/lib/types";
import { Coach, Pasos } from "./Ayudas";
import { IconoBurbuja } from "./Icono";
import CampoArchivo from "./CampoArchivo";
import CampoDocumento from "./CampoDocumento";
import HistorialEquipo from "./HistorialEquipo";

interface Props {
  tarea: Tarea;
  skill: Skill;
  skillId: string;
  datos: Record<string, string>;
  practica: boolean;
  error: string;
  onCambio: (id: string, valor: string) => void;
  onFalta: (msg: string) => void;
  onEjemplo: () => void;
  onEnviar: () => void;
  onVolver: () => void;
}

export default function Formulario({ tarea, skill, skillId, datos, practica, error, onCambio, onFalta, onEjemplo, onEnviar, onVolver }: Props) {
  const form = useRef<HTMLFormElement>(null);
  // Si el formulario tiene un equipo conocido (AG-07, INV-03…), al costado se muestran sus días anteriores.
  const equipoId = (datos.equipo ?? "").match(/\b(AG|INV|TR)-\d{2}\b/i)?.[0].toUpperCase();

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const vacio = tarea.campos.find((c) => !c.opcional && !(datos[c.id] ?? "").trim());
    if (vacio) {
      form.current?.querySelector<HTMLElement>(`#f_${vacio.id}`)?.focus();
      onFalta(`Falta completar: ${vacio.label}`);
      return;
    }
    onEnviar();
  };

  return (
    <>
      <button className="back" onClick={onVolver}><ArrowLeft size={20} aria-hidden="true" /> Cambiar skill</button>
      <Pasos actual={3} />
      <h1 tabIndex={-1}>Completa los datos</h1>
      <p className="lead">{tarea.nombre} · usando el skill <b>{skill.nombre}</b></p>
      <Coach visible={practica} icono={PencilLine} titulo="Paso 3: revisa los datos">
        {tarea.campos.some((c) => c.tipo === "documento") ? (
          <>Ya cargamos un <b>documento de ejemplo (falso)</b> al que le faltan cosas a propósito. Mira qué partes del
            formato oficial cumple y cuáles no, y luego envíalo a la IA para que te diga cómo corregirlo.</>
        ) : tarea.campos.some((c) => c.tipo === "archivo") ? (
          <>Ya cargamos un <b>archivo de ejemplo (falso)</b> con algunos errores a propósito. Mira lo que encontró la
            revisión y luego envíalo a la IA para que te lo explique.</>
        ) : (
          <>Ya llenamos todo con <b>datos de ejemplo (falsos)</b>. Puedes cambiarlos si quieres. Fíjate que escribimos de
            forma informal: la IA se encarga de ordenarlo.</>
        )}
      </Coach>

      <div className="two">
        <form className="panel glass" ref={form} onSubmit={enviar} noValidate>
          {tarea.campos.map((c) => (
            <div className="field" key={c.id}>
              {c.tipo === "archivo" || c.tipo === "documento" ? <span className="label">{c.label}</span> : <label htmlFor={`f_${c.id}`}>{c.label}</label>}
              {c.hint && <span className="hint">{c.hint}</span>}
              {c.tipo === "documento" ? (
                <CampoDocumento id={`f_${c.id}`} modo={practica ? "practica" : "real"} valor={datos[c.id] ?? ""}
                  formato={skillId.replace(/^fmt_/, "")} onCambio={(v) => onCambio(c.id, v)} />
              ) : c.tipo === "archivo" ? (
                <CampoArchivo id={`f_${c.id}`} modo={practica ? "practica" : "real"} valor={datos[c.id] ?? ""}
                  onCambio={(v) => onCambio(c.id, v)} />
              ) : c.tipo === "select" ? (
                <select id={`f_${c.id}`} value={datos[c.id] ?? c.opciones?.[0] ?? ""} onChange={(e) => onCambio(c.id, e.target.value)}>
                  {c.opciones?.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : c.tipo === "area" ? (
                <textarea id={`f_${c.id}`} value={datos[c.id] ?? ""} onChange={(e) => onCambio(c.id, e.target.value)} />
              ) : (
                <input type="text" id={`f_${c.id}`} value={datos[c.id] ?? ""} onChange={(e) => onCambio(c.id, e.target.value)} />
              )}
            </div>
          ))}
          {error && <p className="error" role="alert"><CircleAlert size={20} aria-hidden="true" /> {error}</p>}
          <div className="row acciones-form">
            <button type="submit" className="btn pri"><Sparkles size={22} aria-hidden="true" /> Enviar a la IA</button>
            {practica && !tarea.campos.some((c) => c.tipo === "archivo" || c.tipo === "documento") && (
              <button type="button" className="btn sec" onClick={onEjemplo}><RotateCcw size={20} aria-hidden="true" /> Volver a los datos de ejemplo</button>
            )}
          </div>
        </form>

        <div className="lateral">
        {equipoId && <HistorialEquipo equipo={equipoId} modo={practica ? "practica" : "real"} />}
        <aside className="skillbox glass" aria-label="Qué hará el skill">
          <div className="skillbox-head">
            <IconoBurbuja nombre={skill.ico} size={24} />
            <b>Lo que hará el skill “{skill.nombre}”</b>
          </div>
          <ol>{skill.pasos.map((p) => <li key={p}>{p}</li>)}</ol>
          <p className="nota"><Lock size={18} aria-hidden="true" /> No escribas contraseñas ni datos personales sensibles.</p>
        </aside>
        </div>
      </div>
    </>
  );
}
