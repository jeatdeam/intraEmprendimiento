# Asistente IA de Planta

Plataforma para que el personal de una central de energía renovable (planta y oficina) use la IA
con botones simples: **elige tarea → elige skill → revisa los datos → la IA trabaja → revisa el resultado**.

Incluye un **modo práctica** con datos ficticios, guía paso a paso y tutorial inicial para quienes
nunca usaron IA, además de letra ajustable (A / A+ / A++) y lectura en voz alta del resultado.

```
trabajo_intraEmprendimiento/
├── backend/            Python + FastAPI
│   ├── app/
│   │   ├── main.py       Endpoints /api/salud, /api/catalogo, /api/ejecutar, /api/archivo/*, /api/historial
│   │   ├── catalogo.py   SKILLS y TAREAS (aquí se agregan o editan)
│   │   ├── reglas.py     Columnas del archivo y RANGOS normales por tipo de equipo
│   │   ├── formatos.py   FORMATOS oficiales de documentos (código, campos y secciones obligatorias)
│   │   ├── historial.py  Guarda envíos y valores diarios (historial.db, SQLite)
│   │   ├── ia.py         Conexión con Claude (Anthropic)
│   │   └── simulador.py  Respuestas simuladas para práctica / sin clave
│   ├── requirements.txt
│   └── .env.example
└── frontend/           Next.js 15 + React 19 + TypeScript
    ├── app/              page.tsx (flujo), layout.tsx, globals.css
    ├── components/       Encabezado, Inicio, Selectores, Formulario, Resultado, Tutorial, Ayudas
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
se apaga, y cada arranque vuelve a cargar la semana de datos de ejemplo. Los archivos subidos
pueden pesar como máximo 4 MB. Para guardar el historial de verdad, pasar a Neon (Postgres).

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
  tabla de datos, secciones numeradas y firmas) y se pueden **imprimir o guardar como PDF**.
- **Revisar formato de un documento** (planta y oficina): sube un Word, PDF o texto. El skill elegido es el formato
  contra el que se revisa: *Reporte de turno* (OP-FOR-001), *Reporte diario de planta* (OP-FOR-002),
  *Reporte semanal* (OP-FOR-003) o *Aviso de falla urgente* (MA-FOR-010). Dice si se **acepta** y qué falta corregir.
- Cada formato tiene una plantilla Word descargable. Los formatos se editan en `backend/app/formatos.py`.

## Agregar una tarea o un skill

Todo está en `backend/app/catalogo.py`:

- **Skill**: nombre, ícono, descripción corta, pasos (se muestran al empleado) y `prompt` (instrucción que recibe la IA).
- **Tarea**: área (`planta` u `oficina`), skills permitidos (el primero es el *Recomendado*), campos del formulario y `ejemplo` con datos ficticios para la práctica.

El frontend se actualiza solo; no hace falta tocarlo.
