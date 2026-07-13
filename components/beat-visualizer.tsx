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
  /** 深度坐标（px），配合透视投影产生 3D 感 */
  depth: number;
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

type BackgroundStar = {
  u: number;
  v: number;
  /** 0.25–1，越大越近，视差和亮度越强 */
  layer: number;
  size: number;
  seed: number;
};

type Shockwave = {
  startedAt: number;
  intensity: number;
};

const TITLE_TEXT = "EVERY BEAT REMEMBERS YOU";
const DISSOLVE_DURATION_S = 1.2;
const DISSOLVE_PROGRESS = 0.08;
const TITLE_PROGRESS = 0.7;
const REASSEMBLE_PROGRESS = 0.92;
const REASSEMBLE_SPAN = 0.06;
const SPRING_STIFFNESS = 0.09;
const SPRING_DAMPING = 0.86;
const FOCAL_LENGTH = 620;
const STAR_COUNT = 260;
const SHOCKWAVE_SPEED = 620; // px/s
const SHOCKWAVE_WIDTH = 90;
const POINTER_RADIUS = 130;
const POINTER_STRENGTH = 2.4;
const SPACEBAR_SHOCKWAVE_INTENSITY = 0.8;
const INTERACTIVE_TAGS = new Set(["INPUT", "TEXTAREA", "BUTTON", "SELECT"]);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;

