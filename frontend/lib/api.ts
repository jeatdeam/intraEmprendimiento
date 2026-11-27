import type {
  ArchivoEjemplo, Area, Catalogo, Comparacion, EnvioDetalle, Historial, HistorialEquipo, HistorialUsuario, Inspeccion, Listo, Modo, MotivoEnvio, ReportesTarea, ReporteVisto, Resultado, Revision, RevisionFormato,
  Usuario,
} from "./types";

// Las llamadas a /api/* se redirigen al backend Python (ver next.config.ts).
async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa que el backend esté encendido.");
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const det = (body as { detail?: unknown }).detail;
    throw new Error(typeof det === "string" ? det : `Error del servidor (${r.status})`);
  }
  return body as T;
}

export const obtenerCatalogo = (area: Area) => pedir<Catalogo>(`/api/catalogo?area=${area}`);

export const obtenerUsuarios = () => pedir<Usuario[]>("/api/usuarios");

/** Consultas y archivos subidos de un usuario, del más nuevo al más viejo. */
export const obtenerHistorialUsuario = (usuario: string) =>
  pedir<HistorialUsuario>(`/api/usuarios/${encodeURIComponent(usuario)}/historial`);

export const obtenerEnvio = (usuario: string, id: number) =>
  pedir<EnvioDetalle>(`/api/usuarios/${encodeURIComponent(usuario)}/envios/${id}`);

