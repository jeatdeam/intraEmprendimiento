"""Datos de DEMO: que cada tarea tenga reportes anteriores y que las fechas estén siempre al día.

1. `refrescar_fechas()`: los datos de ejemplo (origen 'semilla') se cargan una sola vez, el día que se crea la base.
   Si pasaron días, se corren todas sus fechas para que el último día de ejemplo sea AYER.
   Así el calendario de "Reportes anteriores" nunca queda vacío.
2. `sembrar_tareas()`: cada tarea (planta y oficina, práctica y real) queda con al menos 5 reportes de los últimos
   días, enviados por el personal de la planta (usuario ''). Pasan por el mismo simulador y el mismo `registrar`
   que un envío de verdad, así guardan su resultado y sus valores para la gráfica.
"""
from datetime import date, datetime, timedelta

from .catalogo import buscar_tarea
from .formatos import reporte_formato, revisar_formato
from .historial import _con, registrar
from .listos import _variantes, buscar_listo_datos
from .reglas import reporte_texto, validar_archivo
from .simulador import simular

PERSONAL = ["Juan Pérez", "Marta Díaz", "Luis Rojas", "Ana Gómez", "Jorge Villa"]
MINIMO = 5


def refrescar_fechas() -> int:
    """Corre las fechas de los datos de ejemplo para que terminen ayer. Devuelve cuántos grupos se movieron.

    Se mueve por grupos: el historial de cada usuario como un bloque (su historia sigue en orden) y,
    para los datos de toda la planta (usuario ''), cada tarea por separado.
    """
    ayer = date.today() - timedelta(days=1)
    movidos = 0
    with _con() as c:
        grupos = c.execute(
            "SELECT modo, usuario, CASE WHEN usuario = '' THEN tarea_id ELSE '' END AS t, MAX(substr(creado, 1, 10)) AS ultimo "
            "FROM envios WHERE origen = 'semilla' GROUP BY modo, usuario, t").fetchall()
        for g in grupos:
            dias = (ayer - date.fromisoformat(g["ultimo"])).days
            if dias <= 0:
                continue
            filtro = "origen = 'semilla' AND modo = ? AND usuario = ?" + (" AND tarea_id = ?" if g["t"] else "")
            args = (g["modo"], g["usuario"], g["t"]) if g["t"] else (g["modo"], g["usuario"])
            c.execute(f"UPDATE puntos SET fecha = date(fecha, '+{dias} days') "
                      f"WHERE envio_id IN (SELECT id FROM envios WHERE {filtro})", args)
            c.execute(f"UPDATE envios SET creado = strftime('%Y-%m-%dT%H:%M:%S', creado, '+{dias} days') WHERE {filtro}", args)
            movidos += 1
    return movidos


# ───────────── Reportes anteriores de cada tarea (5 por tarea) ─────────────
# Cada item: (días atrás, hora, skill, datos) — o un documento / archivo de datos.

