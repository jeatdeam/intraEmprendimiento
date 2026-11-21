# Asistente IA de Planta

Plataforma para que el personal de una central de energía renovable (planta y oficina) use la IA
con botones simples: **elige tarea → elige skill → revisa los datos → la IA trabaja → revisa el resultado**.

Incluye un **modo práctica** con datos ficticios, guía paso a paso y tutorial inicial para quienes
nunca usaron IA, además de letra ajustable (A / A+ / A++) y lectura en voz alta del resultado.

```
trabajo_intraEmprendimiento/
├── backend/            Python + FastAPI
│   ├── app/
│   │   ├── main.py       Endpoints /api/salud, /api/catalogo, /api/ejecutar, /api/archivo/*, /api/historial, /api/usuarios
│   │   ├── catalogo.py   SKILLS y TAREAS (aquí se agregan o editan)
│   │   ├── usuarios.py   Los 5 usuarios de la demo (nombre, cargo, perfil, área y modo por defecto)
│   │   ├── reglas.py     Columnas del archivo y RANGOS normales por tipo de equipo
│   │   ├── formatos.py   FORMATOS oficiales de documentos (código, campos y secciones obligatorias)
│   │   ├── historial.py  Guarda cada envío con su resultado y los valores diarios, por usuario (historial.db, SQLite)
│   │   ├── semilla.py            Semana de datos ficticios de toda la planta
│   │   ├── semilla_usuarios.py   Historial ficticio de cada usuario (5 consultas y 5 archivos subidos)
│   │   ├── listos.py     Archivos ficticios de ejemplo para arrastrar (5 por usuario y por formato)
│   │   ├── comparador.py Antes y después de un documento: marca lo que está mal o falta y lo corrige
│   │   ├── ia.py         Conexión con Claude (Anthropic)
│   │   └── simulador.py  Respuestas simuladas para práctica / sin clave
│   ├── requirements.txt
│   └── .env.example
└── frontend/           Next.js 15 + React 19 + TypeScript
    ├── app/              page.tsx (flujo), layout.tsx, globals.css
    ├── components/       Encabezado, Inicio, Selectores, Formulario, Resultado, MiHistorial, ListosParaEvaluar,
    │                     AntesDespues, Grafica, Tutorial, Ayudas
    ├── lib/              api.ts, types.ts, almacen.ts
    └── next.config.ts    Redirige /api/* al backend
```

## Cómo ejecutarlo

**1. Backend** (terminal 1)

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Git Bash en Windows
# .venv\Scripts\activate        # CMD / PowerShell en Windows
# source .venv/bin/activate     # Linux / Mac
pip install -r requirements.txt
cp .env.example .env            # (CMD: copy) y completa ANTHROPIC_API_KEY si quieres IA real
uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:3000

## Desplegar en Vercel (demo)

Un solo proyecto en Vercel con dos servicios (`vercel.json` en la raíz): `/api/*` va al
backend FastAPI (`backend/index.py`) y todo lo demás al frontend Next.js. Al estar en el mismo
dominio no hace falta `BACKEND_URL` ni CORS.

Variables opcionales en Vercel: `ANTHROPIC_API_KEY` (sin ella, modo simulado) y `NOMBRE_PLANTA`.

Limitaciones de la demo: el historial se guarda en `/tmp`, así que **se borra** cuando la función
se apaga, y cada arranque vuelve a cargar la semana de datos de ejemplo y el historial de ejemplo de los 5 usuarios. Los archivos subidos
pueden pesar como máximo 4 MB. Para guardar el historial de verdad, pasar a Neon (Postgres).

## Usuarios e historial

Ya no se escribe el nombre: en el inicio se **elige un usuario**. Al elegirlo quedan marcados su lugar de trabajo
y su modo habituales (se pueden cambiar antes de entrar).

| Usuario | Cargo | Perfil | Entra por defecto a |
|---------|-------|--------|---------------------|
| Carlos Mendoza | Operador de turno | Planta | Planta · trabajo real |
| Rosa Quispe | Técnica de mantenimiento | Planta | Planta · trabajo real |
| Patricia Salazar | Gerente de Operaciones | Ejecutivo | Oficina · trabajo real |
| Fernando Castillo | Jefe de Administración y Compras | Ejecutivo | Oficina · trabajo real |
| Diego Flores | Practicante de operaciones | Novato | Planta · práctica |

- Cada usuario empieza con un historial ficticio de **5 consultas y 5 archivos subidos** (`semilla_usuarios.py`),
  que cuenta la misma historia de la semana que los datos de la planta (la fuga de aceite del AG-07).
- **Mi historial** (menú o botón bajo las tareas): lista sus consultas y sus archivos subidos; al tocar una fila se
  vuelve a ver el documento que entregó la IA, lo que se escribió y, si era un documento, el texto que se subió.
