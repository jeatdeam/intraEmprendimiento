export type Area = "planta" | "oficina";
export type Modo = "practica" | "real";
export type Pantalla = "inicio" | "tareas" | "skill" | "datos" | "procesando" | "resultado" | "grafica" | "historial" | "envio";

export type Perfil = "planta" | "ejecutivo" | "novato";

/** Un usuario de la plataforma. Su perfil define dónde trabaja y con qué modo entra por defecto. */
export interface Usuario {
  id: string;
  nombre: string;
  perfil: Perfil;
  perfil_nombre: string;
  cargo: string;
  area: Area;
  modo: Modo;
  consultas: number;
  archivos: number;
}

/** Lo esencial de la revisión de un archivo subido (documento con formato oficial o archivo de datos). */
export type ResumenRevision =
  | { tipo: "documento"; formato: string; codigo: string; aceptado: boolean; cumple: number; total: number; palabras: number }
  | { tipo: "archivo"; filas: number; equipos: number; desde: string | null; hasta: string | null; errores: number; bajos: number; altos: number; fallas: number };

/** Un envío guardado en el historial del usuario: una consulta o un archivo subido. */
export interface Envio {
  id: number;
  creado: string;
  modo: Modo;
  area: Area;
  tarea_id: string;
  tarea: string;
  skill_id: string;
  skill: string;
  archivo: string | null;
  resumen: string;
  origen: string;
  revision: ResumenRevision | null;
}

export interface EnvioDetalle extends Envio {
  campos: { label: string; valor: string }[];
  documento: string;
  texto: string;
}

export interface HistorialUsuario {
  consultas: Envio[];
  archivos: Envio[];
}

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

/** Archivo ficticio listo para evaluar (se arrastra al recuadro en "Mi historial"). */
export interface Listo {
  id: string;
  archivo: string;
  formato: string;
  formato_nombre: string;
  codigo: string;
  detalle: string;
}

/** Archivo de datos de ejemplo (Excel / CSV) para arrastrar al recuadro del formulario. */
export type ArchivoEjemplo = Pick<Listo, "id" | "archivo" | "detalle">;

export type Marca = "error" | "falta" | "aviso" | "nuevo" | "corregido" | "movido" | "pendiente";

/** Una línea de la hoja del antes o del después, con su marca si tiene un problema o un cambio. */
export interface LineaHoja { t: string; m?: Marca; nota?: string }

export interface HojaRevisada {
  aceptado: boolean;
  cumple: number;
  total: number;
  observaciones: string[];
  lineas: LineaHoja[];
}

/** Antes y después de un documento evaluado contra un formato oficial. */
export interface Comparacion {
  archivo: string;
  formato: string;
  nombre: string;
  codigo: string;
  revision: string;
  antes: HojaRevisada;
  despues: HojaRevisada & { texto: string };
  cambios: number;
  pendientes: number;
}
