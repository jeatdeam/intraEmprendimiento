"""Archivos FICTICIOS de ejemplo para arrastrar y evaluar: 5 por usuario y por formato oficial.

Aparecen en dos lugares:
  - Al revisar el formato de un documento (pantalla "Completa los datos"): los 5 del formato del skill elegido,
    debajo de los archivos que el usuario ya envió, para arrastrarlos al recuadro.
  - En "Mi historial": 5 según el trabajo del usuario (planta u oficina), para evaluarlos ahí mismo.
  - Al revisar un archivo de datos (Excel o CSV): 5 archivos de producción diaria (ver el final de este archivo).

Cada archivo se arma a partir de un documento bien hecho del usuario (`_base`) al que se le quitan o dañan
partes a propósito (`_variantes`); el documento bien hecho es la `correccion` que completa el "después"
(ver `comparador.py`).
"""
import re

from .comparador import comparar
from .formatos import _TEXTOS, _VALORES, FORMATOS, armar_documento
from .semilla_usuarios import _csv, _doc_diario, _doc_turno_carlos, _f, _produccion, _xlsx
from .usuarios import buscar_usuario

PLANTA_FICTICIA = "Central Renovable (ficticia)"


def _listo(lid: str, archivo: str, fid: str, detalle: str, valores: dict, secciones: dict, autor: str, *,
           cambia: dict | None = None, vacias: tuple[str, ...] = (), sin: tuple[str, ...] = (),
           sin_codigo: bool = False, retoque=None, planta: str = "Central Renovable") -> dict:
    """`cambia` daña campos, `vacias` deja secciones sin contenido, `sin` quita campos o secciones,
    `retoque` es una función que cambia el texto ya armado (título, orden, marcas de Markdown)."""
    texto = armar_documento(fid, {**valores, **(cambia or {})}, {**secciones, **{s: "" for s in vacias}},
                            autor=autor, planta=planta, sin_codigo=sin_codigo, sin=sin)
    return {"id": lid, "archivo": archivo, "formato": fid, "detalle": detalle,
            "texto": retoque(texto) if retoque else texto,
            "correccion": {"campos": valores, "secciones": secciones}}


def _desordenar(a: int, b: int):
    """Intercambia de lugar las secciones número `a` y `b` (con su contenido)."""
    def aplicar(texto: str) -> str:
        partes = re.split(r"(?m)^(?=\d+\. [A-ZÁÉÍÓÚÑ])", texto)
        partes[-1] = partes[-1].rstrip("\n") + "\n\n"
        partes[a], partes[b] = partes[b], partes[a]
        return "".join(partes).rstrip() + "\n"
    return aplicar


def _markdown(*titulos: str):
    """Como cuando se copia desde un chat: los títulos quedan con ** o con #."""
    def aplicar(texto: str) -> str:
        for n, t in enumerate(titulos):
            texto = re.sub(rf"(?m)^(\d+\. {re.escape(t.upper())})$", r"## \1" if n % 2 else r"**\1**", texto)
        return texto
    return aplicar


def _titulo(nuevo: str):
    return lambda texto: nuevo + "\n" + texto.split("\n", 1)[1]


def _seguidos(*retoques):
    def aplicar(texto: str) -> str:
        for r in retoques:
            texto = r(texto)
        return texto
    return aplicar


# ───────────────────────── Documentos bien hechos (la base de cada archivo) ─────────────────────────