export const ejecutarTarea = (p: {
  area: Area; tarea_id: string; skill_id: string; modo: Modo; usuario: string; datos: Record<string, string>;
}) =>
  pedir<Resultado>("/api/ejecutar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });

export function revisarArchivo(archivo: File, modo: Modo) {
  const fd = new FormData();
  fd.append("archivo", archivo);
  fd.append("modo", modo);
  return pedir<Revision>("/api/archivo/revisar", { method: "POST", body: fd });
}

export const revisarEjemplo = (modo: Modo = "practica") => pedir<Revision>(`/api/archivo/ejemplo?modo=${modo}`, { method: "POST" });

/** Valores diarios para la gráfica: con `usuario`, solo lo de esa persona; sin él, toda la planta. */
export const obtenerHistorial = (modo: Modo, dias: number, usuario?: string) =>
  pedir<Historial>(`/api/historial?modo=${modo}&dias=${dias}${usuario ? `&usuario=${encodeURIComponent(usuario)}` : ""}`);

export function revisarDocumento(archivo: File, formato: string, modo: Modo) {
  const fd = new FormData();
  fd.append("archivo", archivo);
  fd.append("formato", formato);
  fd.append("modo", modo);
  return pedir<RevisionFormato>("/api/documento/revisar", { method: "POST", body: fd });
}

export const revisarDocumentoEjemplo = (formato: string, modo: Modo = "practica") =>
  pedir<RevisionFormato>(`/api/documento/ejemplo?formato=${formato}&modo=${modo}`, { method: "POST" });

export const cambiarFormato = (id: string, formato: string, modo: Modo) =>
  pedir<RevisionFormato>(`/api/documento/cambiar-formato?id=${id}&formato=${formato}&modo=${modo}`, { method: "POST" });

export const obtenerHistorialEquipo = (equipo: string, modo: Modo, dias = 7) =>
  pedir<HistorialEquipo>(`/api/historial/equipo?equipo=${encodeURIComponent(equipo)}&modo=${modo}&dias=${dias}`);

/** Archivos ficticios de ejemplo del usuario: con `formato`, los 5 de ese formato; sin él, los de "Mi historial". */
export const obtenerListos = (usuario: string, formato?: string) =>
  pedir<Listo[]>(`/api/usuarios/${encodeURIComponent(usuario)}/listos${formato ? `?formato=${formato}` : ""}`);

/** Carga en el formulario un archivo de ejemplo, igual que si se hubiera subido. */
export const revisarListo = (usuario: string, id: string, formato: string, modo: Modo) =>
  pedir<RevisionFormato>(
    `/api/usuarios/${encodeURIComponent(usuario)}/listos/${encodeURIComponent(id)}/revisar?formato=${formato}&modo=${modo}`, { method: "POST" });

/** Vuelve a cargar en el formulario un documento que el usuario ya había enviado. */
export const revisarEnvio = (usuario: string, envio: number, formato: string, modo: Modo) =>
  pedir<RevisionFormato>(`/api/usuarios/${encodeURIComponent(usuario)}/envios/${envio}/revisar?formato=${formato}&modo=${modo}`, { method: "POST" });

/** Archivos de datos de ejemplo (Excel / CSV) del usuario. */
export const obtenerListosDatos = (usuario: string) =>
  pedir<ArchivoEjemplo[]>(`/api/usuarios/${encodeURIComponent(usuario)}/listos-datos`);

/** Carga en el formulario un archivo de datos de ejemplo, igual que si se hubiera subido. */
export const revisarListoDatos = (usuario: string, id: string, modo: Modo) =>
  pedir<Revision>(`/api/usuarios/${encodeURIComponent(usuario)}/listos-datos/${encodeURIComponent(id)}/revisar?modo=${modo}`, { method: "POST" });

/** Vuelve a cargar en el formulario un archivo de datos que el usuario ya había enviado. */
export const revisarEnvioDatos = (usuario: string, envio: number, modo: Modo) =>
  pedir<Revision>(`/api/usuarios/${encodeURIComponent(usuario)}/envios/${envio}/revisar-datos?modo=${modo}`, { method: "POST" });

/** Antes y después del documento de una revisión ya hecha en el formulario. */
export const antesDespues = (revision: string, modo: Modo, usuario: string) =>
  pedir<Comparacion>(`/api/documento/antes-despues?id=${revision}&modo=${modo}&usuario=${encodeURIComponent(usuario)}`, { method: "POST" });

/** Evalúa uno de esos archivos: dice si pasa el formato y devuelve el antes y el después. */
export const evaluarListo = (usuario: string, id: string) =>
  pedir<Comparacion>(`/api/usuarios/${encodeURIComponent(usuario)}/listos/${encodeURIComponent(id)}/evaluar`, { method: "POST" });

/** Lo mismo para un documento propio (Word, PDF o texto); el servidor reconoce a qué formato se parece. */
export function compararDocumento(archivo: File) {
  const fd = new FormData();
  fd.append("archivo", archivo);
  return pedir<Comparacion>("/api/documento/comparar", { method: "POST", body: fd });
}

export type MensajeChat = { role: "user" | "assistant"; content: string };

/** Chat libre ("Usar IA"): manda la conversación completa y devuelve la respuesta de la IA. */
export const chatear = (p: { area: Area; modo: Modo; usuario: string; mensajes: MensajeChat[] }) =>
  pedir<Resultado>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });

/** Base de datos de inspecciones de equipos (con `equipo`, solo las de ese equipo). */
export const obtenerInspecciones = (modo: Modo, equipo = "") =>
  pedir<Inspeccion[]>(`/api/inspecciones?modo=${modo}${equipo ? `&equipo=${encodeURIComponent(equipo)}` : ""}`);

/** Reportes anteriores de una tarea (toda la planta) y sus valores para la gráfica. */
export const obtenerReportesTarea = (area: Area, tarea: string, modo: Modo, equipo = "") =>
  pedir<ReportesTarea>(`/api/tarea/anteriores?area=${area}&tarea_id=${encodeURIComponent(tarea)}&modo=${modo}${equipo ? `&equipo=${encodeURIComponent(equipo)}` : ""}`);

/** Un archivo ya enviado y por qué fue aceptado o no. */
export const obtenerMotivo = (usuario: string, envio: number) =>
  pedir<MotivoEnvio>(`/api/usuarios/${encodeURIComponent(usuario)}/envios/${envio}/motivo`);

/** Un reporte anterior de una tarea (de toda la planta): su documento o archivo, por qué se aceptó y el resultado. */
export const obtenerReporte = (envio: number, modo: Modo) =>
  pedir<ReporteVisto>(`/api/reportes/${envio}?modo=${modo}`);
