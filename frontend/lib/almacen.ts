// Preferencias del empleado guardadas en el navegador (nombre, área, tamaño de letra, avance).
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