function createStarfield(): BackgroundStar[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    u: Math.random(),
    v: Math.random(),
    layer: 0.25 + Math.random() * 0.75,
    size: 0.4 + Math.random() * 1.4,
    seed: Math.random() * Math.PI * 2,
  }));
}

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
  const starsRef = useRef<BackgroundStar[]>([]);
  // 跨 effect 重跑（暂停/恢复）保留幕状态，否则暂停会把溶解进度打回 Act 1
  const dissolveStartedAtRef = useRef<number | null>(null);
  const lastAudioTimeRef = useRef(0);
  const flashLevelRef = useRef(0);
  const pulseRef = useRef({ value: 0, velocity: 0 });
  const shockwavesRef = useRef<Shockwave[]>([]);
  const pointerRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const columns = window.innerWidth < 640 ? 64 : 96;
    particlesRef.current = portraitImage
      ? sampleParticles(portraitImage, { columns }).map((particle) => ({
          ...particle,
          depth: (Math.random() - 0.5) * 110,
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

    if (starsRef.current.length === 0) starsRef.current = createStarfield();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let width = 0;
    let height = 0;

    // 鼠标/触摸排斥力场：pointermove 覆盖鼠标拖动和触摸滑动
    const handlePointerActive = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY, active: true };
    };
    const handlePointerInactive = () => {
      pointerRef.current.active = false;
    };
    // 鼠标移出窗口时 pointerup/pointercancel 不会触发，用 mouseout 兜底
    const handleWindowMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget === null) pointerRef.current.active = false;
    };
    window.addEventListener("pointermove", handlePointerActive, { passive: true });
    window.addEventListener("pointerdown", handlePointerActive, { passive: true });
    window.addEventListener("pointerup", handlePointerInactive, { passive: true });
    window.addEventListener("pointercancel", handlePointerInactive, { passive: true });
    window.addEventListener("mouseout", handleWindowMouseOut);

    // 空格手动打节拍：不劫持按钮/输入框自身的空格激活行为
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && INTERACTIVE_TAGS.has(target.tagName)) return;
      if (!isPlaying || reducedMotion.matches) return;
      event.preventDefault();
      const now = audioRef.current?.currentTime ?? 0;
      shockwavesRef.current.push({ startedAt: now, intensity: SPACEBAR_SHOCKWAVE_INTENSITY });
      if (shockwavesRef.current.length > 3) shockwavesRef.current.shift();
    };
    window.addEventListener("keydown", handleKeyDown);

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
      // 不依赖 onLoad 回调拿引用：已缓存图片可能不触发 onLoad
      if (!photoRef.current || !photoRef.current.isConnected) {
        photoRef.current = root.querySelector<HTMLImageElement>("img.visual-stage__photo");
      }
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

    const drawStarfield = (
      time: number,
      swayAngle: number,
      energy: number,
      beatBoost: number,
    ) => {
      context.save();
      context.globalCompositeOperation = "lighter";
      for (const star of starsRef.current) {
        // 视差：近层的星随 3D 摇摆位移更大
        const parallax = swayAngle * 90 * star.layer;
        const x = star.u * width + parallax;
        const y = star.v * height;
        const twinkle = 0.45 + 0.55 * Math.sin(time * (0.8 + star.layer) + star.seed);
        const alpha = clamp01(
          star.layer * 0.5 * twinkle * (0.55 + energy * 0.6) + beatBoost * 0.35,
        );
        context.globalAlpha = alpha;
        context.fillStyle = star.layer > 0.7 ? "#dff6ff" : "#9db8d8";
        context.beginPath();
        context.arc(x, y, star.size * (1 + beatBoost * 0.8), 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    };

    const drawNebula = (time: number, energy: number) => {
      const drift = Math.sin(time * 0.07) * width * 0.05;
      const nebulaA = context.createRadialGradient(
        width * 0.72 + drift, height * 0.4, 0,
        width * 0.72 + drift, height * 0.4, Math.max(width, height) * 0.5,
      );
      nebulaA.addColorStop(0, `rgba(101, 246, 255, ${0.045 + energy * 0.05})`);
      nebulaA.addColorStop(1, "transparent");
      const nebulaB = context.createRadialGradient(
        width * 0.3 - drift, height * 0.75, 0,
        width * 0.3 - drift, height * 0.75, Math.max(width, height) * 0.45,
      );
      nebulaB.addColorStop(0, `rgba(255, 74, 184, ${0.035 + energy * 0.04})`);
      nebulaB.addColorStop(1, "transparent");
      context.save();
      context.globalCompositeOperation = "lighter";
      context.fillStyle = nebulaA;
      context.fillRect(0, 0, width, height);
      context.fillStyle = nebulaB;
      context.fillRect(0, 0, width, height);
      context.restore();
    };

    const drawScene = () => {
      const frame = readFrame();
      const audio = audioRef.current;
      const currentTime = audio?.currentTime ?? 0;
      const duration = audio?.duration ?? 0;
      const progress = duration > 0 ? clamp01(currentTime / duration) : 0;

      // 回退（replay/seek）后重置溶解状态
      if (currentTime < lastAudioTimeRef.current) {
        dissolveStartedAtRef.current = null;
        shockwavesRef.current = [];
      }
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

      // 强卡点：节拍打进弹性脉冲 + 生成冲击波
      if (frame.beat && !reducedMotion.matches) {
        pulseRef.current.velocity += 0.55 + frame.intensity * 0.8;
        if (portraitAlpha > 0.3) {
          shockwavesRef.current.push({ startedAt: currentTime, intensity: frame.intensity });
          if (shockwavesRef.current.length > 3) shockwavesRef.current.shift();
        }
      }
      const pulse = pulseRef.current;
      pulse.velocity += -pulse.value * 0.16;
      pulse.velocity *= 0.82;
      pulse.value += pulse.velocity;
      const portraitScale = 1 + Math.max(-0.04, pulse.value * 0.055);

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

      // 宇宙空间层：3D 摇摆角度也驱动星野视差
      const swayAngle = reducedMotion.matches
        ? 0
        : Math.sin(currentTime * 0.45) * 0.16 * dissolve * (1 - reassemble);
      drawNebula(currentTime, frame.mid);
      drawStarfield(currentTime, swayAngle, frame.mid, flashLevelRef.current);

      if (portraitAlpha <= 0.001) return;

      const content = measureContentRect();
      if (!content) return;

      const centerX = content.x + content.width / 2;
      const centerY = content.y + content.height / 2;
      const columnsUsed = window.innerWidth < 640 ? 64 : 96;
      const cellSize = content.width / columnsUsed;
      const breathAmplitude = frame.low * Math.min(content.width, content.height) * 0.03;
      const waveAmplitude = frame.mid * Math.min(content.width, content.height) * 0.045;
      const scatterHold = 1 - easeOutCubic(dissolve);
      const settle = 1 - reassemble;
      const timePhase = currentTime * 1.8;
      const cosSway = Math.cos(swayAngle);
      const sinSway = Math.sin(swayAngle);

      // 冲击波推进（按音频时间推进，暂停时自然冻结）
      const waves = shockwavesRef.current.filter(
        (wave) => (currentTime - wave.startedAt) * SHOCKWAVE_SPEED
          < Math.max(width, height) * 0.9,
      );
      shockwavesRef.current = waves;

      context.save();
      context.globalCompositeOperation = "lighter";

      // 画冲击波环本体
      for (const wave of waves) {
        const radius = (currentTime - wave.startedAt) * SHOCKWAVE_SPEED;
        if (radius < 4) continue;
        const fade = clamp01(1 - radius / (Math.max(width, height) * 0.9));
        context.globalAlpha = fade * 0.32 * (0.5 + wave.intensity);
        context.lineWidth = 2 + wave.intensity * 3;
        context.strokeStyle = "#8ef4ff";
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.stroke();
      }

      const pointer = pointerRef.current;

      for (const particle of particles) {
        particle.flash *= 0.9;

        // 肖像平面坐标（以肖像中心为原点）
        let worldX = (particle.homeX - 0.5) * content.width;
        const worldY = (particle.homeY - 0.5) * content.height;

        // 舞动感：中频驱动一道波浪横穿肖像
        worldX += Math.sin(particle.homeY * Math.PI * 4 + timePhase * 1.25)
          * waveAmplitude;

        // 呼吸（低频径向涨落）
        const directionX = particle.homeX - 0.5;
        const directionY = particle.homeY - 0.5;
        const directionLength = Math.hypot(directionX, directionY) || 1;
        const breath = breathAmplitude
          * (0.5 + 0.5 * Math.sin(particle.seed * Math.PI * 2 + timePhase));

        // 3D：绕 Y 轴缓慢摇摆 + 透视投影
        const rotatedX = worldX * cosSway + particle.depth * sinSway;
        const rotatedZ = -worldX * sinSway + particle.depth * cosSway;
        const perspective = FOCAL_LENGTH / (FOCAL_LENGTH + rotatedZ);

        const baseX = centerX + rotatedX * perspective * portraitScale;
        const baseY = centerY + worldY * perspective * portraitScale;

        // 鼠标/触摸排斥力场：越靠近指针推力越大，松手后弹簧自动拉回
        if (pointer.active && portraitAlpha > 0.05) {
          const pointerDx = baseX - pointer.x;
          const pointerDy = baseY - pointer.y;
          const pointerDistance = Math.hypot(pointerDx, pointerDy);
          if (pointerDistance < POINTER_RADIUS && pointerDistance > 0.001) {
            const repelForce = (1 - pointerDistance / POINTER_RADIUS) * POINTER_STRENGTH;
            particle.velocityX += (pointerDx / pointerDistance) * repelForce;
            particle.velocityY += (pointerDy / pointerDistance) * repelForce;
          }
        }

        particle.velocityX += -particle.offsetX * SPRING_STIFFNESS;
        particle.velocityY += -particle.offsetY * SPRING_STIFFNESS;
        particle.velocityX *= SPRING_DAMPING;
        particle.velocityY *= SPRING_DAMPING;
        particle.offsetX += particle.velocityX;
        particle.offsetY += particle.velocityY;

        // 冲击波扫过时把粒子往外推并点亮
        let waveKick = 0;
        for (const wave of waves) {
          const waveRadius = (currentTime - wave.startedAt) * SHOCKWAVE_SPEED;
          const particleRadius = Math.hypot(baseX - centerX, baseY - centerY);
          const distanceToFront = Math.abs(particleRadius - waveRadius);
          if (distanceToFront < SHOCKWAVE_WIDTH) {
            waveKick = Math.max(
              waveKick,
              (1 - distanceToFront / SHOCKWAVE_WIDTH) * wave.intensity,
            );
          }
        }
        if (waveKick > 0.35 && particle.flash < waveKick) particle.flash = waveKick;

        const kickScale = 1 + waveKick * 0.1;
        const displacementX = (particle.scatterX * scatterHold
          + particle.offsetX
          + (directionX / directionLength) * (breath + waveKick * 16)) * settle;
        const displacementY = (particle.scatterY * scatterHold
          + particle.offsetY
          + (directionY / directionLength) * (breath + waveKick * 16)) * settle;

        const x = (baseX - centerX) * kickScale + centerX + displacementX;
        const y = (baseY - centerY) * kickScale + centerY + displacementY;

        const radius = Math.max(
          0.6,
          particle.size * cellSize * 0.5 * perspective
            * (0.8 + frame.mid * 0.3 + particle.flash * 0.7),
        );
        const alpha = clamp01(
          portraitAlpha
            * (0.35 + 0.65 * particle.luminance)
            * (0.72 + frame.mid * 0.35)
            * (0.65 + 0.35 * perspective),
        );

        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();

        if (particle.flash > 0.06) {
          context.globalAlpha = clamp01(particle.flash * portraitAlpha);
          context.fillStyle = "#f8fbff";
          context.beginPath();
          context.arc(x, y, radius * 1.4, 0, Math.PI * 2);
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
      window.removeEventListener("pointermove", handlePointerActive);
      window.removeEventListener("pointerdown", handlePointerActive);
      window.removeEventListener("pointerup", handlePointerInactive);
      window.removeEventListener("pointercancel", handlePointerInactive);
      window.removeEventListener("mouseout", handleWindowMouseOut);
      window.removeEventListener("keydown", handleKeyDown);
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
