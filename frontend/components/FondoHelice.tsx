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
 * Aerogeneradores hechos de puntos pequeños sobre el paisaje (three.js): uno grande en primer plano y
 * cinco lejanos, todos girando a velocidad constante y con sus puntos vibrando muy levemente.
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

      /** Nube de puntos que "respira": cada punto oscila un poco alrededor de su sitio. */
      const nubes: { base: Float32Array; attr: { array: ArrayLike<number>; needsUpdate: boolean }; fases: Float32Array; amp: number }[] = [];
      const nube = (pts: number[], opacidad: number, tam: number, amp: number) => {
        const base = new Float32Array(pts);
        const g = new THREE.BufferGeometry();
        const attr = new THREE.BufferAttribute(new Float32Array(pts), 3);
        g.setAttribute("position", attr);
        const m = new THREE.PointsMaterial({ color: 0xf6f4f0, size: tam, sizeAttenuation: false, transparent: true, opacity: opacidad, depthWrite: false });
        desechar.push(g, m);
        const fases = new Float32Array(pts.length / 3);
        for (let i = 0; i < fases.length; i++) fases[i] = azar() * 6.283;
        nubes.push({ base, attr, fases, amp });
        return new THREE.Points(g, m);
      };
      const vibrar = (seg: number) => {
        for (const n of nubes) {
          const a = n.attr.array as Float32Array;
          for (let i = 0, j = 0; i < n.fases.length; i++, j += 3) {
            const f = n.fases[i];
            a[j] = n.base[j] + Math.sin(seg * 1.3 + f) * n.amp;
            a[j + 1] = n.base[j + 1] + Math.cos(seg * 1.1 + f * 1.7) * n.amp;
          }
          n.attr.needsUpdate = true;
        }
      };

      /** Un aerogenerador de puntos. La unidad es el largo del aspa; devuelve el grupo y su rotor. */
      const crearMolino = (o: { aspa: number; torre: number; torreLargo: number; torreAncho: number; tam: number; opacidad: number; vibra: number }) => {
        const aspas: number[] = [];
        for (let k = 0; k < 3; k++) {
          const giro = (k * 2 * Math.PI) / 3;
          for (let i = 0; i < o.aspa; i++) {
            const r = 0.06 + Math.pow(azar(), 0.8) * 0.94;
            const ancho = 0.085 * Math.pow(1 - r, 0.7) + 0.012;
            const u = (azar() * 2 - 1) * ancho * (azar() < 0.35 ? 1 : azar());
            const x = u + ancho * 0.45, y = r;
            aspas.push(x * Math.cos(giro) - y * Math.sin(giro), x * Math.sin(giro) + y * Math.cos(giro), 0);
          }
        }
        for (let i = 0; i < o.aspa / 4; i++) { // buje
          const a = azar() * Math.PI * 2, r = Math.sqrt(azar()) * 0.075;
          aspas.push(Math.cos(a) * r, Math.sin(a) * r, 0);
        }
        const torre: number[] = [];
        for (let i = 0; i < o.torre; i++) { // columna que se ensancha hacia abajo
          const t = azar();
          torre.push((azar() * 2 - 1) * o.torreAncho * (1 + 2.2 * t), -0.05 - t * o.torreLargo, 0);
        }
        const rotor = nube(aspas, o.opacidad, o.tam, o.vibra);
        const grupo = new THREE.Group();
        grupo.add(nube(torre, o.opacidad * 0.6, o.tam, o.vibra), rotor);
        escena.add(grupo);
        return { grupo, rotor };
      };

      const grande = crearMolino({ aspa: 6500, torre: 5200, torreLargo: 2.2, torreAncho: 0.03, tam: 1.7, opacidad: 0.66, vibra: 0.007 });
      const lejanos = LEJANOS.map(([, , , giro, vel]) => {
        const m = crearMolino({ aspa: 90, torre: 70, torreLargo: 2.38, torreAncho: 0.012, tam: 1.3, opacidad: 0.8, vibra: 0.02 });
        m.rotor.rotation.z = giro;
        return { ...m, vel };
      });

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

      let cuadro = 0, antes = performance.now(), seg = 4;
      const pintar = (ahora: number) => {
        const dt = Math.min(0.1, (ahora - antes) / 1000);
        antes = ahora; seg += dt;
        vibrar(seg);
        grande.rotor.rotation.z -= dt * 0.4;                       // velocidad constante
        for (const m of lejanos) m.rotor.rotation.z -= dt * m.vel; // constante en cada uno
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
