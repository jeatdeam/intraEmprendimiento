import type { ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { IconoApp } from "./Apps";
import { appDeArchivo } from "./ListosParaEvaluar";

/**
 * Un archivo de las listas del formulario (ya enviados y de ejemplo): se arrastra al recuadro o se toca para cargarlo.
 * `clave` es lo que viaja al soltarlo: "envio:12" (ya enviado) o "listo:turno-2" (de ejemplo).
 */
export default function FilaArchivo({ clave, archivo, activo, onElegir, children }: {
  clave: string; archivo: string; activo: boolean; onElegir: () => void; children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button" className={`listo chico${activo ? " on" : ""}`} draggable aria-pressed={activo} onClick={onElegir}
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", clave); e.dataTransfer.effectAllowed = "copy"; }}
      >
        <span className="hist-ico"><IconoApp id={appDeArchivo(archivo)} size={28} /></span>
        <span className="hist-txt"><b>{archivo}</b>{children}</span>
        <GripVertical size={18} className="listo-agarre" aria-hidden="true" />
      </button>
    </li>
  );
}
