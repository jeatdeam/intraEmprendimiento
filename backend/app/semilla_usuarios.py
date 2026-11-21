"""Historial FICTICIO de cada usuario: 5 consultas y 5 archivos subidos por persona.

Se carga una sola vez por usuario al iniciar el servidor (origen 'semilla'). Cada envío pasa por el mismo
camino que uno real: se revisa el archivo, se genera el resultado con el simulador y se guarda con
`historial.registrar`, así que aparece en "Mi historial" y en las gráficas del usuario.

Todo cuenta la misma historia de la semana que `semilla.py` (días = días atrás):
  AG-07  fuga de aceite (6 a 4) → sobretemperatura y parada (3) → cambio de sello (2) → vuelve a operar (1).
  INV-03 caída de voltaje por un conector flojo (4).

Para no cargarlo: SEMBRAR_DATOS=false. Para volver a cargarlo: borra backend/historial.db.
"""
import io
import random
from datetime import date, datetime, timedelta

from .catalogo import buscar_tarea
from .equipos import EQUIPOS, opcion_equipo
from .formatos import armar_documento, documento_ejemplo, reporte_formato, revisar_formato
from .historial import _con, registrar
from .reglas import PLANTILLA, archivo_ejemplo, fmt, reporte_texto, validar_archivo
from .simulador import MESES, simular
from .usuarios import USUARIOS

AG07 = opcion_equipo(EQUIPOS[1])
_HOY = date.today


def _dia(atras: int) -> date:
    return _HOY() - timedelta(days=atras)


def _f(atras: int) -> str:
    return _dia(atras).strftime("%d/%m/%Y")


def _corta(atras: int) -> str:
    return _dia(atras).strftime("%d-%m")


# ───────────────────────── Archivos de producción (Excel / CSV) ─────────────────────────

# (equipo, días atrás) -> lo que se sale de lo normal ese día
_ANOMALIAS: dict[tuple[str, int], dict] = {
    ("AG-01", 11): {"gen": 64.3},                                   # generación sobre el rango
    ("INV-05", 12): {"temp_txt": "4O"},                             # letra O en vez de cero
    ("INV-05", 9): {"gen": 2.1},                                    # generación bajo el rango
    ("INV-03", 4): {"gen": 3.1},                                    # conector flojo
    ("INV-03", 3): {"temp": 64},                                    # filtro sucio
    ("AG-07", 4): {"temp": 78},                                     # la fuga empeora
    ("AG-07", 3): {"gen": 6.2, "disp": 41, "temp": 84, "estado": "falla"},
    ("AG-07", 2): {"gen": 0, "disp": 0, "temp": 29, "estado": "mantenimiento"},
}
_TIPO = {e["id"]: e["tipo"] for e in EQUIPOS}


def _produccion(desde: int, hasta: int, equipos: list[str], semilla: int) -> list[list]:
    """Filas del archivo de producción diaria, del día `desde` al día `hasta` (días atrás)."""
    rnd = random.Random(semilla)
    filas: list[list] = [[c["label"] for c in PLANTILLA["columnas"]]]
    for atras in range(desde, hasta - 1, -1):
        for eq in equipos:
            tipo = _TIPO[eq]
            a = _ANOMALIAS.get((eq, atras), {})
            gen = a.get("gen", rnd.uniform(30, 50) if tipo == "aerogenerador" else rnd.uniform(10, 16))
            disp, temp = a.get("disp", rnd.uniform(96, 100)), a.get("temp", rnd.uniform(34, 55))
            filas.append([_dia(atras).isoformat(), eq, tipo, round(gen, 1), round(disp, 1),
                          a.get("temp_txt", round(temp, 1)), a.get("estado", "operativo")])
    return filas


def _csv(filas: list[list]) -> bytes:
    lin = [";".join(fmt(c) if isinstance(c, float) else str(c) for c in f) for f in filas]
    return ("\n".join(lin) + "\n").encode("utf-8-sig")


def _xlsx(filas: list[list]) -> bytes:
    from openpyxl import Workbook
    libro = Workbook()
    hoja = libro.active
    hoja.title = "Producción"
    for f in filas:
        hoja.append(f)
    out = io.BytesIO()
    libro.save(out)
    return out.getvalue()


# ───────────────────────── Documentos (Word / PDF / texto) ─────────────────────────

