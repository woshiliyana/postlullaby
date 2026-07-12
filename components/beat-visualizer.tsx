"use client";

import Image from "next/image";
import { useEffect, useRef, type RefObject } from "react";

import type { AudioEnergyFrame } from "@/components/use-audio-beats";

type BeatVisualizerProps = {
  photoUrl: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  readFrame: () => AudioEnergyFrame;
  onPhotoLoad?: () => void;
  onPhotoError?: () => void;
};

type Particle = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  life: number;
  color: string;
};

const PARTICLE_COLORS = ["#65f6ff", "#ff4ab8", "#ffe15a", "#f8fbff"];

export function BeatVisualizer({
  photoUrl,
  audioRef,
  isPlaying,
  readFrame,
  onPhotoLoad,
  onPhotoError,
}: BeatVisualizerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;

    const resizeCanvas = () => {
      const bounds = root.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const addBeatParticles = (intensity: number) => {
      const particleCount = Math.min(14, 7 + Math.round(intensity * 7));
      const centerX = width / 2;
      const centerY = height / 2;

      for (let index = 0; index < particleCount; index += 1) {
        const angle = (Math.PI * 2 * index) / particleCount + Math.random() * 0.25;
        const speed = 1.8 + Math.random() * 3.2 + intensity * 2;
        particles.push({
          x: centerX,
          y: centerY,
          velocityX: Math.cos(angle) * speed,
          velocityY: Math.sin(angle) * speed,
          radius: 1.5 + Math.random() * 3.5,
          life: 1,
          color: PARTICLE_COLORS[index % PARTICLE_COLORS.length],
        });
      }

      if (particles.length > 90) particles = particles.slice(particles.length - 90);
    };

    const drawRing = (frame: AudioEnergyFrame) => {
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.32;
      const phase = (audioRef.current?.currentTime ?? 0) * 0.9;
      const segments = 96;

      context.save();
      context.globalCompositeOperation = "lighter";
      context.lineWidth = 1.25 + frame.high * 2.5;
      context.shadowBlur = 18 + frame.mid * 24;
      context.shadowColor = frame.high > 0.28 ? "#ff4ab8" : "#65f6ff";
      context.strokeStyle = `rgba(101, 246, 255, ${0.25 + frame.mid * 0.65})`;
      context.beginPath();

      for (let index = 0; index <= segments; index += 1) {
        const angle = (Math.PI * 2 * index) / segments - Math.PI / 2;
        const wave = Math.sin(angle * 7 + phase) * frame.mid * 11;
        const shimmer = Math.cos(angle * 13 - phase * 1.6) * frame.high * 8;
        const radius = baseRadius + wave + shimmer;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }

      context.closePath();
      context.stroke();
      context.restore();
    };

    const drawParticles = () => {
      context.save();
      context.globalCompositeOperation = "lighter";
      particles = particles.filter((particle) => {
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.velocityX *= 0.985;
        particle.velocityY *= 0.985;
        particle.life -= 0.022;
        if (particle.life <= 0) return false;

        context.globalAlpha = particle.life;
        context.fillStyle = particle.color;
        context.shadowBlur = 16;
        context.shadowColor = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius * particle.life, 0, Math.PI * 2);
        context.fill();
        return true;
      });
      context.restore();
    };

    const animate = () => {
      const frame = readFrame();
      const requestedScale = 1 + frame.low * 0.055;
      const photoScale = reducedMotion.matches ? Math.min(requestedScale, 1.015) : requestedScale;
      root.style.setProperty("--photo-scale", String(photoScale));
      root.style.setProperty("--ring-alpha", String(0.25 + frame.mid * 0.65));
      root.style.setProperty("--beat-flash", String(frame.beat ? frame.intensity : 0));

      if (frame.beat && !reducedMotion.matches) addBeatParticles(frame.intensity);

      context.clearRect(0, 0, width, height);
      drawRing(frame);
      drawParticles();
      animationFrame = window.requestAnimationFrame(animate);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    if (isPlaying) {
      animationFrame = window.requestAnimationFrame(animate);
    } else {
      particles = [];
      root.style.setProperty("--photo-scale", "1");
      root.style.setProperty("--ring-alpha", "0.25");
      root.style.setProperty("--beat-flash", "0");
      context.clearRect(0, 0, width, height);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
      particles = [];
      root.style.setProperty("--photo-scale", "1");
      root.style.setProperty("--beat-flash", "0");
      context.clearRect(0, 0, width, height);
    };
  }, [audioRef, isPlaying, readFrame]);

  return (
    <div ref={rootRef} className="visual-stage" aria-label="Beat-reactive photo stage">
      <Image
        className="visual-stage__backdrop"
        src={photoUrl}
        alt=""
        fill
        sizes="100vw"
        unoptimized
        priority
        aria-hidden="true"
        draggable={false}
      />
      <div className="visual-stage__wash" aria-hidden="true" />
      <div className="visual-stage__frame">
        <Image
          className="visual-stage__photo"
          src={photoUrl}
          alt="Your selected photo on the beat-reactive stage"
          fill
          sizes="(max-width: 640px) 88vw, 62vw"
          unoptimized
          priority
          draggable={false}
          onLoad={onPhotoLoad}
          onError={onPhotoError}
        />
      </div>
      <div className="visual-stage__flash" aria-hidden="true" />
      <canvas ref={canvasRef} className="visual-stage__canvas" aria-hidden="true" />
    </div>
  );
}
