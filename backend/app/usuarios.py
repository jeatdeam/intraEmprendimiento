"""Usuarios de la plataforma (ficticios, para la demo).

Cada usuario tiene un PERFIL que define dónde trabaja y con qué modo entra por defecto:
  - planta     -> personal de operación y mantenimiento (área planta, trabajo real)
  - ejecutivo  -> jefaturas y gerencia (área oficina, trabajo real)
  - novato     -> personal nuevo que todavía está aprendiendo (modo práctica)

El historial de consultas y archivos subidos de cada uno se carga en `semilla_usuarios.py`.
Para agregar o cambiar un usuario basta con editar esta lista.
"""

PERFILES = {
    "planta": "Planta",
    "ejecutivo": "Ejecutivo",
    "novato": "Novato",
}

USUARIOS: list[dict] = [
    {"id": "carlos", "nombre": "Carlos Mendoza", "perfil": "planta", "cargo": "Operador de turno",
     "area": "planta", "modo": "real"},
    {"id": "rosa", "nombre": "Rosa Quispe", "perfil": "planta", "cargo": "Técnica de mantenimiento",
     "area": "planta", "modo": "real"},
    {"id": "patricia", "nombre": "Patricia Salazar", "perfil": "ejecutivo", "cargo": "Gerente de Operaciones",
     "area": "oficina", "modo": "real"},
    {"id": "fernando", "nombre": "Fernando Castillo", "perfil": "ejecutivo", "cargo": "Jefe de Administración y Compras",
     "area": "oficina", "modo": "real"},
    {"id": "diego", "nombre": "Diego Flores", "perfil": "novato", "cargo": "Practicante de operaciones (primer mes)",
     "area": "planta", "modo": "practica"},
]


def buscar_usuario(uid: str) -> dict | None:
    return next((u for u in USUARIOS if u["id"] == uid), None)


def usuarios_publicos() -> list[dict]:
    return [{**u, "perfil_nombre": PERFILES[u["perfil"]]} for u in USUARIOS]