- **Archivos para arrastrar al revisar un documento** (pantalla *Completa los datos* de *Revisar formato de un
  documento*): debajo del recuadro aparecen **los archivos que el usuario ya envió** con ese formato y **5 archivos de
  ejemplo** (uno bien hecho y cuatro con errores distintos). Cualquiera se **arrastra al recuadro** (o se toca) y queda
  cargado como si se hubiera subido. Al enviarlo a la IA, el resultado incluye el **antes y después**: dos hojas, el
  antes con lo que está mal o falta marcado en rojo en su lugar y el después con lo agregado o corregido en verde.
  Con un documento propio, lo que no se pueda deducir queda como `[completar]` en amarillo.
- Lo mismo en **Revisar archivo de datos** (Excel / CSV): debajo del recuadro están los archivos de datos que el usuario
  ya envió y **5 archivos de producción de ejemplo** (semana normal, la semana de la falla del AG-07, inversores, una
  planilla mal llenada y una con columnas de otra plantilla). Para poder volver a cargar un archivo enviado, el historial
  guarda sus filas; los que se enviaron antes de este cambio solo tienen el resultado y hay que subirlos otra vez.
- **Archivos listos para evaluar** (en *Mi historial*, debajo de los archivos subidos): 5 de esos ejemplos, según el
  trabajo del usuario (planta: reportes de turno y avisos de falla; oficina: reportes semanales y diarios). Se arrastra
  uno al recuadro y se pulsa **Evaluar** para ver ahí mismo si pasa y su antes y después, sin guardar nada en el
  historial. Los ejemplos se arman en `backend/app/listos.py` (5 por usuario y por formato).
- **Mis gráficas**: muestran solo lo que envió ese usuario (botón *Mis datos*); con *Toda la planta* se ve lo de todos.
  Cada documento revisado deja además un punto en la serie *Formato de documentos (cumplimiento)*, con meta 100 %.
- Todo lo que se envíe desde la plataforma queda guardado en el historial del usuario que entró.
- Los usuarios se editan en `backend/app/usuarios.py`. Para volver a cargar el historial de ejemplo, borra
  `backend/historial.db` (se pierde también lo enviado de verdad) y reinicia el backend.

## Modos

| Modo | Datos | IA |
|------|-------|----|
| 🎓 Práctica | Ficticios, ya cargados | Simulada (o real si `PRACTICA_USA_IA=true`) |
| ✅ Trabajo real | Los del empleado | Claude si hay `ANTHROPIC_API_KEY`; si no, simulada con aviso |

## Revisar archivos y gráfica diaria

- **Oficina → Revisar archivo de datos**: sube un Excel (.xlsx) o CSV. El servidor revisa que estén las
  columnas (Fecha, Equipo, Tipo de equipo, Generación (MWh), Disponibilidad (%), Temperatura (°C), Estado)
  y marca cada valor como *bajo* / *alto* (fuera del rango normal), *dato mal escrito* (imposible o no numérico)
  o *falla de máquina* (estado falla/detenido, o generación 0 sin mantenimiento). Luego la IA lo explica con el skill elegido.
- **Ver la gráfica diaria** (botón bajo las tareas): valor de cada día por equipo con la banda del rango normal,
  marcas en los días fuera de rango o con fallas, y la lista de esos días. También suma los reportes de turno,
  las lecturas de producción y las fallas reportadas.
- Los rangos se cambian en `backend/app/reglas.py` (`RANGOS` y `RANGOS_FORMULARIO`).
- Los datos de práctica y los reales se guardan por separado en `backend/historial.db`.

## Formatos oficiales de documentos

- Los reportes del skill **Redactor formal** salen con el formato de la empresa (encabezado con código y revisión,
  tabla de datos, secciones numeradas y firmas) y se pueden **imprimir o guardar como PDF**. Son documentos de una
  página completa, con 6 secciones: resumen u objetivo, datos en tabla, análisis, acciones con responsable y plazo, y firmas.
- El *Reporte de turno* (OP-FOR-001 rev. 03) tiene las secciones Resumen del turno, Producción, Novedades y eventos,
  Seguridad, Pendientes y Firmas. El *Aviso de falla urgente* (MA-FOR-010 rev. 04): Descripción de la falla, Impacto en
  la operación, Riesgo para personas, Acciones inmediatas, Acciones recomendadas y Firmas.
- **Revisar formato de un documento** (planta y oficina): sube un Word, PDF o texto. El skill elegido es el formato
  contra el que se revisa: *Reporte de turno* (OP-FOR-001), *Reporte diario de planta* (OP-FOR-002),
  *Reporte semanal* (OP-FOR-003) o *Aviso de falla urgente* (MA-FOR-010). Dice si se **acepta** y qué falta corregir.
- Cada formato tiene una plantilla Word descargable. Los formatos se editan en `backend/app/formatos.py`.

## Agregar una tarea o un skill

Todo está en `backend/app/catalogo.py`:

- **Skill**: nombre, ícono, descripción corta, pasos (se muestran al empleado) y `prompt` (instrucción que recibe la IA).
- **Tarea**: área (`planta` u `oficina`), skills permitidos (el primero es el *Recomendado*), campos del formulario y `ejemplo` con datos ficticios para la práctica.

El frontend se actualiza solo; no hace falta tocarlo.
