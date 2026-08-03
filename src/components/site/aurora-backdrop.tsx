"use client";

import { useEffect, useRef } from "react";
import {
  Clock,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three";

// A slow-drifting aurora behind the hero.
//
// Only the pieces of three.js needed for one fullscreen quad are imported,
// so the bundler can drop the rest of the library. This component is loaded
// with next/dynamic({ ssr: false }) and sits behind a static CSS gradient,
// so if WebGL is unavailable or the chunk never arrives, the hero simply
// keeps the gradient and nothing breaks.

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// Three drifting radial lobes in the brand hues. Deliberately low contrast:
// this sits behind headline text, so it must never compete with it.
const FRAGMENT = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uViolet;
  uniform vec3 uBlue;
  uniform vec3 uAmber;

  float lobe(vec2 uv, vec2 centre, float radius) {
    float d = length((uv - centre) * vec2(uResolution.x / uResolution.y, 1.0));
    return smoothstep(radius, 0.0, d);
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.06;

    vec2 c1 = vec2(0.18 + sin(t) * 0.06, 0.94 + cos(t * 0.8) * 0.05);
    vec2 c2 = vec2(0.88 + cos(t * 0.7) * 0.07, 0.88 + sin(t * 1.1) * 0.05);
    vec2 c3 = vec2(0.52 + sin(t * 0.5) * 0.10, 0.06 + cos(t * 0.6) * 0.04);

    float i1 = lobe(uv, c1, 0.80);
    float i2 = lobe(uv, c2, 0.68);
    float i3 = lobe(uv, c3, 0.58);

    vec3 colour = uViolet * i1 + uBlue * i2 + uAmber * i3;
    float intensity = i1 * 0.55 + i2 * 0.35 + i3 * 0.30;

    // Fade toward the bottom so the section blends into the page instead of
    // ending on a hard edge.
    float fade = smoothstep(0.0, 0.5, uv.y);

    // Alpha carries the intensity rather than being opaque. With alpha 1.0
    // this painted solid black everywhere the lobes were dark, which is
    // invisible on a dark page and catastrophic on a light one.
    gl_FragColor = vec4(colour, clamp(intensity * fade, 0.0, 1.0));
  }
`;

export default function AuroraBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
    } catch {
      // No WebGL: the CSS gradient underneath is already showing.
      return;
    }

    // Capping the pixel ratio matters more here than sharpness -- this is a
    // soft gradient, and rendering it at 3x on a phone is wasted GPU.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Vector2(container.clientWidth, container.clientHeight) },
        // Tuned for the light page: the caption yellow plus two near-neutral
        // warm/cool greys. Low chroma on purpose -- this sits behind a
        // headline and must never compete with it.
        uViolet: { value: [1.0, 0.83, 0.25] },
        uBlue: { value: [0.62, 0.64, 0.70] },
        uAmber: { value: [0.96, 0.90, 0.80] },
      },
    });
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const clock = new Clock();
    let frame = 0;

    const renderOnce = () => {
      material.uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    };

    if (reducedMotion) {
      // Draw a single frame and stop: the colour is part of the design, the
      // motion is the thing being opted out of.
      renderOnce();
    } else {
      const loop = () => {
        renderOnce();
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    const onResize = () => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      material.uniforms.uResolution.value.set(clientWidth, clientHeight);
      if (reducedMotion) renderOnce();
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    // Stop burning GPU while the hero is off screen.
    const visibility = new IntersectionObserver(([entry]) => {
      if (reducedMotion) return;
      if (entry.isIntersecting && !frame) {
        const loop = () => {
          renderOnce();
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
      } else if (!entry.isIntersecting && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    visibility.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reducedMotion]);

  return <div ref={containerRef} aria-hidden className="absolute inset-0 h-full w-full" />;
}
