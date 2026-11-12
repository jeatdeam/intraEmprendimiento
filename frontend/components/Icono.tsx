import {
  BookOpen, CalendarDays, ChartColumn, Factory, FileCheck2, FileSpreadsheet, ChartLine, Clock, FileText, ListChecks, Mail, MessageCircle, PenLine,
  ScanSearch, ShieldCheck, ShoppingCart, Sparkles, TriangleAlert, Users, Zap, type LucideIcon,
} from "lucide-react";

/** Iconos de skills y tareas (las claves vienen del backend, campo "ico"). */
const ICONOS: Record<string, LucideIcon> = {
  // skills
  formal: PenLine, puntos: ListChecks, simple: MessageCircle, checklist: ShieldCheck, analista: ChartLine, correo: Mail,
  // tareas de planta
  turno: Clock, falla: TriangleAlert, inspeccion: ScanSearch, procedimiento: BookOpen, lecturas: Zap,
  // tareas de oficina
  mail: Mail, resumen: FileText, acta: Users, informe: ChartColumn, compra: ShoppingCart, archivo: FileSpreadsheet,
  // revisión de formatos
  formato: FileCheck2, planta: Factory, semanal: CalendarDays,
};

export function Icono({ nombre, size = 26 }: { nombre: string; size?: number }) {
  const C = ICONOS[nombre] ?? Sparkles;
  return <C size={size} strokeWidth={2} aria-hidden="true" />;
}

/** Icono dentro de una "tecla" oscura en relieve. */
export function IconoBurbuja({ nombre, size = 22 }: { nombre: string; size?: number }) {
  return (
    <span className="burbuja">
      <Icono nombre={nombre} size={size} />
    </span>
  );
}
