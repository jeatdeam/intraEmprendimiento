"""Datos FICTICIOS de una semana completa para que las gráficas tengan historia.

Se cargan una sola vez por modo (práctica y real) al iniciar el servidor, con origen 'semilla'
y nombre 'Datos de ejemplo'. Para no cargarlos, pon SEMBRAR_DATOS=false en el .env.
Para borrarlos: borra backend/historial.db (o las filas con origen='semilla').

Historias de la semana (días = días atrás):
  AG-07  fuga de aceite en la góndola que empeora → sobretemperatura y vibración → se detiene → reparación → vuelve.
  AG-01  vibración excesiva leve (desbalance de aspa) un día.
  INV-03 caída de voltaje por conector flojo y luego sobretemperatura por filtro sucio.
  INV-05 error de comunicación con el SCADA.
  TR-01  sin fallas; un día de temperatura alta por calor.
"""
import json
import random
from datetime import date, datetime, timedelta

from .equipos import EQUIPOS, opcion_equipo
from .historial import _con, puntos_inspeccion
from .reglas import RANGOS, RANGOS_FORMULARIO

# (días atrás) -> valores de la inspección que se salen de lo normal, por equipo
ESCENARIOS: dict[str, dict[int, dict]] = {
    "AG-07": {
        6: {"temperatura": 66, "vibracion": 3.4, "falla": "Fuga de aceite", "gravedad": "Leve",
            "observaciones": "Pequeña fuga de aceite en la góndola, cerca del sello del eje principal. Se limpió la zona."},
        5: {"temperatura": 72, "vibracion": 3.9, "falla": "Fuga de aceite", "gravedad": "Leve",
            "observaciones": "La mancha de aceite creció un poco. Se colocó paño absorbente y se pidió el sello de repuesto."},
        4: {"temperatura": 78, "vibracion": 4.7, "falla": "Fuga de aceite", "gravedad": "Moderada",
            "observaciones": "Nivel de aceite de la multiplicadora en el mínimo. Se escucha zumbido al girar el rotor."},
        3: {"voltaje": 648, "corriente": 2650, "temperatura": 84, "vibracion": 5.6, "falla": "Sobretemperatura",
            "gravedad": "Grave", "observaciones": "Alarma de sobretemperatura del aceite. El equipo se detuvo solo a las 15:20 "
                                                   "y se dejó bloqueado (LOTO) hasta la reparación.", "gen": 6.2},
        2: {"voltaje": 0, "corriente": 0, "temperatura": 29, "vibracion": 0, "falla": "Daño mecánico", "gravedad": "Moderada",
            "observaciones": "Equipo detenido por mantenimiento: cambio del sello del eje principal y relleno de aceite "
                             "de la multiplicadora.", "gen": 0},
    },
    "AG-01": {
        6: {"vibracion": 4.9, "falla": "Vibración excesiva", "gravedad": "Leve",
            "observaciones": "Desbalance leve en el aspa 2. Se programó el balanceo para la próxima parada."},
    },
    "INV-03": {
        4: {"voltaje": 371, "corriente": 1320, "falla": "Falla eléctrica / voltaje", "gravedad": "Moderada",
            "observaciones": "Caída de voltaje AC por un conector flojo en el string 4. Se reapretó y se midió de nuevo.",
            "gen": 3.1},
        3: {"temperatura": 64, "falla": "Sobretemperatura", "gravedad": "Leve",
            "observaciones": "Filtro de ventilación del gabinete sucio. Se limpió y la temperatura bajó a 52 °C."},
    },
    "INV-05": {
        1: {"falla": "Error de comunicación", "gravedad": "Leve",
            "observaciones": "Sin datos en el SCADA durante 2 horas. Se reinició la tarjeta de comunicación."},
    },
    "TR-01": {
        2: {"temperatura": 87, "observaciones": "Temperatura del aceite alta por el calor de la tarde; ventiladores funcionando."},
    },
}

NORMAL = {
    "aerogenerador": {"voltaje": (684, 700), "corriente": (1500, 2100), "temperatura": (55, 66), "vibracion": (2.4, 3.4)},
    "inversor": {"voltaje": (395, 408), "corriente": (1100, 1500), "temperatura": (38, 52), "vibracion": (0.4, 1.0)},
    "transformador": {"voltaje": (396, 406), "corriente": (1800, 2500), "temperatura": (55, 72), "vibracion": (0.8, 1.6)},
}
GEN_NORMAL = {"aerogenerador": (30, 50), "inversor": (10, 16)}
INSPECTORES = ["Juan Pérez", "Marta Díaz", "Luis Rojas"]