def _doc_turno_carlos(atras: int, energia: int, despues_de_reparar: bool) -> tuple[dict, dict]:
    pot = fmt(energia / 8)
    valores = {"Fecha": _f(atras), "Turno": "Mañana (06:00 - 14:00)", "Operador": "Carlos Mendoza",
               "Energía generada": f"{energia} MWh"}
    if despues_de_reparar:
        eolico = energia - 150
        secciones = {
            "Resumen del turno": (
                f"Turno de mañana con la planta completa otra vez. Se generaron {energia} MWh con una potencia media de "
                f"{pot} MW. El aerogenerador AG-07 volvió a operar a las 09:30 después del cambio del sello del eje "
                "principal y terminó el turno sin alarmas."),
            "Producción": (
                "  Instalación  Energía (MWh)  Disponibilidad\n"
                f"  Parque Eólico Norte  {eolico}  95 %\n"
                "  Parque Solar Sur  150  99 %\n"
                f"Potencia media del turno: {pot} MW (rango normal 30–60 MW).\n"
                "Energía no generada por el AG-07 hasta las 09:30: 18 MWh aproximadamente."),
            "Novedades y eventos": (
                "• 06:30 — Ronda inicial sin alarmas activas en el SCADA.\n"
                "• 09:30 — Mantenimiento entregó el AG-07 y se puso en marcha con rampa lenta.\n"
                "• 10:15 — Parada de 15 minutos del AG-07 para la prueba de vibración: 2,9 mm/s, dentro de lo normal.\n"
                "• 11:40 — El inversor INV-05 estuvo 2 horas sin datos en el SCADA; se reinició la tarjeta de comunicación."),
            "Seguridad": (
                "• Sin accidentes ni incidentes en el turno.\n"
                "• Se retiraron los candados de bloqueo del AG-07 y se cerró el permiso de trabajo en altura.\n"
                "• Charla de inicio sobre orden y limpieza en la góndola."),
            "Pendientes": (
                "• Revisar el nivel de aceite de la multiplicadora del AG-07 al final del turno de tarde.\n"
                "• Pedir a sistemas la revisión de la tarjeta de comunicación del INV-05."),
        }
    else:
        secciones = {
            "Resumen del turno": (
                f"Turno de mañana con operación normal. Se generaron {energia} MWh con una potencia media de {pot} MW. "
                "El viento estuvo entre 7 y 10 m/s y el parque solar trabajó con cielo parcialmente nublado hasta las 09:00."),
            "Producción": (
                "  Instalación  Energía (MWh)  Disponibilidad\n"
                f"  Parque Eólico Norte  {energia - 143}  98 %\n"
                "  Parque Solar Sur  143  99 %\n"
                f"Potencia media del turno: {pot} MW (rango normal 30–60 MW).\n"
                "Pérdida estimada por la parada del AG-01: 2 MWh."),
            "Novedades y eventos": (
                "• 06:40 — Ronda inicial sin alarmas activas en el SCADA.\n"
                "• 08:15 — El aerogenerador AG-01 se detuvo 20 minutos por ráfagas y volvió a operar solo.\n"
                "• 10:30 — Se limpiaron los filtros de ventilación del inversor INV-05.\n"
                "• 12:10 — Bodega recibió 4 filtros y 2 bidones de aceite para multiplicadora."),
            "Seguridad": (
                "• Sin accidentes ni incidentes en el turno.\n"
                "• Se aplicó bloqueo y etiquetado (LOTO) en la limpieza de filtros del INV-05.\n"
                "• Charla de 5 minutos sobre uso del arnés antes de la ronda."),
            "Pendientes": (
                "• Revisar la cerca perimetral del sector norte (poste 14 inclinado).\n"
                "• Confirmar con mantenimiento la fecha del balanceo del aspa 2 del AG-01."),
        }
    return valores, secciones


