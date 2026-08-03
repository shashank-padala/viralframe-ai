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

    vec2 c1 = vec2(0.22 + sin(t) * 0.06, 0.92 + cos(t * 0.8) * 0.05);
    vec2 c2 = vec2(0.86 + cos(t * 0.7) * 0.07, 0.86 + sin(t * 1.1) * 0.05);
    vec2 c3 = vec2(0.50 + sin(t * 0.5) * 0.10, 0.05 + cos(t * 0.6) * 0.04);

    vec3 colour = uViolet * lobe(uv, c1, 0.75) * 0.55;
    colour += uBlue * lobe(uv, c2, 0.65) * 0.42;
    colour += uAmber * lobe(uv, c3, 0.55) * 0.30;

    // Fade out toward the bottom so the section blends into the page
    // instead of ending on a hard edge.
    colour *= smoothstep(0.0, 0.45, uv.y);

    gl_FragColor = vec4(colour, 1.0);
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
        // Approximations of the OKLCH brand tokens in linear-ish sRGB.
        // Kept close to --gradient-hero so the WebGL layer and the CSS
        // fallback read as the same design.
        uViolet: { value: [0.72, 0.29, 0.92] },
        uBlue: { value: [0.32, 0.45, 0.95] },
        uAmber: { value: [0.98, 0.65, 0.25] },
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
