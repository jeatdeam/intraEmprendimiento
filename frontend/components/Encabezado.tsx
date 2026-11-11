import { BadgeCheck, Building2, CircleHelp, Factory, GraduationCap, LogOut, TriangleAlert } from "lucide-react";
import type { Area, Modo } from "@/lib/types";
import { Logo } from "./Ilustraciones";

interface Props {
  planta: string;
  area: Area | null;
  modo: Modo;
  enInicio: boolean;
  onAyuda: () => void;
  onSalir: () => void;
  onLetra: (px: number) => void;
}

export default function Encabezado({ planta, area, modo, enInicio, onAyuda, onSalir, onLetra }: Props) {
  const practica = modo === "practica";
  return (
    <>
      <header className="glass topbar">
        <div className="wrap">
          <div className="logo">
            <Logo size={42} />
            <span>
              <b>{planta}</b>
              <small>Asistente IA</small>
            </span>
          </div>
          {area && !enInicio && (
            <>
              <span className={`chip ${area}`}>
                {area === "planta" ? <Factory size={16} aria-hidden="true" /> : <Building2 size={16} aria-hidden="true" />}
                {area === "planta" ? "Planta" : "Oficina"}
              </span>
              <span className={`chip ${practica ? "practica" : "real"}`}>
                {practica ? <GraduationCap size={16} aria-hidden="true" /> : <BadgeCheck size={16} aria-hidden="true" />}
                {practica ? "Práctica" : "Trabajo real"}
              </span>
              <button className="hbtn" onClick={onAyuda}><CircleHelp size={18} aria-hidden="true" /> Ayuda</button>
              <button className="hbtn" onClick={onSalir}><LogOut size={18} aria-hidden="true" /> Cambiar perfil</button>
            </>
          )}
          <div className="fontctl" role="group" aria-label="Tamaño de letra">
            <button className="hbtn" onClick={() => onLetra(18)} aria-label="Letra normal">A</button>
            <button className="hbtn" onClick={() => onLetra(22)} aria-label="Letra grande">A+</button>
            <button className="hbtn" onClick={() => onLetra(26)} aria-label="Letra muy grande">A++</button>
          </div>
        </div>
      </header>
      {practica && !enInicio && (
        <div className="wrap">
          <div className="banner-practica glass">
            <TriangleAlert size={20} aria-hidden="true" />
            <span><b>Modo práctica:</b> los datos son ficticios. Nada de lo que hagas aquí se guarda en sistemas reales.</span>
          </div>
        </div>
      )}
    </>
  );
}
