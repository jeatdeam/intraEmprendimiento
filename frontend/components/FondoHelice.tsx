"use client";
import { useEffect, useRef } from "react";

/* El paisaje (public/fondo.webp) mide 2400x1500 y se pinta con "cover" anclado al 58% / 50%.
   Los aerogeneradores lejanos se colocan en coordenadas de esa imagen para que queden sobre la loma. */
const IMG = { w: 2400, h: 1500, ax: 0.58, ay: 0.5 };
/** [x, y de la base, altura de la torre, giro inicial, velocidad] en píxeles de la imagen */
const LEJANOS: [number, number, number, number, number][] = [
  [120, 786, 118, 0.3, 0.5], [262, 778, 96, 1.3, 0.62], [405, 790, 132, 0.8, 0.44], [585, 782, 84, 0.1, 0.7], [742, 792, 70, 1.7, 0.78],
];

/**
 * Aerogeneradores hechos de puntos pequeños que giran sobre el paisaje (three.js): uno grande en primer
 * plano y cinco lejanos. Del grande salen líneas curvas de viento (trazos continuos, no puntos).
 * Con "reducir movimiento" todo se queda quieto, y se detiene mientras la pestaña está oculta.
 */
export default function FondoHelice() {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    let cancelado = false;
    let limpiar = () => {};

    import("three").then((THREE) => {
      if (cancelado) return;
      const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const escena = new THREE.Scene();
      const camara = new THREE.OrthographicCamera(0, 1, 1, 0, -1000, 1000);
      const desechar: { dispose: () => void }[] = [];

      // Azar con semilla: la nube de puntos sale igual en cada visita
      let s = 7;
      const azar = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const nube = (pts: number[], opacidad: number, tam: number) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        const m = new THREE.PointsMaterial({ color: 0xf6f4f0, size: tam, sizeAttenuation: false, transparent: true, opacity: opacidad, depthWrite: false });
        desechar.push(g, m);
        return new THREE.Points(g, m);
      };

      /** Un aerogenerador de puntos. La unidad es el largo del aspa; devuelve el grupo y su rotor. */
      const crearMolino = (puntosAspa: number, puntosTorre: number, torreLargo: number, tam: number, opacidad: number) => {
        const aspas: number[] = [];
        for (let k = 0; k < 3; k++) {
          const giro = (k * 2 * Math.PI) / 3;
          for (let i = 0; i < puntosAspa; i++) {
            const r = 0.06 + Math.pow(azar(), 0.8) * 0.94;
            const ancho = 0.085 * Math.pow(1 - r, 0.7) + 0.012;
            const u = (azar() * 2 - 1) * ancho * (azar() < 0.35 ? 1 : azar());
            const x = u + ancho * 0.45, y = r;
            aspas.push(x * Math.cos(giro) - y * Math.sin(giro), x * Math.sin(giro) + y * Math.cos(giro), 0);
          }
        }
        for (let i = 0; i < puntosAspa / 5; i++) { // buje
          const a = azar() * Math.PI * 2, r = Math.sqrt(azar()) * 0.06;
          aspas.push(Math.cos(a) * r, Math.sin(a) * r, 0);
        }
        const torre: number[] = [];
        for (let i = 0; i < puntosTorre; i++) { // columna que se ensancha hacia abajo
          const t = azar();
          torre.push((azar() * 2 - 1) * (0.012 + 0.028 * t), -0.05 - t * torreLargo, 0);
        }
        const rotor = nube(aspas, opacidad, tam);
        const grupo = new THREE.Group();
        grupo.add(nube(torre, opacidad * 0.55, tam), rotor);
        escena.add(grupo);
        return { grupo, rotor };
      };

      const grande = crearMolino(2600, 1800, 2.2, 1.7, 0.62);
      const lejanos = LEJANOS.map(([, , , giro, vel]) => {
        const m = crearMolino(90, 70, 2.38, 1.3, 0.8);
        m.rotor.rotation.z = giro;
        return { ...m, vel };
      });

      // Viento: trazos curvos que nacen junto a la hélice grande y se alejan ondulando.
      // Cada línea es una curva fija; lo que viaja por ella es un tramo visible.
      const N = 90;
      const viento = Array.from({ length: 9 }, (_, k) => {
        const y0 = (k - 4) * 0.2 + (azar() - 0.5) * 0.08, amp = 0.1 + azar() * 0.16, fase = azar() * 6.28, largo = 2.6 + azar() * 1.6;
        const pts: number[] = [];
        for (let i = 0; i < N; i++) {
          const t = i / (N - 1);
          // sale del rotor, ondula y termina en un rizo
          const rizo = Math.max(0, t - 0.72) / 0.28;
          pts.push(-0.1 - t * largo + Math.sin(rizo * 5.2) * 0.22 * rizo, y0 + Math.sin(t * 5 + fase) * amp * (0.35 + t) + (1 - Math.cos(rizo * 5.2)) * 0.16 * rizo, 0);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        const m = new THREE.LineBasicMaterial({ color: 0xf6f4f0, transparent: true, opacity: 0, depthWrite: false });
        desechar.push(g, m);
        const linea = new THREE.Line(g, m);
        grande.grupo.add(linea);
        return { g, m, desfase: azar(), vel: 0.1 + azar() * 0.07 };
      });
      const TRAMO = 34; // puntos visibles del trazo que viaja
      const moverViento = (seg: number) => {
        for (const v of viento) {
          const p = (seg * v.vel + v.desfase) % 1;            // avance 0..1 por la curva
          const cabeza = Math.floor(p * (N + TRAMO));
          const ini = Math.max(0, cabeza - TRAMO), fin = Math.min(N, cabeza);
          v.g.setDrawRange(ini, Math.max(0, fin - ini));
          v.m.opacity = 0.7 * Math.sin(Math.PI * p);           // aparece y se desvanece
        }
      };

      const ajustar = () => {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camara.right = w; camara.top = h;
        camara.updateProjectionMatrix();
        grande.grupo.scale.setScalar(Math.min(w, h) * (w < 700 ? 0.42 : 0.46));
        grande.grupo.position.set(w < 700 ? w * 0.5 : w * 0.8, h * 0.56, 0);
        // Misma cuenta que hace el navegador con background-size: cover
        const esc = Math.max(w / IMG.w, h / IMG.h);
        const dx = (w - IMG.w * esc) * IMG.ax, dy = (h - IMG.h * esc) * IMG.ay;
        lejanos.forEach((m, i) => {
          const [x, y, alto] = LEJANOS[i];
          m.grupo.scale.setScalar(alto * 0.42 * esc);
          m.grupo.position.set(dx + x * esc, h - (dy + (y - alto) * esc), 0);
        });
      };
      ajustar();
      window.addEventListener("resize", ajustar);

      let cuadro = 0, antes = performance.now(), seg = 2;
      const pintar = (ahora: number) => {
        const dt = Math.min(0.1, (ahora - antes) / 1000);
        antes = ahora; seg += dt;
        grande.rotor.rotation.z -= dt * 0.35;
        for (const m of lejanos) m.rotor.rotation.z -= dt * m.vel;
        moverViento(seg);
        renderer.render(escena, camara);
        if (!quieto) cuadro = requestAnimationFrame(pintar);
      };
      const alCambiar = () => {
        cancelAnimationFrame(cuadro);
        if (!document.hidden && !quieto) { antes = performance.now(); cuadro = requestAnimationFrame(pintar); }
      };
      document.addEventListener("visibilitychange", alCambiar);
      grande.rotor.rotation.z = 0.4;
      pintar(performance.now());

      limpiar = () => {
        cancelAnimationFrame(cuadro);
        window.removeEventListener("resize", ajustar);
        document.removeEventListener("visibilitychange", alCambiar);
        desechar.forEach((d) => d.dispose());
        renderer.dispose();
      };
    });

    return () => { cancelado = true; limpiar(); };
  }, []);

  return <canvas ref={lienzo} className="fondo-helice" />;
}
