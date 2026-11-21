"use client";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Building2, CircleHelp, Factory, GraduationCap, History, House, Menu, TriangleAlert, UserRound, X } from "lucide-react";
import type { Area, Envio, Modo, Usuario } from "@/lib/types";
import { Logo } from "./Ilustraciones";

interface Props {
  planta: string;
  usuario: Usuario | null;
  recientes: Envio[];
  area: Area | null;
  modo: Modo;
  enInicio: boolean;
  letra: number;
  onInicio: () => void;
  onAyuda: () => void;
  onLetra: (px: number) => void;
  onHistorial: () => void;
  onAbrirEnvio: (e: Envio) => void;
}

const LETRAS: [number, string, string][] = [[18, "A", "Letra normal"], [22, "A+", "Letra grande"], [26, "A++", "Letra muy grande"]];
const cuando = (iso: string) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });

export default function Encabezado({ planta, usuario, recientes, area, modo, enInicio, letra, onInicio, onAyuda, onLetra, onHistorial, onAbrirEnvio }: Props) {
  const practica = modo === "practica";
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // El menú se cierra con Escape o al tocar fuera
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);

  const y = (accion: () => void) => () => { setAbierto(false); accion(); };

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <button className="logo" onClick={onInicio} aria-label={`${planta}, Asistente IA: ir al inicio`}>
            <Logo size={40} />
            <span>
              <b>{planta}</b>
              <small>Asistente IA</small>
            </span>
          </button>
          {usuario && !enInicio && (
            <span className="chip"><UserRound size={15} aria-hidden="true" /> {usuario.nombre}</span>
          )}
          {area && !enInicio && (
            <>
              <span className={`chip ${area}`}>
                {area === "planta" ? <Factory size={15} aria-hidden="true" /> : <Building2 size={15} aria-hidden="true" />}
                {area === "planta" ? "Planta" : "Oficina"}
              </span>
              <span className={`chip ${practica ? "practica" : "real"}`}>
                {practica ? <GraduationCap size={15} aria-hidden="true" /> : <BadgeCheck size={15} aria-hidden="true" />}
                {practica ? "Práctica" : "Trabajo real"}
              </span>
            </>
          )}
          <div className="menu" ref={caja}>
            <button className="hbtn" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} aria-controls="menu-panel">
              {abierto ? <X size={17} aria-hidden="true" /> : <Menu size={17} aria-hidden="true" />} Menú
            </button>
            {abierto && (
              <div className="menu-panel glass" id="menu-panel">
                <button className="menu-item" onClick={y(onInicio)}><House size={17} aria-hidden="true" /> Inicio y cambiar de usuario</button>
                {usuario && <button className="menu-item" onClick={y(onHistorial)}><History size={17} aria-hidden="true" /> Mi historial</button>}
                <button className="menu-item" onClick={y(onAyuda)}><CircleHelp size={17} aria-hidden="true" /> Ayuda: cómo funciona</button>

                <div className="menu-grupo">
                  <span className="menu-tit">Tamaño de letra</span>
                  <div className="segmento" role="group" aria-label="Tamaño de letra">
                    {LETRAS.map(([px, txt, nombre]) => (
                      <button key={px} className={px === letra ? "on" : ""} aria-pressed={px === letra} aria-label={nombre} onClick={() => onLetra(px)}>{txt}</button>
                    ))}
                  </div>
                </div>

                {usuario && (
                  <div className="menu-grupo">
                    <span className="menu-tit"><History size={14} aria-hidden="true" /> Lo último de {usuario.nombre.split(" ")[0]}</span>
                    {recientes.length ? (
                      <ul className="menu-historial">
                        {recientes.map((e) => (
                          <li key={e.id}>
                            <button className="menu-item" onClick={y(() => onAbrirEnvio(e))}>
                              <span className="mh-txt"><b>{e.archivo ?? e.tarea}</b><small>{e.skill} · {e.modo === "practica" ? "Práctica" : "Real"}</small></span>
                              <small>{cuando(e.creado)}</small>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="hint">Aquí aparecerán tus consultas y los archivos que subas, para volver a verlos con un toque.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      {practica && !enInicio && (
        <div className="wrap">
          <div className="banner-practica glass">
            <TriangleAlert size={18} aria-hidden="true" />
            <span><b>Modo práctica:</b> los datos son ficticios. Nada de lo que hagas aquí se guarda en sistemas reales.</span>
          </div>
        </div>
      )}
    </>
  );
}
