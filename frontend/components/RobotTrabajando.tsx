"use client";
import { useEffect, useRef } from "react";

/* Animación Lottie hecha a mano: un robot con casco de obra que martilla una roca.
   Se construye aquí (en vez de un .json suelto) para poder leerla y retocarla. */
type Num = number;
const fijo = (k: unknown) => ({ a: 0, k });
const BLANCO = [0.96, 0.95, 0.94], GRIS = [0.72, 0.7, 0.67], OSCURO = [0.11, 0.11, 0.12], CASCO = [0.96, 0.72, 0.26], ROCA = [0.42, 0.4, 0.39];

const tr = () => ({ ty: "tr", p: fijo([0, 0]), a: fijo([0, 0]), s: fijo([100, 100]), r: fijo(0), o: fijo(100) });
const relleno = (c: Num[]) => ({ ty: "fl", c: fijo([...c, 1]), o: fijo(100), r: 1 });
const rect = (x: Num, y: Num, w: Num, h: Num, radio: Num, c: Num[]) =>
  ({ ty: "gr", it: [{ ty: "rc", d: 1, s: fijo([w, h]), p: fijo([x, y]), r: fijo(radio) }, relleno(c), tr()] });
const elipse = (x: Num, y: Num, w: Num, h: Num, c: Num[]) =>
  ({ ty: "gr", it: [{ ty: "el", d: 1, s: fijo([w, h]), p: fijo([x, y]) }, relleno(c), tr()] });
const suave = { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } };
const claves = (pares: [Num, Num[]][]) => ({ a: 1, k: pares.map(([t, s]) => ({ t, s, ...suave })) });

const FIN = 40;
let ind = 0;
const capa = (nm: string, shapes: unknown[], ks: Record<string, unknown> = {}) => ({
  ddd: 0, ind: ++ind, ty: 4, nm, sr: 1, ao: 0, ip: 0, op: FIN, st: 0, bm: 0, shapes,
  ks: { o: fijo(100), r: fijo(0), p: fijo([0, 0, 0]), a: fijo([0, 0, 0]), s: fijo([100, 100, 100]), ...ks },
});

// Las capas van de adelante hacia atrás.
const ROBOT = {
  v: "5.7.4", fr: 30, ip: 0, op: FIN, w: 360, h: 300, nm: "Robot con casco martillando", ddd: 0, assets: [],
  layers: [
    // Chispas del golpe
    capa("chispas", [elipse(262, 168, 8, 8, CASCO), elipse(312, 160, 6, 6, BLANCO), elipse(290, 146, 7, 7, CASCO)],
      { o: claves([[0, [0]], [13, [0]], [15, [100]], [22, [0]], [FIN, [0]]]), p: claves([[13, [0, 6, 0]], [22, [0, -10, 0]]]) }),
    // Brazo con martillo: gira desde el hombro
    capa("brazo", [rect(0, -112, 46, 24, 5, GRIS), rect(0, -80, 8, 56, 3, ROCA), rect(0, -30, 18, 62, 9, BLANCO), elipse(0, -58, 22, 22, GRIS)],
      { p: fijo([184, 186, 0]), r: claves([[0, [-12]], [14, [76]], [18, [66]], [36, [-12]], [FIN, [-12]]]) }),
    // Casco: visera y cúpula (la cabeza tapa la mitad de abajo)
    capa("visera", [rect(130, 100, 124, 12, 6, CASCO), rect(130, 74, 10, 44, 5, [1, 0.82, 0.45])]),
    capa("ojos", [elipse(112, 128, 14, 14, OSCURO), elipse(150, 128, 14, 14, OSCURO), rect(131, 148, 26, 5, 2.5, OSCURO)],
      { a: fijo([131, 128, 0]), p: fijo([131, 128, 0]), s: claves([[0, [100, 100, 100]], [26, [100, 100, 100]], [29, [100, 12, 100]], [32, [100, 100, 100]]]) }),
    capa("cabeza", [rect(130, 132, 92, 62, 16, BLANCO)], { p: claves([[0, [0, 0, 0]], [15, [0, 3, 0]], [24, [0, 0, 0]]]) }),
    capa("cupula", [elipse(130, 100, 104, 78, CASCO)]),
    capa("cuerpo", [rect(130, 152 + 62, 26, 12, 4, GRIS), rect(130, 214, 112, 88, 18, BLANCO), rect(130, 208, 56, 30, 8, GRIS),
      elipse(116, 208, 10, 10, CASCO), elipse(144, 208, 10, 10, OSCURO), rect(68, 212, 18, 56, 9, GRIS), rect(108, 270, 24, 30, 6, GRIS), rect(152, 270, 24, 30, 6, GRIS)]),
    capa("roca", [elipse(290, 232, 104, 70, ROCA), elipse(268, 220, 34, 16, [0.5, 0.48, 0.47])],
      { a: fijo([290, 262, 0]), p: fijo([290, 262, 0]), s: claves([[0, [100, 100, 100]], [14, [100, 100, 100]], [16, [104, 93, 100]], [22, [100, 100, 100]]]) }),
    capa("suelo", [rect(180, 286, 320, 6, 3, [0.3, 0.29, 0.29])]),
  ],
};

export default function RobotTrabajando({ size = 220 }: { size?: number }) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    let destruir = () => {};
    import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelado || !caja.current) return;
      const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const anim = lottie.loadAnimation({ container: caja.current, renderer: "svg", loop: true, autoplay: !quieto, animationData: structuredClone(ROBOT) });
      if (quieto) anim.addEventListener("DOMLoaded", () => anim.goToAndStop(8, true));
      destruir = () => anim.destroy();
    });
    return () => { cancelado = true; destruir(); };
  }, []);

  return <div ref={caja} className="robot" style={{ width: size, height: size * (300 / 360) }} aria-hidden="true" />;
}
