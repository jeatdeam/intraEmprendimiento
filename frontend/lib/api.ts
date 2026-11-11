import type { Area, Catalogo, Historial, HistorialEquipo, Modo, Resultado, Revision, RevisionFormato } from "./types";

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

export const ejecutarTarea = (p: {
  area: Area; tarea_id: string; skill_id: string; modo: Modo; nombre: string; datos: Record<string, string>;
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

export const revisarEjemplo = () => pedir<Revision>("/api/archivo/ejemplo", { method: "POST" });

export const obtenerHistorial = (modo: Modo, dias: number) =>
  pedir<Historial>(`/api/historial?modo=${modo}&dias=${dias}`);

export function revisarDocumento(archivo: File, formato: string, modo: Modo) {
  const fd = new FormData();
  fd.append("archivo", archivo);
  fd.append("formato", formato);
  fd.append("modo", modo);
  return pedir<RevisionFormato>("/api/documento/revisar", { method: "POST", body: fd });
}

export const revisarDocumentoEjemplo = (formato: string) =>
  pedir<RevisionFormato>(`/api/documento/ejemplo?formato=${formato}`, { method: "POST" });

export const cambiarFormato = (id: string, formato: string, modo: Modo) =>
  pedir<RevisionFormato>(`/api/documento/cambiar-formato?id=${id}&formato=${formato}&modo=${modo}`, { method: "POST" });

export const obtenerHistorialEquipo = (equipo: string, modo: Modo, dias = 7) =>
  pedir<HistorialEquipo>(`/api/historial/equipo?equipo=${encodeURIComponent(equipo)}&modo=${modo}&dias=${dias}`);