def _planta() -> dict[str, list[dict]]:
    return {
        "falla": [
            {"skill": "formal", "datos": {"equipo": "Aerogenerador AG-07", "ubicacion": "Parque Eólico Norte, posición 7",
                                          "urgencia": "Alta - hoy mismo",
                                          "descripcion": "Fuga de aceite en la góndola junto al sello del eje principal. La mancha creció "
                                                         "en dos días y el nivel de la multiplicadora está en el mínimo. Temperatura del "
                                                         "aceite 78 °C. Se colocó paño absorbente y se pidió el sello SE-450."}},
            {"skill": "checklist", "datos": {"equipo": "Inversor solar INV-03", "ubicacion": "Parque Solar Sur, sector B fila 12",
                                             "urgencia": "Media - esta semana",
                                             "descripcion": "El ventilador derecho del gabinete hace ruido y gira lento. Temperatura del "
                                                            "gabinete 58 °C. Filtro de aire con mucho polvo. La producción de la fila se "
                                                            "mantiene normal por ahora."}},
            {"skill": "simple", "datos": {"equipo": "Transformador TR-01", "ubicacion": "Subestación principal",
                                          "urgencia": "Baja - puede esperar",
                                          "descripcion": "El silicagel del respirador cambió a color rosado en la mitad del frasco. "
                                                         "Temperatura y nivel de aceite normales. Sin fugas."}},
            {"skill": "formal", "datos": {"equipo": "Cerco perimetral sector norte", "ubicacion": "Parque Eólico Norte, acceso 2",
                                          "urgencia": "Media - esta semana",
                                          "descripcion": "Un poste del cerco está suelto y la malla quedó caída en unos 3 metros. "
                                                         "Ingresaron animales al parque. Se puso cinta de peligro."}},
            {"skill": "checklist", "datos": {"equipo": "Aerogenerador AG-01", "ubicacion": "Parque Eólico Norte, posición 1",
                                             "urgencia": "Crítica - riesgo para personas",
                                             "descripcion": "Durante la ronda se escuchó un golpe metálico en el rotor y la vibración subió a "
                                                            "6,1 mm/s. El equipo se detuvo solo por protección. Se bloqueó (LOTO) y se "
                                                            "prohibió el acceso a 150 m a la redonda hasta la revisión."}},
        ],
        "procedimiento": [
            {"skill": "checklist", "datos": {"pregunta": "¿Qué revisar antes de subir a la góndola de un aerogenerador si el viento está en 12 m/s?"}},
            {"skill": "simple", "datos": {"pregunta": "¿Cómo se cambia el filtro de ventilación de un inversor sin cortar la producción de todo el sector?"}},
            {"skill": "checklist", "datos": {"pregunta": "¿Cuáles son los pasos para hacer el bloqueo y etiquetado (LOTO) del tablero TB-02 del parque solar?"}},
            {"skill": "simple", "datos": {"pregunta": "¿Qué hago si encuentro una fuga de aceite debajo del transformador TR-01?"}},
            {"skill": "checklist", "datos": {"pregunta": "¿Cómo se realiza la limpieza de paneles solares con agua y qué protección personal necesito?"}},
        ],
        "formato": [_doc("carlos", "turno", 1, "fmt_turno"), _doc("rosa", "falla", 2, "fmt_falla"),
                    _doc("carlos", "turno", 3, "fmt_turno"), _doc("rosa", "planta", 1, "fmt_planta"),
                    _doc("carlos", "falla", 4, "fmt_falla")],
    }