def sembrar(modo: str) -> bool:
    with _con() as c:
        if c.execute("SELECT COUNT(*) FROM envios WHERE modo = ? AND origen = 'semilla'", (modo,)).fetchone()[0]:
            return False
        rnd = random.Random(2026)
        hoy = date.today()

        def envio(fecha: date, hora: str, tarea_id: str, tarea: str, skill: str, quien: str) -> int:
            return c.execute(
                "INSERT INTO envios (creado, modo, area, tarea_id, tarea, skill_id, nombre, origen) "
                "VALUES (?, ?, 'planta', ?, ?, ?, ?, 'semilla')",
                (f"{fecha.isoformat()}T{hora}", modo, tarea_id, tarea, skill, f"{quien} (Datos de ejemplo)")).lastrowid

        def guardar(eid: int, puntos: list[tuple]):
            c.executemany(
                "INSERT INTO puntos (envio_id, modo, fecha, serie, unidad, valor, min, max, estado, detalle) VALUES (?,?,?,?,?,?,?,?,?,?)",
                [(eid, modo, f, s, u, v, mn, mx, e, json.dumps(d, ensure_ascii=False)) for f, s, u, v, mn, mx, e, d in puntos])

        for atras in range(7, 0, -1):
            f = hoy - timedelta(days=atras)
            fi = f.isoformat()
            total_gen = 0.0
            for k, eq in enumerate(EQUIPOS):
                esc = ESCENARIOS.get(eq["id"], {}).get(atras, {})
                datos = {"equipo": opcion_equipo(eq), "motivo": "Ronda diaria de inspección",
                         "falla": esc.get("falla", "Sin falla"), "gravedad": esc.get("gravedad", "Ninguna"),
                         "observaciones": esc.get("observaciones", "Sin novedades.")}
                for var, (a, b) in NORMAL[eq["tipo"]].items():
                    v = esc.get(var, rnd.uniform(a, b))
                    datos[var] = str(round(v, 1 if var == "vibracion" else 0))
                quien = INSPECTORES[(atras + k) % 3]
                eid = envio(f, f"{8 + k:02d}:{rnd.randint(0, 59):02d}:00", "inspeccion", "Inspección de equipo", "checklist", quien)
                pts = puntos_inspeccion(fi, datos)
                # Producción diaria del equipo (misma serie que el archivo de producción)
                if eq["tipo"] in GEN_NORMAL:
                    g = esc.get("gen", rnd.uniform(*GEN_NORMAL[eq["tipo"]]))
                    total_gen += g
                    mn, mx = RANGOS[eq["tipo"]]["generacion_mwh"][:2]
                    est = "falla" if esc.get("falla") and g < mn else ("bajo" if g < mn else "alto" if g > mx else "ok")
                    det = [] if est == "ok" else [f"Generación {g:.1f} MWh".replace(".", ",")]
                    pts.append((fi, f"{eq['id']} ({eq['tipo']})", "MWh", round(g, 1), mn, mx, est, det))
                # Aviso de falla urgente cuando la gravedad es Grave o Crítica
                if esc.get("gravedad") in ("Grave", "Crítica", "Moderada") and esc.get("falla"):
                    pts.append((fi, "Fallas reportadas", "", None, None, None, "falla",
                                [f"{eq['nombre']} · {esc['falla']} ({esc['gravedad']})"]))
                guardar(eid, pts)

            # Reportes de turno (3 por día) y lecturas de potencia
            mn, mx, u = RANGOS_FORMULARIO["turno"]
            for t, (nombre, hora) in enumerate([("Mañana", "14:05"), ("Tarde", "22:05"), ("Noche", "06:05")]):
                e = round(total_gen / 3 * 2.3 + rnd.uniform(-25, 25))
                est = "bajo" if e < mn else "alto" if e > mx else "ok"
                eid = envio(f, hora + ":00", "turno", "Reporte de turno", "formal", INSPECTORES[t])
                guardar(eid, [(fi, "Energía por turno (reportes)", u, e, mn, mx, est,
                               [] if est == "ok" else [f"Turno {nombre}: {e} {u} ({est})"])])
            mn, mx, u = RANGOS_FORMULARIO["lecturas"]
            prom = round(total_gen / 6.2 + rnd.uniform(-2, 2), 1)
            est = "bajo" if prom < mn else "alto" if prom > mx else "ok"
            eid = envio(f, "18:30:00", "lecturas", "Revisar lecturas de producción", "analista", "Marta Díaz")
            guardar(eid, [(fi, "Potencia (lecturas)", u, prom, mn, mx, est,
                           [] if est == "ok" else [f"Promedio del día: {prom} {u} ({est})".replace(".", ",")])])
    return True


def sembrar_todo():
    return {m: sembrar(m) for m in ("practica", "real")}


if __name__ == "__main__":
    print(sembrar_todo(), datetime.now())
