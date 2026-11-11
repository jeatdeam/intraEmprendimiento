import { ArrowRight, BadgeCheck, Building2, CircleCheck, Factory, GraduationCap } from "lucide-react";
import type { Area, Modo } from "@/lib/types";
import { Paisaje } from "./Ilustraciones";

interface Props {
  nombre: string;
  area: Area | null;
  modo: Modo | null;
  practicadas: number;
  onNombre: (v: string) => void;
  onArea: (a: Area) => void;
  onModo: (m: Modo) => void;
  onEntrar: () => void;
}

export default function Inicio({ nombre, area, modo, practicadas, onNombre, onArea, onModo, onEntrar }: Props) {
  return (
    <>
      <section className="hero glass">
        <div>
          <span className="eyebrow">Inteligencia artificial para tu día a día</span>
          <h1 tabIndex={-1}>Bienvenido al Asistente de IA</h1>
          <p className="lead">
            Una herramienta simple para que la inteligencia artificial te ayude con tus tareas. Solo tienes que tocar
            botones.
          </p>
        </div>
        <Paisaje />
      </section>

      <div className="panel glass">
        <div className="field">
          <label htmlFor="nombre"><span className="paso-n">1</span> ¿Cómo te llamas?</label>
          <input type="text" id="nombre" value={nombre} onChange={(e) => onNombre(e.target.value)}
            placeholder="Escribe tu nombre" autoComplete="given-name" maxLength={80} />
        </div>

        <div className="field sin-margen"><label id="lblArea"><span className="paso-n">2</span> ¿Dónde trabajas?</label></div>
        <div className="area-grid" role="radiogroup" aria-labelledby="lblArea">
          <button className={`area planta ${area === "planta" ? "sel" : ""}`} role="radio" aria-checked={area === "planta"} onClick={() => onArea("planta")}>
            <span className="burbuja grande tono-ambar"><Factory size={44} aria-hidden="true" /></span>
            <span className="t">En planta</span>
            <span className="d">Operación, mantenimiento, turnos, inspecciones y seguridad.</span>
          </button>
          <button className={`area oficina ${area === "oficina" ? "sel" : ""}`} role="radio" aria-checked={area === "oficina"} onClick={() => onArea("oficina")}>
            <span className="burbuja grande tono-azul"><Building2 size={44} aria-hidden="true" /></span>
            <span className="t">En oficina</span>
            <span className="d">Correos, informes, actas, compras y documentos.</span>
          </button>
        </div>

        <div className="field sin-margen"><label id="lblModo"><span className="paso-n">3</span> ¿Qué quieres hacer hoy?</label></div>
        <div className="area-grid" role="radiogroup" aria-labelledby="lblModo">
          <button className={`card ${modo === "practica" ? "sel" : ""}`} role="radio" aria-checked={modo === "practica"} onClick={() => onModo("practica")}>
            <span className="burbuja tono-violeta"><GraduationCap size={28} aria-hidden="true" /></span>
            <span className="t">Practicar</span>
            <span className="d">Recomendado si es tu primera vez. Usas datos de ejemplo (falsos) y te guiamos paso a paso.</span>
            {practicadas ? <span className="tag done">{practicadas} práctica(s) hecha(s)</span> : <span className="tag">Empieza aquí</span>}
          </button>
          <button className={`card ${modo === "real" ? "sel" : ""}`} role="radio" aria-checked={modo === "real"} onClick={() => onModo("real")}>
            <span className="burbuja tono-verde"><BadgeCheck size={28} aria-hidden="true" /></span>
            <span className="t">Trabajar de verdad</span>
            <span className="d">Usas tus datos reales del día a día.</span>
          </button>
        </div>

        <div className="eleccion" aria-live="polite">
          <span className="eleccion-tit">Elegiste:</span>
          <span className={`eleccion-chip ${area ? "on" : ""}`}>
            {area ? <><CircleCheck size={18} aria-hidden="true" /> {area === "planta" ? "En planta" : "En oficina"}</> : "Falta: dónde trabajas"}
          </span>
          <span className={`eleccion-chip ${modo ? "on" : ""}`}>
            {modo ? <><CircleCheck size={18} aria-hidden="true" /> {modo === "practica" ? "Practicar" : "Trabajar de verdad"}</> : "Falta: qué quieres hacer"}
          </span>
        </div>
        <div className="row end">
          <button className="btn pri" onClick={onEntrar} disabled={!area || !modo}>Entrar <ArrowRight size={22} aria-hidden="true" /></button>
        </div>
        {(!area || !modo) && <p className="hint-end">Elige una opción en cada pregunta para continuar.</p>}
      </div>
    </>
  );
}