def _doc_falla(equipo: str, lugar: str, atras: int, hora: str, prioridad: str, autor: str, caso: str) -> tuple[dict, dict]:
    valores = {"Fecha y hora": f"{_f(atras)} {hora}", "Equipo": equipo, "Ubicación": lugar,
               "Prioridad": prioridad, "Reportado por": autor}
    casos = {
        "voltaje": {
            "Descripción de la falla": (
                "El inversor INV-03 marcó caída de voltaje en la salida AC: 371 V medidos (lo normal es 380 a 420 V). "
                "La alarma apareció a las 16:35 con el parque nublado. En la revisión visual se encontró un conector "
                "flojo en el string 4, con marcas de calor en el plástico."),
            "Impacto en la operación": (
                "• La fila 12 del sector B generó 3,1 MWh en el día; lo normal son 10 a 16 MWh.\n"
                "• El inversor siguió conectado pero limitado al 30 % de su potencia.\n"
                "• No afecta a los demás inversores del sector."),
            "Riesgo para personas": (
                "Riesgo eléctrico si se manipula el conector con el string energizado y riesgo de quemadura por el "
                "conector caliente. No había personal en la fila. Se señalizó el gabinete."),
            "Acciones inmediatas": (
                "• Se avisó al supervisor de turno y a mantenimiento eléctrico a las 16:45.\n"
                "• Se abrió el seccionador del string 4 y se colocó candado y etiqueta.\n"
                "• Mantenimiento reapretó el conector y el inversor volvió a operar a las 17:40."),
            "Acciones recomendadas": (
                "• Cambiar el conector del string 4 en la próxima ventana sin sol.\n"
                "• Revisar con cámara térmica los demás conectores del gabinete.\n"
                "• Limpiar el filtro de ventilación, que se encontró sucio."),
        },
        "fuga": {
            "Descripción de la falla": (
                "Pequeña fuga de aceite en la góndola del AG-07, cerca del sello del eje principal. La mancha mide unos "
                "10 cm y no gotea hacia la torre. Las mediciones están normales: aceite a 66 °C y vibración de 3,4 mm/s."),
            "Impacto en la operación": (
                "• El aerogenerador sigue en operación normal y no hay pérdida de producción.\n"
                "• Si la fuga crece puede bajar el nivel de aceite de la multiplicadora y subir la temperatura.\n"
                "• Un aerogenerador detenido deja de entregar entre 30 y 50 MWh por día."),
            "Riesgo para personas": (
                "Riesgo de resbalón en el piso de la góndola por el aceite. Se limpió la zona y se dejó paño absorbente. "
                "No hay riesgo para personas en la base de la torre."),
            "Acciones inmediatas": (
                "• Se limpió la mancha y se marcó el borde para ver si crece.\n"
                "• Se avisó al supervisor de turno.\n"
                "• Se tomó foto y se anotó el nivel de aceite de la multiplicadora."),
            "Acciones recomendadas": (
                "• Revisar la mancha en cada ronda diaria y medir temperatura y vibración.\n"
                "• Pedir a bodega el sello del eje principal de repuesto.\n"
                "• Programar el cambio del sello en la próxima ventana de viento bajo."),
        },
        "sobretemperatura": {
            "Descripción de la falla": (
                "El AG-07 se detuvo solo a las 15:20 por la alarma de sobretemperatura del aceite de la multiplicadora "
                "(84 °C; el máximo normal es 75 °C). La vibración antes de la parada era de 5,6 mm/s. La fuga del sello "
                "del eje principal dejó el nivel de aceite bajo el mínimo."),
            "Impacto en la operación": (
                "• El aerogenerador generó 6,2 MWh en el día y quedó fuera de servicio.\n"
                "• Se dejan de generar unos 40 MWh por cada día detenido.\n"
                "• La reparación necesita unas 20 horas con el equipo bloqueado."),
            "Riesgo para personas": (
                "Riesgo de quemadura por aceite caliente y riesgo mecánico si el rotor gira durante la revisión. "
                "El equipo quedó bloqueado y etiquetado (LOTO) y con el freno del rotor aplicado."),
            "Acciones inmediatas": (
                "• Se bloqueó el equipo con candado y etiqueta a las 15:35.\n"
                "• Se avisó al supervisor de turno, a operaciones y a la gerencia.\n"
                "• Se contuvo el aceite con paños absorbentes y se retiró como residuo peligroso."),
            "Acciones recomendadas": (
                "• Cambiar el sello del eje principal y rellenar el aceite de la multiplicadora.\n"
                "• Tomar una muestra del aceite para análisis de partículas.\n"
                "• Hacer una prueba de vibración antes de devolver el equipo a operación."),
        },
    }
    return valores, casos[caso]


def _doc_diario(atras: int, autor: str) -> tuple[dict, dict]:
    """Reporte diario de planta del día en que se detuvo el AG-07 (3) o del día de su reparación (2)."""
    if atras == 3:
        valores = {"Fecha": _f(3), "Elaborado por": autor, "Generación total": "1.168 MWh", "Disponibilidad": "94,6 %"}
        secciones = {
            "Resumen del día": (
                "Día marcado por la parada del aerogenerador AG-07 a las 15:20 por sobretemperatura del aceite de la "
                "multiplicadora. La generación total fue de 1.168 MWh, un 7 % bajo el pronóstico. El resto de la planta "
                "operó con normalidad y no hubo eventos de seguridad."),
            "Producción": (
                "  Instalación  Energía (MWh)  Pronóstico (MWh)  Diferencia\n"
                "  Parque Eólico Norte  724  810  -10,6 %\n"
                "  Parque Solar Sur  444  446  -0,4 %\n"
                "  Total planta  1.168  1.256  -7,0 %\n"
                "La diferencia se explica por la parada del AG-07, que generó 6,2 MWh de los 40 MWh esperados."),
            "Equipos fuera de servicio": (
                "• AG-07 — Detenido desde las 15:20 por sobretemperatura (84 °C). Bloqueado y etiquetado. "
                "Se cambia el sello del eje principal; retorno estimado en 36 horas.\n"
                "• INV-03 — Operativo. Se limpió el filtro de ventilación tras marcar 64 °C en el gabinete."),
            "Seguridad": (
                "• 0 accidentes y 0 incidentes.\n"
                "• 2 permisos de trabajo emitidos: uno de altura y uno eléctrico.\n"
                "• El aceite derramado en la góndola se contuvo con paños y se dispuso como residuo peligroso."),
            "Pendientes": (
                "• Cambiar el sello del AG-07 y rellenar el aceite de la multiplicadora.\n"
                "• Informar al coordinador del sistema la indisponibilidad del AG-07.\n"
                "• Reprogramar el pronóstico de mañana sin el AG-07."),
        }
    else:
        valores = {"Fecha": _f(2), "Elaborado por": autor, "Generación total": "1.132 MWh", "Disponibilidad": "92,1 %"}
        secciones = {
            "Resumen del día": (
                "Día con el aerogenerador AG-07 detenido por mantenimiento correctivo. Se cambió el sello del eje "
                "principal y se rellenó el aceite de la multiplicadora. La generación total fue de 1.132 MWh, en línea "
                "con el pronóstico corregido. Sin eventos de seguridad."),
            "Producción": (
                "  Instalación  Energía (MWh)  Pronóstico (MWh)  Diferencia\n"
                "  Parque Eólico Norte  682  690  -1,2 %\n"
                "  Parque Solar Sur  450  441  +2,0 %\n"
                "  Total planta  1.132  1.131  +0,1 %\n"
                "El pronóstico ya consideraba el AG-07 fuera de servicio durante todo el día."),
            "Equipos fuera de servicio": (
                "• AG-07 — Detenido todo el día por el cambio del sello del eje principal. Trabajo terminado a las 18:10; "
                "se pone en marcha mañana a las 09:30 después de la prueba de vibración.\n"
                "• TR-01 — Operativo. El aceite llegó a 87 °C en la tarde por el calor; ventiladores funcionando."),
            "Seguridad": (
                "• 0 accidentes y 0 incidentes.\n"
                "• 3 permisos de trabajo: altura, izaje del sello y trabajo eléctrico.\n"
                "• Se verificó el bloqueo y etiquetado del AG-07 al inicio de cada turno."),
            "Pendientes": (
                "• Puesta en marcha del AG-07 y prueba de vibración.\n"
                "• Enviar la muestra de aceite al laboratorio.\n"
                "• Cerrar la orden de trabajo y registrar las 42 horas de parada."),
        }
    return valores, secciones