def _falla_vibracion(autor: str) -> tuple[dict, dict]:
    valores = {"Fecha y hora": f"{_f(1)} 11:20", "Equipo": "Aerogenerador AG-01",
               "Ubicación": "Parque Eólico Norte, posición 1", "Prioridad": "Media", "Reportado por": autor}
    secciones = {
        "Descripción de la falla": (
            "El aerogenerador AG-01 presenta vibración alta en el rotor: 4,9 mm/s medidos en la ronda (lo normal es "
            "hasta 4,5 mm/s). Se nota un golpe suave en cada vuelta y el aspa 2 tiene una marca de impacto cerca de "
            "la punta. La vibración sube cuando el viento pasa de 10 m/s."),
        "Impacto en la operación": (
            "• El equipo sigue generando, pero se limitó al 80 % de su potencia para cuidar los rodamientos.\n"
            "• Se dejan de generar unos 8 MWh por día mientras dure la limitación.\n"
            "• Si la vibración llega a 6 mm/s el aerogenerador se detiene solo por protección."),
        "Riesgo para personas": (
            "Riesgo de caída de fragmentos si la marca del aspa crece. Se cerró el paso por la base de la torre "
            "en un radio de 50 metros. Nadie debe subir a la góndola con el rotor en movimiento."),
        "Acciones inmediatas": (
            "• Se avisó al supervisor de turno y a mantenimiento mecánico a las 11:30.\n"
            "• Se limitó la potencia desde el SCADA y se anotó la vibración cada hora.\n"
            "• Se tomó foto del aspa 2 con el dron de inspección."),
        "Acciones recomendadas": (
            "• Detener el equipo en la próxima ventana de viento bajo y revisar el aspa 2 de cerca.\n"
            "• Balancear el rotor y volver a medir la vibración.\n"
            "• Reparar la marca de impacto con resina antes de la temporada de lluvias."),
    }
    return valores, secciones


def _falla_transformador(autor: str) -> tuple[dict, dict]:
    valores = {"Fecha y hora": f"{_f(2)} 15:40", "Equipo": "Transformador principal TR-01",
               "Ubicación": "Subestación elevadora, bahía 1", "Prioridad": "Alta", "Reportado por": autor}
    secciones = {
        "Descripción de la falla": (
            "El aceite del transformador TR-01 llegó a 87 °C a las 15:30 (lo normal es hasta 85 °C). Uno de los "
            "cuatro ventiladores de enfriamiento no arranca: el motor zumba pero no gira. La tarde estuvo calurosa, "
            "con 31 °C de temperatura ambiente."),
        "Impacto en la operación": (
            "• Toda la energía de la planta sale por este transformador.\n"
            "• Si el aceite pasa de 95 °C la protección lo desconecta y la planta deja de entregar energía.\n"
            "• Por ahora no hay pérdida de producción."),
        "Riesgo para personas": (
            "Riesgo eléctrico de alta tensión en la bahía y riesgo de quemadura al tocar el tanque. "
            "La subestación está cerrada con candado y solo entra personal autorizado con permiso de trabajo."),
        "Acciones inmediatas": (
            "• Se avisó al supervisor de turno y al despacho a las 15:45.\n"
            "• Se pusieron los otros tres ventiladores en marcha manual; el aceite bajó a 83 °C a las 16:30.\n"
            "• Se anotó la temperatura del aceite cada 15 minutos."),
        "Acciones recomendadas": (
            "• Cambiar el motor del ventilador 3 con el circuito bloqueado y etiquetado (LOTO).\n"
            "• Limpiar los radiadores en la próxima parada programada.\n"
            "• Revisar el ajuste de la alarma de temperatura del aceite."),
    }
    return valores, secciones


def _semanal_actual(autor: str, para_directorio: bool) -> tuple[dict, dict]:
    """Reporte de la semana de la falla del AG-07."""
    valores = {"Semana": f"Del {_f(7)} al {_f(1)}", "Elaborado por": autor, "Generación de la semana": "8.650 MWh"}
    secciones = dict(_TEXTOS["semanal"])
    if para_directorio:
        secciones["Resumen ejecutivo"] += (" En lo administrativo se aprobó la compra urgente de 2 sellos de eje "
                                           "principal y se ejecutó el 84 % del presupuesto mensual de mantenimiento.")
        secciones["Plan de la próxima semana"] += "\n• Cerrar la orden de compra de los sellos y pagar al proveedor."
    return valores, secciones


def _practica(fid: str) -> tuple[dict, dict, str]:
    """Los datos de ejemplo del modo práctica (los mismos de `formatos.documento_ejemplo`)."""
    valores = {c["label"]: _VALORES[c["label"]] for c in FORMATOS[fid]["campos"]}
    autor = valores.get("Operador") or valores.get("Elaborado por") or valores.get("Reportado por", "")
    return valores, _TEXTOS[fid], autor


# ───────────────────────── Los 5 archivos de ejemplo de cada formato ─────────────────────────

