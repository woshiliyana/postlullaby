"use client";

import Image from "next/image";
import { useEffect, useRef, type RefObject } from "react";

import type { AudioEnergyFrame } from "@/components/use-audio-beats";
import {
  sampleParticles,
  type PortraitImageSource,
} from "@/lib/visual/particle-portrait";

type BeatVisualizerProps = {
  photoUrl: string;
  portraitImage: PortraitImageSource | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  readFrame: () => AudioEnergyFrame;
  onPhotoLoad?: () => void;
  onPhotoError?: () => void;
};

type StageParticle = {
  homeX: number;
  homeY: number;
  color: string;
  size: number;
  luminance: number;
  seed: number;
  scatterX: number;
  scatterY: number;
  offsetX: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
  flash: number;
};

const TITLE_TEXT = "EVERY BEAT REMEMBERS YOU";
const DISSOLVE_DURATION_S = 1.2;
const DISSOLVE_PROGRESS = 0.08;
const TITLE_PROGRESS = 0.7;
const REASSEMBLE_PROGRESS = 0.92;
const REASSEMBLE_SPAN = 0.06;
const BEAT_EXCITED_SHARE = 0.02;
const SPRING_STIFFNESS = 0.09;
const SPRING_DAMPING = 0.86;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;

export function BeatVisualizer({
  photoUrl,
  portraitImage,
  audioRef,
  isPlaying,
  readFrame,
  onPhotoLoad,
  onPhotoError,
}: BeatVisualizerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<HTMLImageElement | null>(null);
  const particlesRef = useRef<StageParticle[]>([]);
  // 跨 effect 重跑（暂停/恢复）保留幕状态，否则暂停会把溶解进度打回 Act 1
  const dissolveStartedAtRef = useRef<number | null>(null);
  const lastAudioTimeRef = useRef(0);
  const flashLevelRef = useRef(0);

  useEffect(() => {
    const columns = window.innerWidth < 640 ? 64 : 96;
    particlesRef.current = portraitImage
      ? sampleParticles(portraitImage, { columns }).map((particle) => ({
          ...particle,
          seed: Math.random(),
          // 溶解时粒子从这个随机偏移飞回 home，形成"星尘漂入"
          scatterX: (Math.random() - 0.5) * 260,
          scatterY: (Math.random() - 0.5) * 260,
          offsetX: 0,
          offsetY: 0,
          velocityX: 0,
          velocityY: 0,
          flash: 0,
        }))
      : [];
  }, [portraitImage]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
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

    // object-fit: contain 的实际内容区域，粒子必须画在这里才能和照片无缝衔接
    const measureContentRect = () => {
      const photo = photoRef.current;
      if (!photo || !photo.naturalWidth || !photo.naturalHeight) return null;
      const box = photo.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) return null;

      const naturalAspect = photo.naturalWidth / photo.naturalHeight;
      const boxAspect = box.width / box.height;
      const contentWidth = naturalAspect > boxAspect ? box.width : box.height * naturalAspect;
      const contentHeight = naturalAspect > boxAspect ? box.width / naturalAspect : box.height;

      return {
        x: box.left + (box.width - contentWidth) / 2,
        y: box.top + (box.height - contentHeight) / 2,
        width: contentWidth,
        height: contentHeight,
      };
    };

    const drawScene = () => {
      const frame = readFrame();
      const audio = audioRef.current;
      const currentTime = audio?.currentTime ?? 0;
      const duration = audio?.duration ?? 0;
      const progress = duration > 0 ? clamp01(currentTime / duration) : 0;

      // 回退（replay/seek）后重置溶解状态
      if (currentTime < lastAudioTimeRef.current) dissolveStartedAtRef.current = null;
      lastAudioTimeRef.current = currentTime;

      const particles = particlesRef.current;
      const canDissolve = particles.length > 0 && !reducedMotion.matches;

      if (
        canDissolve
        && dissolveStartedAtRef.current === null
        && ((frame.beat && currentTime > 0.6) || progress >= DISSOLVE_PROGRESS)
      ) {
        dissolveStartedAtRef.current = currentTime;
      }

      const dissolve = dissolveStartedAtRef.current === null
        ? 0
        : clamp01((currentTime - dissolveStartedAtRef.current) / DISSOLVE_DURATION_S);
      const reassemble = duration > 0
        ? clamp01((progress - REASSEMBLE_PROGRESS) / REASSEMBLE_SPAN)
        : 0;
      const portraitAlpha = canDissolve ? dissolve * (1 - reassemble) : 0;
      const photoAlpha = canDissolve ? Math.max(1 - dissolve, reassemble) : 1;
      const titleAlpha = duration > 0
        ? clamp01((progress - TITLE_PROGRESS) / 0.08)
        : 0;

      flashLevelRef.current = Math.max(
        flashLevelRef.current * 0.88,
        frame.beat ? frame.intensity : 0,
      );
      root.style.setProperty("--photo-alpha", photoAlpha.toFixed(3));
      root.style.setProperty("--title-alpha", titleAlpha.toFixed(3));
      root.style.setProperty("--ring-alpha", String(0.25 + frame.mid * 0.65));
      root.style.setProperty(
        "--beat-flash",
        String(reducedMotion.matches ? flashLevelRef.current * 0.3 : flashLevelRef.current),
      );

      context.clearRect(0, 0, width, height);
      if (portraitAlpha <= 0.001) return;

      const content = measureContentRect();
      if (!content) return;

      if (frame.beat) {
        // 节拍激发一小撮粒子逃逸，弹簧再拉回来
        const excitedCount = Math.max(4, Math.round(particles.length * BEAT_EXCITED_SHARE));
        for (let index = 0; index < excitedCount; index += 1) {
          const particle = particles[Math.floor(Math.random() * particles.length)];
          const angle = Math.random() * Math.PI * 2;
          const impulse = 2.6 + frame.intensity * 4.5;
          particle.velocityX += Math.cos(angle) * impulse;
          particle.velocityY += Math.sin(angle) * impulse;
          particle.flash = 1;
        }
      }

      const cellSize = content.width / (window.innerWidth < 640 ? 64 : 96);
      const breathAmplitude = frame.low * Math.min(content.width, content.height) * 0.035;
      const scatterHold = 1 - easeOutCubic(dissolve);
      const settle = 1 - reassemble;
      const timePhase = currentTime * 1.8;

      context.save();
      context.globalCompositeOperation = "lighter";

      for (const particle of particles) {
        particle.velocityX += -particle.offsetX * SPRING_STIFFNESS;
        particle.velocityY += -particle.offsetY * SPRING_STIFFNESS;
        particle.velocityX *= SPRING_DAMPING;
        particle.velocityY *= SPRING_DAMPING;
        particle.offsetX += particle.velocityX;
        particle.offsetY += particle.velocityY;
        particle.flash *= 0.9;

        const homeX = content.x + particle.homeX * content.width;
        const homeY = content.y + particle.homeY * content.height;
        const directionX = particle.homeX - 0.5;
        const directionY = particle.homeY - 0.5;
        const directionLength = Math.hypot(directionX, directionY) || 1;
        const breath = breathAmplitude * (0.5 + 0.5 * Math.sin(particle.seed * Math.PI * 2 + timePhase));

        const displacementX = (particle.scatterX * scatterHold
          + particle.offsetX
          + (directionX / directionLength) * breath) * settle;
        const displacementY = (particle.scatterY * scatterHold
          + particle.offsetY
          + (directionY / directionLength) * breath) * settle;

        const radius = Math.max(
          0.6,
          particle.size * cellSize * 0.5 * (0.8 + frame.mid * 0.3 + particle.flash * 0.6),
        );
        const alpha = clamp01(
          portraitAlpha
            * (0.35 + 0.65 * particle.luminance)
            * (0.78 + frame.mid * 0.35),
        );

        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(homeX + displacementX, homeY + displacementY, radius, 0, Math.PI * 2);
        context.fill();

        if (particle.flash > 0.06) {
          context.globalAlpha = clamp01(particle.flash * portraitAlpha);
          context.fillStyle = "#f8fbff";
          context.beginPath();
          context.arc(homeX + displacementX, homeY + displacementY, radius * 1.35, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.restore();
    };

    const animate = () => {
      drawScene();
      animationFrame = window.requestAnimationFrame(animate);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    if (isPlaying) {
      animationFrame = window.requestAnimationFrame(animate);
    } else {
      // 暂停/结束冻结在当前幕：补画一帧而不是清空舞台
      drawScene();
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
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
          onLoad={(event) => {
            photoRef.current = event.currentTarget;
            onPhotoLoad?.();
          }}
          onError={onPhotoError}
        />
        <p className="visual-stage__title" aria-hidden="true">{TITLE_TEXT}</p>
      </div>
      <div className="visual-stage__flash" aria-hidden="true" />
      <canvas ref={canvasRef} className="visual-stage__canvas" aria-hidden="true" />
    </div>
  );
}