def _doc_semanal(autor: str, para_directorio: bool) -> tuple[dict, dict]:
    valores = {"Semana": f"Del {_f(14)} al {_f(8)}", "Elaborado por": autor, "Generación de la semana": "8.720 MWh"}
    secciones = {
        "Resumen ejecutivo": (
            "La planta generó 8.720 MWh en la semana, un 1 % bajo la meta de 8.820 MWh. La disponibilidad promedio fue "
            "de 97,4 %. No hubo fallas mayores: se registró un desbalance leve en el aspa 2 del AG-01 y una lectura mal "
            "cargada del INV-05. Sin accidentes."),
        "Producción de la semana": (
            "  Instalación  Energía (MWh)  Meta (MWh)  Cumplimiento\n"
            "  Parque Eólico Norte  5.560  5.700  98 %\n"
            "  Parque Solar Sur  3.160  3.120  101 %\n"
            "  Total  8.720  8.820  99 %\n"
            "Mejor día: 64,3 MWh del AG-01, sobre su rango normal por viento fuerte y sostenido.\n"
            "Día más bajo: el INV-05 generó 2,1 MWh por sombra de nubes y limpieza pendiente."),
        "Fallas y mantenimiento": (
            "• AG-01 — Desbalance leve en el aspa 2 (vibración de 4,9 mm/s). Balanceo programado para la próxima parada.\n"
            "• INV-05 — Un día con generación baja (2,1 MWh). Se limpiaron los paneles de la fila 4.\n"
            "• Mantenimientos preventivos cumplidos: 11 de 12 (92 %).\n"
            "• Repuestos críticos en bodega: completos, salvo el sello del eje principal de los aerogeneradores."),
        "Seguridad": (
            "• 0 accidentes con tiempo perdido; 139 días sin accidentes.\n"
            "• 2 observaciones preventivas cerradas y 1 abierta (señalización del acceso a la subestación).\n"
            "• 6 técnicos completaron la capacitación de trabajo en altura."),
        "Plan de la próxima semana": (
            "• Balanceo del aspa 2 del AG-01 en ventana de viento bajo.\n"
            "• Limpieza de paneles de los sectores B y C.\n"
            "• Compra del sello del eje principal para dejar uno en stock.\n"
            "• Auditoría interna del procedimiento de bloqueo y etiquetado."),
    }
    if para_directorio:
        secciones["Resumen ejecutivo"] += (" En lo administrativo se ejecutó el 78 % del presupuesto mensual de "
                                           "mantenimiento y quedan 2 órdenes de compra por aprobar.")
        secciones["Plan de la próxima semana"] += "\n• Aprobar la compra de 20 pares de guantes dieléctricos clase 2."
    return valores, secciones


# ───────────────────────── Lo que hizo cada usuario ─────────────────────────