_PREFIJO = {"turno": "reporte_turno", "falla": "aviso_falla", "planta": "reporte_diario_planta", "semanal": "reporte_semanal"}
_TITULO_MAL = {"turno": "INFORME DEL TURNO", "falla": "AVISO DE AVERÍA", "planta": "REPORTE DEL DÍA", "semanal": "RESUMEN SEMANAL"}
_MAL = {"fecha": "ayer", "numero": "por confirmar", "opcion": "Urgente", "texto": ""}    # un valor mal puesto, según el tipo
_FIRMA = ("Operador", "Elaborado por", "Reportado por")

# Los 5 que aparecen en "Mi historial": (formato, número de ejemplo), según el trabajo de cada usuario.
_EN_HISTORIAL = {
    "carlos": [("turno", 1), ("turno", 2), ("falla", 3), ("turno", 4), ("falla", 5)],
    "rosa": [("falla", 1), ("falla", 2), ("planta", 3), ("falla", 4), ("planta", 5)],
    "patricia": [("semanal", 1), ("semanal", 2), ("planta", 3), ("semanal", 4), ("planta", 5)],
    "fernando": [("semanal", 1), ("planta", 2), ("semanal", 3), ("planta", 4), ("semanal", 5)],
    "diego": [("turno", 1), ("turno", 2), ("falla", 3), ("turno", 4), ("falla", 5)],
}


def _base(uid: str, fid: str) -> tuple[dict, dict, str, str]:
    """El documento bien hecho de un usuario para un formato: (valores, secciones, autor, planta)."""
    if uid == "diego":      # el novato practica con los datos de ejemplo
        return (*_practica(fid), PLANTA_FICTICIA)
    yo = buscar_usuario(uid)["nombre"]
    if fid == "turno":
        v, s = _doc_turno_carlos(0, 448, False) if uid == "carlos" else _doc_turno_carlos(1, 462, True)
    elif fid == "falla":
        v, s = _falla_transformador(yo) if uid in ("rosa", "fernando") else _falla_vibracion(yo)
    elif fid == "planta":
        v, s = _doc_diario(3 if uid == "patricia" else 2, yo)
    else:
        v, s = _semanal_actual(yo, uid == "fernando")
    return {k: (yo if k in _FIRMA else x) for k, x in v.items()}, s, yo, "Central Renovable"


def _variantes(uid: str, fid: str) -> list[dict]:
    """Los 5 ejemplos de un formato: uno bien hecho y cuatro con errores distintos."""
    f = FORMATOS[fid]
    v, s, autor, planta = _base(uid, fid)
    campos = [c["label"] for c in f["campos"]]
    secs = [x["label"] for x in f["secciones"]]                       # la última siempre es Firmas
    tipo = {c["label"]: c["tipo"] for c in f["campos"]}
    medible = next(c for c in reversed(campos) if tipo[c] != "texto")   # el último campo que no es texto libre
    nombre = ("practica_" if uid == "diego" else "") + _PREFIJO[fid]
    hacer = lambda n, sufijo, detalle, **k: _listo(f"{fid}-{n}", f"{nombre}_{sufijo}", fid, detalle, v, s, autor,
                                                   planta=planta, **k)
    return [
        hacer(1, "final.docx", "Versión final, revisada antes de entregar"),
        hacer(2, "borrador.docx", "Borrador escrito apurado",
              cambia={medible: _MAL[tipo[medible]]}, vacias=(secs[4],), sin_codigo=True),
        hacer(3, "incompleto.pdf", "Versión a la que le faltan partes",
              cambia={campos[0]: _MAL[tipo[campos[0]]]}, sin=(campos[2], secs[2])),
        hacer(4, "copiado_del_chat.txt", "Copiado y pegado desde un chat", sin=("Firmas",),
              retoque=_seguidos(_titulo(_TITULO_MAL[fid]), _markdown(secs[0], secs[1]))),
        hacer(5, "desordenado.docx", "Con secciones cambiadas de lugar",
              cambia={campos[1]: ""}, retoque=_desordenar(3, 4)),
    ]


def _publico(l: dict) -> dict:
    """Lo que se muestra en la lista (sin decir si pasa o no: eso se ve al evaluar)."""
    return {"id": l["id"], "archivo": l["archivo"], "formato": l["formato"], "detalle": l["detalle"],
            "formato_nombre": FORMATOS[l["formato"]]["nombre"], "codigo": FORMATOS[l["formato"]]["codigo"]}