def _oficina() -> dict[str, list[dict]]:
    return {
        "archivo": [_datos(lid) for lid in ("semana-normal", "semana-ag07", "inversores", "mal-llenado", "sin-columnas")],
        "correo": [
            {"skill": "correo", "datos": {"para": "Bodega central", "tema": "Repuestos para el AG-07",
                                          "puntos": "necesito confirmar si llegó el sello SE-450 y los 2 filtros. es urgente por la fuga "
                                                    "del AG-07. si no hay stock pedir al proveedor con entrega en 48 horas"}},
            {"skill": "formal", "datos": {"para": "Gerencia de Operaciones", "tema": "Resumen de la semana",
                                          "puntos": "generación 3 % sobre la meta. AG-07 detenido 1 día por cambio de sello. "
                                                    "sin accidentes. capacitación de IA pendiente con RRHH"}},
            {"skill": "correo", "datos": {"para": "Proveedor Solartec S.A. (ficticio)", "tema": "Confirmación de visita técnica",
                                          "puntos": "confirmar visita del técnico el jueves 9:00 para revisar los inversores INV-03 e "
                                                    "INV-05. traer repuesto del ventilador VF-220"}},
            {"skill": "simple", "datos": {"para": "Equipo de planta", "tema": "Simulacro de evacuación",
                                          "puntos": "el 5 de diciembre a las 10:00 hay simulacro. punto de encuentro en el "
                                                    "estacionamiento. participan todos los turnos"}},
            {"skill": "correo", "datos": {"para": "Recursos Humanos", "tema": "Capacitación en IA",
                                          "puntos": "somos 25 personas entre planta y oficina. proponemos 2 sesiones de 2 horas "
                                                    "la primera semana de diciembre"}},
        ],
        "resumen": [
            {"skill": "puntos", "datos": {"texto": "El informe de disponibilidad de octubre muestra que los aerogeneradores estuvieron "
                                                   "disponibles el 96,4 % del tiempo y los inversores el 98,1 %. Las paradas no "
                                                   "programadas fueron dos: la fuga de aceite del AG-07 y una falla de comunicación del "
                                                   "INV-05. Se recomienda adelantar el cambio de sellos de los demás aerogeneradores."}},
            {"skill": "simple", "datos": {"texto": "El nuevo reglamento de seguridad exige que todo trabajo en altura cuente con permiso "
                                                   "escrito, arnés certificado y un vigía en tierra. Los permisos tendrán validez de un "
                                                   "turno y deberán archivarse por cinco años."}},
            {"skill": "puntos", "datos": {"texto": "La auditoría ambiental encontró que la planta cumple con el manejo de residuos, pero "
                                                   "pide mejorar el registro de aceites usados y colocar bandejas antiderrame bajo el "
                                                   "transformador TR-01 antes de fin de año."}},
            {"skill": "simple", "datos": {"texto": "El pronóstico del operador indica un trimestre con 8 % menos viento que el promedio. "
                                                   "Se sugiere programar los mantenimientos mayores de los aerogeneradores en ese periodo."}},
            {"skill": "puntos", "datos": {"texto": "El contrato de mantenimiento de inversores vence en enero. El proveedor propone "
                                                   "renovarlo por dos años con un alza del 4 % e incluir monitoreo remoto 24 horas."}},
        ],
        "acta": [
            {"skill": "formal", "datos": {"asistentes": "Ana Gómez, Luis Rojas, Marta Díaz (ficticios)",
                                          "notas": "revisión de la falla del AG-07. Luis explica el cambio de sello. se acuerda revisar "
                                                   "los sellos de AG-01 en la próxima parada. Marta envía el informe el viernes."}},
            {"skill": "puntos", "datos": {"asistentes": "Patricia Salazar, Fernando Castillo, Jorge Villa (ficticios)",
                                          "notas": "presupuesto de compras de diciembre. se aprueban guantes dieléctricos y 2 arneses. "
                                                   "los drones quedan para enero. Fernando pide 3 cotizaciones."}},
            {"skill": "formal", "datos": {"asistentes": "Equipo de turno mañana (6 personas)",
                                          "notas": "charla de seguridad sobre trabajo en altura. se repasó el uso del arnés y la línea "
                                                   "de vida. Juan pide reponer 2 cascos. sin incidentes en la semana."}},
            {"skill": "puntos", "datos": {"asistentes": "Ana Gómez, Recursos Humanos (ficticios)",
                                          "notas": "capacitación en IA: 2 sesiones en diciembre, 25 personas. RRHH reserva la sala. "
                                                   "Ana prepara los ejemplos de práctica."}},
            {"skill": "formal", "datos": {"asistentes": "Gerencia y jefaturas (5 personas)",
                                          "notas": "cierre de mes: generación 3 % sobre la meta. dos paradas no programadas. se pide "
                                                   "plan para reducir fallas de comunicación del SCADA."}},
        ],
        "informe": [
            {"skill": "analista", "datos": {"periodo": f"Semana {n}", "datos": d}} for n, d in enumerate([
                "Parque Eólico Norte: 4300\nParque Solar Sur: 3100\nParque Solar Este: 2350\nEólico Cerro Alto: 980",
                "Parque Eólico Norte: 3650\nParque Solar Sur: 3240\nParque Solar Este: 2410\nEólico Cerro Alto: 1120",
                "Parque Eólico Norte: 4710\nParque Solar Sur: 2980\nParque Solar Este: 2290\nEólico Cerro Alto: 870",
                "Parque Eólico Norte: 4120\nParque Solar Sur: 3330\nParque Solar Este: 2500\nEólico Cerro Alto: 1050",
                "Parque Eólico Norte: 4480\nParque Solar Sur: 3190\nParque Solar Este: 2440\nEólico Cerro Alto: 1210",
            ], start=40)
        ],
        "compra": [
            {"skill": "formal", "datos": {"articulo": "Sello del eje principal SE-450", "cantidad": "2 unidades",
                                          "motivo": "Uno para reparar la fuga del AG-07 y otro de repuesto en bodega."}},
            {"skill": "correo", "datos": {"articulo": "Ventilador de gabinete VF-220", "cantidad": "4 unidades",
                                          "motivo": "El del INV-03 falló y los demás inversores tienen ventiladores con 6 años de uso."}},
            {"skill": "formal", "datos": {"articulo": "Arnés de cuerpo completo con línea de vida", "cantidad": "6 unidades",
                                          "motivo": "Los actuales vencen su certificación en diciembre; son obligatorios para subir a los aerogeneradores."}},
            {"skill": "correo", "datos": {"articulo": "Silicagel para respirador de transformador", "cantidad": "5 kg",
                                          "motivo": "El del TR-01 está saturado (color rosado) y no hay stock en bodega."}},
            {"skill": "formal", "datos": {"articulo": "Bandejas antiderrame de 1,2 x 1,2 m", "cantidad": "3 unidades",
                                          "motivo": "Las pide la auditoría ambiental bajo el transformador TR-01 y los tambores de aceite usado."}},
        ],
        "formato": [_doc("patricia", "semanal", 1, "fmt_semanal"), _doc("patricia", "planta", 2, "fmt_planta"),
                    _doc("fernando", "semanal", 3, "fmt_semanal"), _doc("patricia", "semanal", 4, "fmt_semanal"),
                    _doc("fernando", "planta", 1, "fmt_planta")],
    }