def _carlos() -> list[dict]:
    v1, s1 = _doc_turno_carlos(10, 405, False)
    vf, sf = _doc_falla("Inversor solar INV-03", "Parque Solar Sur, sector B fila 12", 4, "16:55", "Media", "Carlos Mendoza", "voltaje")
    v3, s3 = _doc_turno_carlos(1, 462, True)
    turno = lambda **k: armar_documento("turno", autor="Carlos Mendoza", **k)
    falla = lambda **k: armar_documento("falla", autor="Carlos Mendoza", **k)
    return [
        # archivos subidos (reportes para revisar el formato)
        {"atras": 10, "hora": "14:30", "tarea": "formato", "skill": "fmt_turno", "archivo": f"reporte_turno_{_corta(10)}.docx",
         "documento": turno(valores={**v1, "Fecha": "ayer"}, secciones=s1, sin_codigo=True, sin=("Seguridad",))},
        {"atras": 9, "hora": "08:15", "tarea": "formato", "skill": "fmt_turno", "archivo": f"reporte_turno_{_corta(10)}_corregido.docx",
         "documento": turno(valores=v1, secciones=s1)},
        {"atras": 4, "hora": "22:40", "tarea": "formato", "skill": "fmt_falla", "archivo": "aviso_falla_INV-03.pdf",
         "documento": falla(valores={**vf, "Prioridad": "Urgente"}, secciones=sf,
                            sin=("Impacto en la operación", "Acciones recomendadas"))},
        {"atras": 3, "hora": "09:00", "tarea": "formato", "skill": "fmt_falla", "archivo": "aviso_falla_INV-03_v2.pdf",
         "documento": falla(valores=vf, secciones=sf)},
        {"atras": 1, "hora": "14:30", "tarea": "formato", "skill": "fmt_turno", "archivo": f"reporte_turno_{_corta(1)}.docx",
         "documento": turno(valores=v3, secciones=s3)},
        # consultas
        {"atras": 9, "hora": "14:10", "tarea": "turno", "skill": "formal", "datos": {
            "turno": "Mañana (06:00 - 14:00)", "operador": "Carlos Mendoza", "generacion": "438",
            "novedades": "Turno estable con viento medio de 9 m/s. El aerogenerador AG-01 se detuvo 25 minutos por ráfagas "
                         "y volvió a operar solo. Se limpiaron los filtros del inversor INV-05. Llegó el camión con aceite "
                         "para la multiplicadora del AG-07. Falta revisar la cerca del sector norte el lunes. "
                         "Hay que confirmar con mantenimiento el balanceo del aspa 2 del AG-01."}},
        {"atras": 7, "hora": "13:30", "tarea": "lecturas", "skill": "analista", "datos": {
            "lecturas": "06:00: 41\n07:00: 46\n08:00: 52\n09:00: 55\n10:00: 57\n11:00: 24\n12:00: 56\n13:00: 53"}},
        {"atras": 4, "hora": "22:10", "tarea": "turno", "skill": "puntos", "datos": {
            "turno": "Tarde (14:00 - 22:00)", "operador": "Carlos Mendoza", "generacion": "395",
            "novedades": "La nubosidad de la tarde bajó la producción solar. El inversor INV-03 marcó caída de voltaje por "
                         "un conector flojo en el string 4. Mantenimiento reapretó el conector y el inversor volvió a "
                         "operar a las 17:40. Se hizo la ronda de la subestación sin novedades. "
                         "Falta limpiar el filtro de ventilación del INV-03."}},
        {"atras": 3, "hora": "15:40", "tarea": "falla", "skill": "formal", "datos": {
            "equipo": "Aerogenerador AG-07", "ubicacion": "Parque Eólico Norte, posición 7", "urgencia": "Alta - hoy mismo",
            "descripcion": "Saltó la alarma de sobretemperatura del aceite de la multiplicadora y el equipo se detuvo solo "
                           "a las 15:20. Hay una mancha de aceite en la góndola cerca del sello del eje principal. "
                           "Se escucha un zumbido al girar el rotor a mano. La producción del aerogenerador quedó en cero."}},
        {"atras": 1, "hora": "14:05", "tarea": "turno", "skill": "analista", "datos": {
            "turno": "Mañana (06:00 - 14:00)", "operador": "Carlos Mendoza", "generacion": "462",
            "novedades": "El aerogenerador AG-07 volvió a operar a las 09:30 después del cambio del sello del eje principal. "
                         "Se detuvo 15 minutos para una prueba de vibración y siguió normal. El inversor INV-05 estuvo "
                         "2 horas sin datos en el SCADA y se reinició la tarjeta de comunicación. "
                         "Falta revisar el nivel de aceite del AG-07 al final del próximo turno."}},
    ]


