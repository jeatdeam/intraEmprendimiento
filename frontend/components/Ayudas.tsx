import type { ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";

const NOMBRES_PASOS = ["Elegir tarea", "Elegir skill", "Completar datos", "La IA trabaja", "Revisar resultado"];

export function Pasos({ actual }: { actual: number }) {
  return (
    <ol className="steps" aria-label="Pasos">
      {NOMBRES_PASOS.map((n, i) => {
        const p = i + 1;
        const estado = p === actual ? "on" : p < actual ? "done" : "";
        return (
          <li key={n} className={estado} aria-current={p === actual ? "step" : undefined}>
            <span className="num">{p < actual ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : p}</span>
            <span>{n}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Caja de ayuda: solo aparece en el modo práctica. */
export function Coach({ visible, icono: I, titulo, children }: { visible: boolean; icono: LucideIcon; titulo: string; children: ReactNode }) {
  if (!visible) return null;
  return (
    <div className="coach glass" role="note">
      <span className="coach-ico"><I size={20} aria-hidden="true" /></span>
      <div>
        <b>{titulo}</b>
        <p>{children}</p>
      </div>
    </div>
  );
}