def listos_de(uid: str, formato: str | None = None) -> list[dict]:
    """Con `formato`, los 5 ejemplos de ese formato; sin él, los 5 de "Mi historial" según el trabajo del usuario."""
    if uid not in _EN_HISTORIAL:
        return []
    if formato:
        return [_publico(l) for l in _variantes(uid, formato)]
    return [_publico(_variantes(uid, fid)[n - 1]) for fid, n in _EN_HISTORIAL[uid]]


def buscar_listo(uid: str, lid: str) -> dict | None:
    fid, _, n = lid.rpartition("-")
    if uid not in _EN_HISTORIAL or fid not in FORMATOS or n not in ("1", "2", "3", "4", "5"):
        return None
    return _variantes(uid, fid)[int(n) - 1]


def evaluar_listo(uid: str, lid: str) -> dict | None:
    l = buscar_listo(uid, lid)
    return comparar(l["texto"], l["formato"], l["archivo"], l["correccion"]) if l else None


def correccion_de(uid: str, archivo: str, texto: str) -> dict | None:
    """Si el documento es uno de los archivos de ejemplo del usuario, los datos correctos para completar el después."""
    if uid not in _EN_HISTORIAL:
        return None
    for fid in FORMATOS:
        for l in _variantes(uid, fid):
            if l["archivo"] == archivo and l["texto"][:12000] == texto:
                return l["correccion"]
    return None


# ───────────────────────── Archivos de datos de ejemplo (Excel / CSV) ─────────────────────────

_TODOS = ["AG-01", "AG-07", "INV-03", "INV-05"]


def _datos_con_errores() -> list[list]:
    """Una semana tranquila a la que se le dañan cinco filas, como cuando se llena la planilla a mano."""
    filas = _produccion(8, 5, _TODOS, 41)
    manana = _f(-1).split("/")
    filas[2][4] = 130                                   # disponibilidad imposible
    filas[5][3] = ""                                    # generación vacía
    filas[7][6] = "roto"                                # estado que no existe
    filas[9][0] = f"{manana[2]}-{manana[1]}-{manana[0]}"   # fecha de mañana
    filas.append(list(filas[3]))                        # una fila repetida
    return filas


def _datos_sin_columnas() -> list[list]:
    """La planilla sin la columna Estado y con una columna que no es de la plantilla."""
    filas = _produccion(8, 5, _TODOS, 42)
    return [f[:6] + (["Observaciones"] if n == 0 else ["sin novedad"]) for n, f in enumerate(filas)]


# id -> (nombre del archivo, descripción, función que arma las filas)
_DATOS = {
    "semana-normal": ("produccion_semana_normal.xlsx", "Cuatro días de operación normal",
                      lambda: _produccion(8, 5, _TODOS, 40)),
    "semana-ag07": ("produccion_semana_AG-07.xlsx", "La semana de la falla del AG-07",
                    lambda: _produccion(7, 1, ["AG-01", "AG-07"], 31)),
    "inversores": ("produccion_inversores.csv", "Diez días de los inversores INV-03 e INV-05",
                   lambda: _produccion(12, 3, ["INV-03", "INV-05"], 32)),
    "mal-llenado": ("produccion_llenada_a_mano.csv", "Planilla llenada a mano, apurado", _datos_con_errores),
    "sin-columnas": ("produccion_otra_plantilla.csv", "Hecha con una plantilla antigua", _datos_sin_columnas),
}


def _nombre_datos(uid: str, archivo: str) -> str:
    return ("practica_" if uid == "diego" else "") + archivo


def listos_datos_de(uid: str) -> list[dict]:
    """Los 5 archivos de producción de ejemplo (los mismos para todos; el novato los ve como de práctica)."""
    if uid not in _EN_HISTORIAL:
        return []
    return [{"id": lid, "archivo": _nombre_datos(uid, archivo), "detalle": detalle}
            for lid, (archivo, detalle, _) in _DATOS.items()]


def buscar_listo_datos(uid: str, lid: str) -> tuple[str, bytes] | None:
    """Nombre y contenido (Excel o CSV de verdad) de un archivo de datos de ejemplo."""
    if uid not in _EN_HISTORIAL or lid not in _DATOS:
        return None
    archivo, _, armar = _DATOS[lid]
    return _nombre_datos(uid, archivo), (_xlsx if archivo.endswith(".xlsx") else _csv)(armar())