def _rosa() -> list[dict]:
    lugar = "Parque Eólico Norte, posición 7"
    vf, sf = _doc_falla("Aerogenerador AG-07", lugar, 6, "09:35", "Baja", "Rosa Quispe", "fuga")
    vs, ss = _doc_falla("Aerogenerador AG-07", lugar, 3, "15:50", "Alta", "Rosa Quispe", "sobretemperatura")
    vd, sd = _doc_diario(3, "Rosa Quispe (jefa de turno suplente)")
    falla = lambda **k: armar_documento("falla", autor="Rosa Quispe", **k)
    diario = lambda **k: armar_documento("planta", autor="Rosa Quispe", **k)
    inspeccion = lambda motivo, v, a, t, vib, falla_, grav, obs: {
        "equipo": AG07, "motivo": motivo, "voltaje": v, "corriente": a, "temperatura": t, "vibracion": vib,
        "falla": falla_, "gravedad": grav, "observaciones": obs}
    return [
        {"atras": 6, "hora": "09:50", "tarea": "formato", "skill": "fmt_falla", "archivo": "aviso_falla_AG-07_fuga.docx",
         "documento": falla(valores={**vf, "Reportado por": ""}, secciones=sf, sin=("Riesgo para personas",))},
        {"atras": 5, "hora": "08:30", "tarea": "formato", "skill": "fmt_falla", "archivo": "aviso_falla_AG-07_fuga_v2.docx",
         "documento": falla(valores=vf, secciones=sf)},
        {"atras": 3, "hora": "16:10", "tarea": "formato", "skill": "fmt_falla", "archivo": "aviso_falla_AG-07_sobretemperatura.docx",
         "documento": falla(valores=vs, secciones=ss)},
        {"atras": 3, "hora": "17:30", "tarea": "formato", "skill": "fmt_planta", "archivo": f"reporte_diario_planta_{_corta(3)}.pdf",
         "documento": diario(valores={**vd, "Disponibilidad": "regular"}, secciones=sd, sin_codigo=True, sin=("Seguridad",))},
        {"atras": 2, "hora": "08:40", "tarea": "formato", "skill": "fmt_planta", "archivo": f"reporte_diario_planta_{_corta(3)}_v2.pdf",
         "documento": diario(valores=vd, secciones=sd)},
        {"atras": 6, "hora": "09:20", "tarea": "inspeccion", "skill": "checklist", "datos": inspeccion(
            "Ronda diaria de inspección", "692", "1850", "66", "3,4", "Fuga de aceite", "Leve",
            "Pequeña fuga de aceite en la góndola cerca del sello del eje principal. "
            "Se limpió la zona y se dejó una marca para ver si crece.")},
        {"atras": 4, "hora": "10:05", "tarea": "inspeccion", "skill": "formal", "datos": inspeccion(
            "Seguimiento de la fuga de aceite", "688", "1790", "78", "4,7", "Fuga de aceite", "Moderada",
            "La mancha de aceite creció y el nivel de la multiplicadora está en el mínimo. Se escucha un zumbido al "
            "girar el rotor. Se pidió el sello de repuesto a bodega. Falta definir la parada para el cambio del sello.")},
        {"atras": 4, "hora": "10:40", "tarea": "falla", "skill": "formal", "datos": {
            "equipo": "Aerogenerador AG-07", "ubicacion": lugar, "urgencia": "Alta - hoy mismo",
            "descripcion": "La fuga de aceite del sello del eje principal empeoró en dos días. La temperatura del aceite "
                           "subió a 78 °C y la vibración a 4,7 mm/s. El nivel de aceite de la multiplicadora está en el "
                           "mínimo. Si sigue operando puede detenerse por sobretemperatura."}},
        {"atras": 2, "hora": "08:10", "tarea": "procedimiento", "skill": "checklist", "datos": {
            "pregunta": "¿Qué pasos de seguridad debo seguir para cambiar el sello del eje principal del aerogenerador "
                        "AG-07 con el equipo detenido?"}},
        {"atras": 1, "hora": "11:15", "tarea": "inspeccion", "skill": "puntos", "datos": inspeccion(
            "Verificación después del cambio de sello", "694", "1820", "61", "2,9", "Sin falla", "Ninguna",
            "Equipo en operación desde las 09:30. Sin manchas de aceite en la góndola. Nivel de aceite de la "
            "multiplicadora en el punto medio. Se retiró el bloqueo y se cerró el permiso de trabajo.")},
    ]


def _patricia() -> list[dict]:
    todos = ["AG-01", "AG-07", "INV-03", "INV-05"]
    vs, ss = _doc_semanal("Patricia Salazar", False)
    vd, sd = _doc_diario(2, "Patricia Salazar")
    semanal = lambda **k: armar_documento("semanal", autor="Patricia Salazar", **k)
    ayer, mes = _dia(1), _dia(10).replace(day=1) - timedelta(days=1)
    return [
        {"atras": 7, "hora": "09:30", "tarea": "archivo", "skill": "analista", "archivo": "produccion_semana_anterior.xlsx",
         "xlsx": _produccion(14, 8, todos, 11)},
        {"atras": 7, "hora": "15:10", "tarea": "formato", "skill": "fmt_semanal", "archivo": "reporte_semanal_operaciones.docx",
         "documento": semanal(valores={**vs, "Semana": ""}, secciones=ss, sin=("Plan de la próxima semana",))},
        {"atras": 6, "hora": "09:05", "tarea": "formato", "skill": "fmt_semanal", "archivo": "reporte_semanal_operaciones_v2.docx",
         "documento": semanal(valores=vs, secciones=ss)},
        {"atras": 1, "hora": "08:50", "tarea": "archivo", "skill": "puntos", "archivo": "produccion_semana_actual.xlsx",
         "xlsx": _produccion(7, 2, todos, 12)},
        {"atras": 1, "hora": "17:20", "tarea": "formato", "skill": "fmt_planta", "archivo": f"reporte_diario_planta_{_corta(2)}.pdf",
         "documento": armar_documento("planta", valores=vd, secciones=sd, autor="Patricia Salazar")},
        {"atras": 10, "hora": "09:15", "tarea": "informe", "skill": "analista", "datos": {
            "periodo": f"{MESES[mes.month - 1].capitalize()} {mes.year}",
            "datos": "Parque Eólico Norte: 18400\nParque Solar Sur: 12950\nParque Solar Este: 9800\nEólico Cerro Alto: 4100"}},
        {"atras": 8, "hora": "11:40", "tarea": "resumen", "skill": "puntos", "datos": {
            "texto": "El coordinador del sistema publicó el nuevo procedimiento de programación diaria. Desde el 1 de enero "
                     "las centrales renovables deben enviar su pronóstico de generación antes de las 10:00 del día anterior. "
                     "El pronóstico debe venir por bloques de 15 minutos. Las desviaciones mayores al 12 % se penalizan con "
                     "un cargo por energía. La planta debe nombrar un responsable titular y un suplente. También se exige "
                     "un reporte mensual de disponibilidad por equipo. Se recomienda revisar los medidores y la conexión "
                     "con el SCADA antes de diciembre."}},
        {"atras": 4, "hora": "16:30", "tarea": "acta", "skill": "formal", "datos": {
            "asistentes": "Patricia Salazar, Fernando Castillo, Rosa Quispe, Carlos Mendoza",
            "notas": "Se revisó la fuga de aceite del aerogenerador AG-07 y su efecto en la meta semanal. Rosa explicó que "
                     "la fuga viene del sello del eje principal. Fernando informó que el sello de repuesto llega mañana. "
                     "Se acuerda detener el AG-07 mañana para el cambio del sello. Carlos debe coordinar la ventana de "
                     "viento bajo con el despacho. Patricia pide un informe de causa raíz para la próxima semana."}},
        {"atras": 3, "hora": "17:05", "tarea": "correo", "skill": "correo", "datos": {
            "para": "Jefe de Mantenimiento", "tema": "Parada del aerogenerador AG-07",
            "puntos": "el AG-07 se detuvo hoy por sobretemperatura del aceite. necesito el plan de reparación y la hora "
                      "estimada de retorno. cada día detenido son cerca de 40 MWh menos. quiero el informe de causa raíz "
                      "antes del viernes"}},
        {"atras": 1, "hora": "10:20", "tarea": "informe", "skill": "formal", "datos": {
            "periodo": f"1 al {ayer.day} de {MESES[ayer.month - 1]} de {ayer.year}",
            "datos": "Parque Eólico Norte: 8950\nParque Solar Sur: 6480\nParque Solar Este: 4720\nEólico Cerro Alto: 1560"}},
    ]


