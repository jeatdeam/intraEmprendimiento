"use client";
/** Slider after/before del formato de un documento: "Formato normal" (como se subió) vs "Formato con skill" (corregido). */
import { CircleCheck, CircleX } from "lucide-react";
import type { Comparacion, HojaRevisada } from "@/lib/types";
import { Hoja } from "./AntesDespues";
import SliderAntesDespues from "./SliderAntesDespues";

export function Sello({ h }: { h: HojaRevisada }) {
  return (
    <span className={`baf-sello ${h.aceptado ? "si" : "no"}`}>
      {h.aceptado ? <CircleCheck size={13} aria-hidden="true" /> : <CircleX size={13} aria-hidden="true" />}
      {h.aceptado ? "Pasa" : "No pasa"} · {h.cumple} de {h.total}
    </span>
  );
}

export default function SliderFormato({ grupos }: { grupos: Comparacion[] }) {
  return (
    <SliderAntesDespues grupos={grupos.map((c, i) => ({
      clave: `${c.archivo}-${i}`,
      titulo: c.archivo,
      sub: `Formato ${c.nombre} · ${c.codigo}`,
      izq: <Hoja lineas={c.antes.lineas} />,
      der: <Hoja lineas={c.despues.lineas} />,
      selloIzq: <Sello h={c.antes} />,
      selloDer: <Sello h={c.despues} />,
    }))} />
  );
}
