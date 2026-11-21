// Preferencias guardadas en el navegador (último usuario elegido, tamaño de letra, tutorial visto).
// El historial y el avance de práctica de cada usuario se guardan en el servidor, no aquí.
const PREFIJO = "iaPlanta_";

export function leer<T>(clave: string, defecto: T): T {
  try {
    const v = localStorage.getItem(PREFIJO + clave);
    return v ? (JSON.parse(v) as T) : defecto;
  } catch {
    return defecto;
  }
}

export function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    /* almacenamiento no disponible */
  }
}