def _fernando() -> list[dict]:
    vs, ss = _doc_semanal("Fernando Castillo", True)
    vd, sd = _doc_diario(3, "Fernando Castillo")
    semanal = lambda **k: armar_documento("semanal", autor="Fernando Castillo", **k)
    # Borrador pasado desde un chat: quedó con marcas de Markdown, sin firmas y con un campo sin número.
    borrador = armar_documento("planta", valores={**vd, "Generación total": "pendiente de confirmar"}, secciones=sd,
                               autor="Fernando Castillo", sin=("Firmas",)).replace("1. RESUMEN DEL DÍA", "**1. RESUMEN DEL DÍA**")
    return [
        {"atras": 8, "hora": "16:00", "tarea": "formato", "skill": "fmt_semanal", "archivo": "reporte_semanal_directorio.docx",
         "documento": semanal(valores=vs, secciones=ss, sin_codigo=True, sin=("Seguridad",))},
        {"atras": 7, "hora": "11:00", "tarea": "formato", "skill": "fmt_semanal", "archivo": "reporte_semanal_directorio_final.docx",
         "documento": semanal(valores=vs, secciones=ss)},
        {"atras": 5, "hora": "10:00", "tarea": "archivo", "skill": "analista", "archivo": "produccion_inversores.csv",
         "csv": _produccion(12, 6, ["INV-03", "INV-05"], 21)},
        {"atras": 2, "hora": "12:00", "tarea": "formato", "skill": "fmt_planta", "archivo": "borrador_reporte_diario.txt",
         "documento": borrador},
        {"atras": 1, "hora": "09:20", "tarea": "archivo", "skill": "simple", "archivo": "produccion_aerogeneradores.csv",
         "csv": _produccion(7, 2, ["AG-01", "AG-07"], 22)},
        {"atras": 9, "hora": "15:00", "tarea": "acta", "skill": "puntos", "datos": {
            "asistentes": "Fernando Castillo, Patricia Salazar, Ana Gómez",
            "notas": "Se revisó el presupuesto de mantenimiento del próximo año. Patricia presentó la necesidad de 2 drones "
                     "para inspección de aspas. Ana pide capacitación en IA para el personal de oficina. Se acuerda pedir "
                     "tres cotizaciones de drones antes de fin de mes. Fernando revisa el saldo del centro de costo de "
                     "mantenimiento."}},
        {"atras": 7, "hora": "09:45", "tarea": "compra", "skill": "correo", "datos": {
            "articulo": "Guantes dieléctricos clase 2", "cantidad": "20 pares",
            "motivo": "Los guantes actuales vencen su certificación en diciembre. Son obligatorios para los trabajos en "
                      "media tensión. Sin ellos no se pueden hacer las maniobras de la subestación."}},
        {"atras": 4, "hora": "11:30", "tarea": "compra", "skill": "formal", "datos": {
            "articulo": "Sello del eje principal para aerogenerador AG-07", "cantidad": "2 unidades",
            "motivo": "El sello actual tiene una fuga de aceite y mantenimiento pidió el cambio. No hay repuesto en bodega. "
                      "Sin el sello el aerogenerador puede detenerse por sobretemperatura. Se pide una unidad para el "
                      "cambio y otra para dejar en stock."}},
        {"atras": 4, "hora": "12:10", "tarea": "correo", "skill": "correo", "datos": {
            "para": "Proveedor Eólica Andina S.A.", "tema": "Entrega urgente de sellos de eje principal",
            "puntos": "necesitamos 2 sellos del eje principal para el aerogenerador AG-07. el equipo tiene una fuga de "
                      "aceite y puede detenerse. pedimos la entrega para mañana en la planta. enviar hoy la cotización "
                      "y el certificado del fabricante"}},
        {"atras": 1, "hora": "16:10", "tarea": "resumen", "skill": "simple", "datos": {
            "texto": "El contrato de mantenimiento con el fabricante de los aerogeneradores vence el 31 de marzo. "
                     "La renovación por tres años incluye dos mantenimientos preventivos al año por equipo. El costo sube "
                     "un 6 % respecto al contrato actual. El fabricante garantiza una disponibilidad mínima de 96 %. "
                     "Si no se cumple debe pagar una compensación. Los repuestos mayores como sellos y rodamientos no "
                     "están incluidos. La planta debe responder antes del 15 de enero."}},
    ]


