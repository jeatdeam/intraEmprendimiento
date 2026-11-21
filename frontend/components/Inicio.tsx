import { ArrowRight, BadgeCheck, Building2, Check, CircleCheck, Factory, GraduationCap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Area, Modo, Usuario } from "@/lib/types";

interface Props {
  usuarios: Usuario[];
  usuario: Usuario | null;
  area: Area | null;
  modo: Modo | null;
  practicadas: number;
  onUsuario: (u: Usuario) => void;
  onArea: (a: Area) => void;
  onModo: (m: Modo) => void;
  onEntrar: () => void;
}

export const iniciales = (nombre: string) => nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

/** Opción grande de una pregunta: icono en una tecla, texto y una marca redonda que se rellena al elegirla. */
function Opcion({ icono: I, titulo, desc, elegida, onElegir, children }: {
  icono: LucideIcon; titulo: string; desc: string; elegida: boolean; onElegir: () => void; children?: ReactNode;
}) {
  return (
    <button className={`opcion ${elegida ? "sel" : ""}`} role="radio" aria-checked={elegida} onClick={onElegir}>
      <span className="burbuja"><I size={22} aria-hidden="true" /></span>
      <span className="opcion-txt">
        <span className="t">{titulo}</span>
        <span className="d">{desc}</span>
        {children}
      </span>
      <span className="opcion-marca" aria-hidden="true"><Check size={15} strokeWidth={3} /></span>
    </button>
  );
}

export default function Inicio({ usuarios, usuario, area, modo, practicadas, onUsuario, onArea, onModo, onEntrar }: Props) {
  const falta = !usuario || !area || !modo;
  return (
    <div className="inicio">
      <section className="hero glass">
        <h1 tabIndex={-1}>Bienvenido al Asistente de IA</h1>
        <p className="lead">
          Una herramienta simple para que la inteligencia artificial te ayude con tus tareas. Solo tienes que tocar
          botones.
        </p>
      </section>

      <section className="pregunta glass quien">
        <h2 id="lblUsuario"><span className="paso-n">1</span> Elige tu usuario</h2>
        <div className="usuarios" role="radiogroup" aria-labelledby="lblUsuario">
          {usuarios.map((u) => {
            const sel = usuario?.id === u.id;
            return (
              <button key={u.id} className={`usuario ${sel ? "sel" : ""}`} role="radio" aria-checked={sel} onClick={() => onUsuario(u)}>
                <span className={`avatar ${u.perfil}`} aria-hidden="true">{iniciales(u.nombre)}</span>
                <span className="t">{u.nombre}</span>
                <span className="d">{u.cargo}</span>
                <span className={`perfil ${u.perfil}`}>{u.perfil_nombre}</span>
                <span className="usuario-cuenta">{u.consultas} consultas · {u.archivos} archivos</span>
                <span className="opcion-marca" aria-hidden="true"><Check size={15} strokeWidth={3} /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="pregunta glass">
        <h2 id="lblArea"><span className="paso-n">2</span> ¿Dónde trabajas?</h2>
        <div className="opciones" role="radiogroup" aria-labelledby="lblArea">
          <Opcion icono={Factory} titulo="En planta" desc="Operación, mantenimiento, turnos, inspecciones y seguridad."
            elegida={area === "planta"} onElegir={() => onArea("planta")} />
          <Opcion icono={Building2} titulo="En oficina" desc="Correos, informes, actas, compras y documentos."
            elegida={area === "oficina"} onElegir={() => onArea("oficina")} />
        </div>
      </section>

      <section className="pregunta glass">
        <h2 id="lblModo"><span className="paso-n">3</span> ¿Qué quieres hacer hoy?</h2>
        <div className="opciones" role="radiogroup" aria-labelledby="lblModo">
          <Opcion icono={GraduationCap} titulo="Practicar"
            desc="Recomendado si es tu primera vez. Usas datos de ejemplo (falsos) y te guiamos paso a paso."
            elegida={modo === "practica"} onElegir={() => onModo("practica")}>
            {practicadas ? <span className="tag done">{practicadas} práctica(s) hecha(s)</span> : <span className="tag">Empieza aquí</span>}
          </Opcion>
          <Opcion icono={BadgeCheck} titulo="Trabajar de verdad" desc="Usas tus datos reales del día a día."
            elegida={modo === "real"} onElegir={() => onModo("real")} />
        </div>
      </section>

      <section className="entrar glass">
        <div className="eleccion" aria-live="polite">
          <span className="eleccion-tit">Elegiste:</span>
          <span className={`eleccion-chip ${usuario ? "on" : ""}`}>
            {usuario ? <><CircleCheck size={18} aria-hidden="true" /> {usuario.nombre}</> : "Falta: tu usuario"}
          </span>
          <span className={`eleccion-chip ${area ? "on" : ""}`}>
            {area ? <><CircleCheck size={18} aria-hidden="true" /> {area === "planta" ? "En planta" : "En oficina"}</> : "Falta: dónde trabajas"}
          </span>
          <span className={`eleccion-chip ${modo ? "on" : ""}`}>
            {modo ? <><CircleCheck size={18} aria-hidden="true" /> {modo === "practica" ? "Practicar" : "Trabajar de verdad"}</> : "Falta: qué quieres hacer"}
          </span>
          {falta && <p className="hint-end">Elige tu usuario y una opción en cada pregunta para continuar.</p>}
        </div>
        <button className="btn pri" onClick={onEntrar} disabled={falta}>Entrar <ArrowRight size={22} aria-hidden="true" /></button>
      </section>
    </div>
  );
}