def _doc(uid: str, fid: str, n: int, skill: str) -> dict:
    """Un documento de ejemplo (los mismos de "archivos de ejemplo") enviado para revisar su formato."""
    vs = _variantes(uid, fid)
    v = vs[(n - 1) % len(vs)]
    return {"skill": skill, "documento": v["texto"], "archivo": v["archivo"]}


def _datos(lid: str) -> dict:
    nombre, contenido = buscar_listo_datos("patricia", lid)
    return {"skill": "analista", "contenido": contenido, "archivo": nombre}


def _guardar(modo: str, area: str, tarea: dict, item: dict, atras: int, hora: str, quien: str, planta: str) -> None:
    h, m = hora.split(":")
    cuando = datetime.combine(date.today() - timedelta(days=atras), datetime.min.time()).replace(hour=int(h), minute=int(m))
    skill = item["skill"]
    datos, res, revision = dict(item.get("datos", {})), None, None
    if "documento" in item:
        res = revisar_formato(item["documento"], skill.removeprefix("fmt_"), item["archivo"])
        datos = {"documento": reporte_formato(res)}
    elif "contenido" in item:
        res = validar_archivo(item["contenido"], item["archivo"])
        res["archivo"] = item["archivo"]
        datos = {"archivo": reporte_texto(res)}
        revision = ("", res, False)
    texto = simular(area, tarea, skill, datos, quien, planta, res, cuando)
    registrar(modo, area, tarea, skill, f"{quien} (Datos de ejemplo)", "semilla", datos, revision,
              usuario="", texto=texto, archivo=res, cuando=cuando)


def sembrar_tareas(planta: str = "Central Renovable") -> int:
    """Completa hasta 5 reportes de ejemplo por tarea (solo las que tienen menos). Devuelve cuántos agregó."""
    total = 0
    for area, items in (("planta", _planta()), ("oficina", _oficina())):
        for tid, lista in items.items():
            tarea = buscar_tarea(area, tid)
            if not tarea:
                continue
            for modo in ("practica", "real"):
                with _con() as c:
                    hay = c.execute("SELECT COUNT(*) FROM envios WHERE modo = ? AND area = ? AND tarea_id = ? "
                                    "AND origen = 'semilla' AND usuario = ''", (modo, area, tid)).fetchone()[0]
                if hay >= MINIMO:
                    continue
                for k, item in enumerate(lista):
                    atras = len(lista) - k              # del más viejo (hace 5 días) al más nuevo (ayer)
                    _guardar(modo, area, tarea, item, atras, f"{8 + 2 * k:02d}:{(17 * k) % 60:02d}",
                             PERSONAL[k % len(PERSONAL)], planta)
                    total += 1
    return total