def _diego() -> list[dict]:
    """El novato solo ha practicado: usa los datos de ejemplo de cada tarea y los archivos ficticios del modo práctica."""
    ej = lambda tarea, area="planta": dict(buscar_tarea(area, tarea)["ejemplo"])
    doc = lambda fid: {"tarea": "formato", "skill": f"fmt_{fid}", "archivo": f"ejemplo_{fid}.txt", "documento": documento_ejemplo(fid)}
    return [
        {"atras": 6, "hora": "10:30", **doc("turno")},
        {"atras": 4, "hora": "10:10", **doc("falla")},
        {"atras": 3, "hora": "15:00", "area": "oficina", "tarea": "archivo", "skill": "analista",
         "archivo": "produccion_ejemplo.csv", "csv": archivo_ejemplo()},
        {"atras": 2, "hora": "11:30", **doc("planta")},
        {"atras": 1, "hora": "11:00", **doc("semanal")},
        # El mismo reporte con dos skills, para comparar. Le falta practicar la inspección de equipo.
        {"atras": 6, "hora": "10:00", "tarea": "turno", "skill": "formal", "datos": ej("turno")},
        {"atras": 6, "hora": "10:15", "tarea": "turno", "skill": "puntos", "datos": ej("turno")},
        {"atras": 5, "hora": "10:20", "tarea": "procedimiento", "skill": "simple", "datos": ej("procedimiento")},
        {"atras": 4, "hora": "09:40", "tarea": "falla", "skill": "checklist", "datos": ej("falla")},
        {"atras": 1, "hora": "10:30", "tarea": "lecturas", "skill": "analista", "datos": ej("lecturas")},
    ]


HISTORIAL = {"carlos": _carlos, "rosa": _rosa, "patricia": _patricia, "fernando": _fernando, "diego": _diego}


# ───────────────────────── Carga ─────────────────────────

def _guardar(u: dict, item: dict, planta: str) -> None:
    area = item.get("area", u["area"])
    tarea = buscar_tarea(area, item["tarea"])
    skill = item["skill"]
    h, m = item["hora"].split(":")
    cuando = datetime.combine(_dia(item["atras"]), datetime.min.time()).replace(hour=int(h), minute=int(m))
    datos, res, revision = dict(item.get("datos", {})), None, None

    if "documento" in item:
        res = revisar_formato(item["documento"], skill.removeprefix("fmt_"), item["archivo"])
        datos = {"documento": reporte_formato(res)}
    elif "csv" in item or "xlsx" in item:
        contenido = item["csv"] if isinstance(item.get("csv"), bytes) else (
            _csv(item["csv"]) if "csv" in item else _xlsx(item["xlsx"]))
        res = validar_archivo(contenido, "datos.xlsx" if "xlsx" in item else "datos.csv")
        res["archivo"] = item["archivo"]
        datos = {"archivo": reporte_texto(res)}
        revision = ("", res, False)

    texto = simular(area, tarea, skill, datos, u["nombre"], planta, res, cuando)
    registrar(u["modo"], area, tarea, skill, u["nombre"], "semilla", datos, revision,
              usuario=u["id"], texto=texto, archivo=res, cuando=cuando)


def sembrar_usuarios(planta: str = "Central Renovable") -> dict[str, bool]:
    """Carga el historial de ejemplo de cada usuario que todavía no lo tiene."""
    hecho = {}
    for u in USUARIOS:
        with _con() as c:
            ya = c.execute("SELECT COUNT(*) FROM envios WHERE usuario = ? AND origen = 'semilla'", (u["id"],)).fetchone()[0]
        hecho[u["id"]] = not ya
        if ya:
            continue
        for item in sorted(HISTORIAL[u["id"]](), key=lambda i: (-i["atras"], i["hora"])):
            _guardar(u, item, planta)
    return hecho
