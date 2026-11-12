"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bot, Brain, Eye, GraduationCap, MousePointerClick, type LucideIcon } from "lucide-react";

const PAGINAS: { i: LucideIcon; t: string; p: React.ReactNode }[] = [
  { i: Bot, t: "¿Qué es la IA?", p: <>Es un programa que entiende lo que escribes y te ayuda a redactar, resumir, revisar números o explicar cosas. Es como un asistente que trabaja muy rápido.</> },
  { i: MousePointerClick, t: "Aquí solo tocas botones", p: <>1) Eliges la <b>tarea</b>. 2) Eliges el <b>skill</b>. 3) Revisas los datos. 4) Tocas <b>Enviar a la IA</b>. 5) Lees el resultado.</> },
  { i: Brain, t: "¿Qué es un skill?", p: <>Es una habilidad que le das a la IA. El mismo texto puede convertirse en un informe formal, en una lista corta o en una explicación fácil, según el skill que elijas.</> },
  { i: GraduationCap, t: "Modo práctica", p: <>Mientras estés en <b>Práctica</b>, todo usa <b>datos falsos</b>. No se envía nada a nadie. Equivócate todo lo que quieras: así se aprende.</> },
  { i: Eye, t: "Una regla de oro", p: <>La IA puede equivocarse. <b>Siempre lee el resultado</b> antes de usarlo, y nunca escribas contraseñas ni datos personales.</> },
];

export default function Tutorial({ onCerrar }: { onCerrar: () => void }) {
  const [n, setN] = useState(0);
  const siguiente = useRef<HTMLButtonElement>(null);
  const pg = PAGINAS[n];
  const I = pg.i;
  const ultima = n === PAGINAS.length - 1;

  useEffect(() => { siguiente.current?.focus(); }, [n]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCerrar]);

  return (
    <div className="modal-bg">
      <div className="modal glass" role="dialog" aria-modal="true" aria-labelledby="mt">
        <div className="modal-ico" key={n}><I size={40} strokeWidth={1.75} aria-hidden="true" /></div>
        <h2 id="mt">{pg.t}</h2>
        <p className="modal-p">{pg.p}</p>
        <div className="dots" aria-label={`Página ${n + 1} de ${PAGINAS.length}`}>
          {PAGINAS.map((x, i) => <i key={x.t} className={i === n ? "on" : ""} />)}
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="btn sec" onClick={() => setN(n - 1)} style={{ visibility: n ? "visible" : "hidden" }}>
            <ArrowLeft size={20} aria-hidden="true" /> Atrás
          </button>
          <button className="btn pri" ref={siguiente} onClick={() => (ultima ? onCerrar() : setN(n + 1))}>
            {ultima ? "¡Empezar a practicar!" : <>Siguiente <ArrowRight size={20} aria-hidden="true" /></>}
          </button>
        </div>
        <p style={{ textAlign: "center", margin: "14px 0 0" }}>
          <button className="back" style={{ margin: 0 }} onClick={onCerrar}>Saltar explicación</button>
        </p>
      </div>
    </div>
  );
}
