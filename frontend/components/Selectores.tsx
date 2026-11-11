import { ArrowLeft, Brain, ChartLine, Check, Hand, Star } from "lucide-react";
import type { Skill, Tarea } from "@/lib/types";
import { Coach, Pasos } from "./Ayudas";
import { IconoBurbuja } from "./Icono";
import { Apps } from "./Apps";

export function SelectorTareas({ nombre, tareas, practica, hechas, onElegir, onGrafica }: {
  nombre: string; tareas: Tarea[]; practica: boolean; hechas: string[]; onElegir: (t: Tarea) => void; onGrafica: () => void;
}) {
  const n = tareas.filter((t) => hechas.includes(t.id)).length;
  return (
    <>
      <Pasos actual={1} />
      <h1 tabIndex={-1}>Hola{nombre ? `, ${nombre}` : ""}. ¿Qué tarea vas a hacer?</h1>
      <p className="lead">Toca el botón de la tarea con la que quieres que la IA te ayude.</p>
      <Coach visible={practica} icono={Hand} titulo="Paso 1: elige una tarea">
        Cada botón es un trabajo que la IA puede ayudarte a hacer. Prueba con cualquiera, aquí no puedes romper nada.
      </Coach>
      {practica && (
        <div className="panel glass avance">
          <b>Tu avance de práctica: {n} de {tareas.length} tareas</b>
          <div className="progress" role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={tareas.length}>
            <div style={{ width: `${(n / Math.max(tareas.length, 1)) * 100}%` }} />
          </div>
        </div>
      )}
      <div className="grid">
        {tareas.map((t) => (
          <button key={t.id} className="card" onClick={() => onElegir(t)}>
            {/* Si la tarea trabaja con programas (Word, Excel…), arriba van solo sus íconos */}
            <span className="card-top">
              {t.apps ? <Apps apps={t.apps} soloIconos /> : <IconoBurbuja nombre={t.ico} />}
            </span>
            <span className="t">{t.nombre}</span>
            <span className="d">{t.desc}</span>
            {practica && hechas.includes(t.id) && <span className="tag done"><Check size={14} strokeWidth={3} aria-hidden="true" /> Practicada</span>}
          </button>
        ))}
      </div>
      <button className="btn sec ver-grafica" onClick={onGrafica}>
        <ChartLine size={22} aria-hidden="true" /> Ver la gráfica diaria de lo enviado
      </button>
    </>
  );
}

export function SelectorSkill({ tarea, skills, practica, onElegir, onVolver }: {
  tarea: Tarea; skills: Record<string, Skill>; practica: boolean; onElegir: (id: string) => void; onVolver: () => void;
}) {
  return (
    <>
      <button className="back" onClick={onVolver}><ArrowLeft size={20} aria-hidden="true" /> Volver a las tareas</button>
      <Pasos actual={2} />
      <h1 tabIndex={-1}>{tarea.nombre}: ¿cómo quieres que trabaje la IA?</h1>
      <p className="lead">Un <b>skill</b> es una habilidad: le dice a la IA de qué forma hacer el trabajo. Elige una.</p>
      <Coach visible={practica} icono={Brain} titulo="Paso 2: elige un skill">
        Es como elegir a qué especialista le pides ayuda. El que dice <b>Recomendado</b> es el más usado para esta
        tarea, pero puedes probar otros y comparar el resultado.
      </Coach>
      <div className="grid">
        {tarea.skills.map((id, i) => {
          const s = skills[id];
          return (
            <button key={id} className="card" onClick={() => onElegir(id)}>
              <IconoBurbuja nombre={s.ico} />
              <span className="t">{s.nombre}</span>
              <span className="d">{s.corto}</span>
              {i === 0 && <span className="tag"><Star size={14} strokeWidth={2.5} aria-hidden="true" /> Recomendado</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
