export type Area = "planta" | "oficina";
export type Modo = "practica" | "real";
export type Pantalla = "inicio" | "tareas" | "skill" | "datos" | "procesando" | "resultado" | "grafica";

export interface Skill {
  nombre: string;
  ico: string;
  corto: string;
  pasos: string[];
}

export interface Campo {
  id: string;
  label: string;
  tipo: "text" | "area" | "select" | "archivo" | "documento";
  opciones?: string[];
  hint?: string;
  opcional?: boolean;
}

export interface Tarea {
  id: string;
  ico: string;
  nombre: string;
  desc: string;
  skills: string[];
  campos: Campo[];
  ejemplo: Record<string, string>;
  apps?: string[];
}

export interface Catalogo {
  skills: Record<string, Skill>;
  tareas: Tarea[];
  planta: string;
  ia_configurada: boolean;
}

export interface Resultado {
  texto: string;
  origen: "ia" | "simulado";
}

export type EstadoDato = "ok" | "bajo" | "alto" | "error" | "falla";

export interface Problema {
  fila: number;
  columna: string;
  valor: string;
  tipo: Exclude<EstadoDato, "ok">;
  mensaje: string;
}

/** Resultado de revisar un archivo Excel/CSV. */
export interface Revision {
  id: string;
  archivo: string;
  plantilla: string;
  filas: number;
  bloqueado: boolean;
  estructura: string[];
  problemas: Problema[];
  resumen: {
    errores: number; bajos: number; altos: number; fallas: number; validas: number;
    desde: string | null; hasta: string | null; equipos: number;
  };
}

export interface DiaSerie {
  fecha: string;
  valor: number | null;
  registros: number;
  estado: EstadoDato;
  detalle: string[];
}

export interface Serie {
  id: string;
  nombre: string;
  unidad: string;
  min: number | null;
  max: number | null;
  dias: DiaSerie[];
  alertas: number;
}

export interface Historial {
  desde: string;
  hasta: string;
  series: Serie[];
  alertas: { fecha: string; serie: string; estado: EstadoDato; detalle: string[] }[];
  envios: { total: number; por_tarea: { tarea: string; n: number; ultimo: string }[] };
}

/** Resultado de revisar un documento contra un formato oficial de la empresa. */
export interface RevisionFormato {
  id: string;
  formato: string;
  nombre: string;
  codigo: string;
  revision: string;
  archivo: string;
  palabras: number;
  aceptado: boolean;
  cumple: number;
  total: number;
  checks: { grupo: string; label: string; ok: boolean; detalle: string }[];
  observaciones: string[];
}

/** Historial de los últimos días de un equipo (panel al costado del formulario). */
export interface HistorialEquipo {
  equipo: { id: string; tipo: string; nombre: string; ubicacion: string };
  fechas: string[];
  variables: {
    id: string; nombre: string; unidad: string; min: number | null; max: number | null;
    dias: Record<string, { valor: number; estado: EstadoDato; detalle: string[] }>;
  }[];
  eventos: Record<string, { estado: EstadoDato; detalle: string }[]>;
  dias_mal: string[];
}
