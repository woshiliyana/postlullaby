"use client";

import {
  FolderOpen,
  ImagePlus,
  Music2,
  Pause,
  Play,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { BeatVisualizer } from "@/components/beat-visualizer";
import {
  isAudioEngineInitializationError,
  useAudioBeats,
} from "@/components/use-audio-beats";
import { validateAudioFile, validatePhotoFile } from "@/lib/local-media";
import { cn } from "@/lib/utils";

const ORIGINAL_AUDIO_URL = "/sample/original-spark.wav";
// 采样用的工作分辨率：96 列网格下每格约 4px，够均色用
const PORTRAIT_SAMPLE_EDGE = 384;

async function decodePortraitImage(photoObjectUrl: string): Promise<ImageData> {
  const image = new window.Image();
  image.src = photoObjectUrl;
  await image.decode();

  const scale = Math.min(
    1,
    PORTRAIT_SAMPLE_EDGE / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

export function PhotoBeatStudio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const photoObjectUrlRef = useRef<string | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const playbackAttemptRef = useRef(0);
  const audioSourceRef = useRef<string | null>(ORIGINAL_AUDIO_URL);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [portraitImage, setPortraitImage] = useState<ImageData | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [audioMode, setAudioMode] = useState<"original" | "local">("original");
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [localAudioName, setLocalAudioName] = useState("");
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  const { resume, readFrame, reset } = useAudioBeats(audioRef);
  const audioSource = audioMode === "original" ? ORIGINAL_AUDIO_URL : localAudioUrl;
  const trackName = audioMode === "original" ? "Original Spark" : localAudioName || "Choose a local song";
  const canPlay = Boolean(photoUrl && photoReady && audioSource && audioReady);

  const invalidatePlaybackAttempt = useCallback(() => {
    playbackAttemptRef.current += 1;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audioSourceRef.current = audioSource;
    invalidatePlaybackAttempt();
    audio.pause();
    audio.currentTime = 0;
    reset();
    setIsPlaying(false);
    setHasEntered(false);
    setAudioReady(false);
    setAudioError(null);
    audio.load();
  }, [audioSource, invalidatePlaybackAttempt, reset]);

  useEffect(() => {
    return () => {
      invalidatePlaybackAttempt();
      if (photoObjectUrlRef.current) URL.revokeObjectURL(photoObjectUrlRef.current);
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    };
  }, [invalidatePlaybackAttempt]);

  const stopAndReset = () => {
    invalidatePlaybackAttempt();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    reset();
    setIsPlaying(false);
    setHasEntered(false);
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const validationError = validatePhotoFile(file);
    if (validationError) {
      setPhotoError(validationError);
      return;
    }

    const nextPhotoUrl = URL.createObjectURL(file);
    if (photoObjectUrlRef.current) URL.revokeObjectURL(photoObjectUrlRef.current);
    photoObjectUrlRef.current = nextPhotoUrl;
    stopAndReset();
    setPhotoUrl(nextPhotoUrl);
    setPhotoName(file.name);
    setPhotoReady(false);
    setPhotoError(null);

    setPortraitImage(null);
    void decodePortraitImage(nextPhotoUrl)
      .then((imageData) => {
        // 用户可能已经换了下一张照片，旧结果直接丢弃
        if (photoObjectUrlRef.current === nextPhotoUrl) setPortraitImage(imageData);
      })
      .catch(() => {
        // 采样失败只降级为无溶解效果，不阻塞播放
        if (photoObjectUrlRef.current === nextPhotoUrl) setPortraitImage(null);
      });
  };

  const handleAudioChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const validationError = validateAudioFile(file);
    if (validationError) {
      setAudioError(validationError);
      return;
    }

    const support = document.createElement("audio").canPlayType(file.type);
    if (!support) {
      setAudioError("This browser can’t play that audio format.");
      return;
    }

    const nextAudioUrl = URL.createObjectURL(file);
    stopAndReset();
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    audioObjectUrlRef.current = nextAudioUrl;
    setLocalAudioUrl(nextAudioUrl);
    setLocalAudioName(file.name);
    setAudioMode("local");
    setAudioReady(false);
    setAudioError(null);
  };

  const chooseOriginal = () => {
    invalidatePlaybackAttempt();
    setAudioMode("original");
    setAudioError(null);
  };

  const chooseLocal = () => {
    invalidatePlaybackAttempt();
    setAudioMode("local");
    setAudioError(null);
    if (!localAudioUrl) audioInputRef.current?.click();
  };

  const play = async () => {
    const audio = audioRef.current;
    if (!audio || !canPlay) return;

    const attempt = playbackAttemptRef.current + 1;
    playbackAttemptRef.current = attempt;
    const source = audioSource;
    const isCurrentAttempt = () => (
      playbackAttemptRef.current === attempt
      && audioRef.current === audio
      && audioSourceRef.current === source
    );

    setAudioError(null);
    try {
      if (audio.ended) {
        audio.currentTime = 0;
        reset();
      }
      await resume();
      if (!isCurrentAttempt()) return;
      await audio.play();
      if (!isCurrentAttempt()) return;
      setHasEntered(true);
      setIsPlaying(true);
    } catch (error) {
      if (!isCurrentAttempt()) return;
      setIsPlaying(false);
      setAudioError(
        isAudioEngineInitializationError(error)
          ? "The audio engine couldn’t start. Reload this page to try again."
          : "Playback couldn’t start. Try pressing play again.",
      );
    }
  };

  const pause = () => {
    invalidatePlaybackAttempt();
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const handlePrimaryAction = () => {
    if (isPlaying) pause();
    else void play();
  };

  const replay = async () => {
    const audio = audioRef.current;
    if (!audio || !canPlay) return;

    audio.pause();
    audio.currentTime = 0;
    reset();
    setAudioError(null);

    const attempt = playbackAttemptRef.current + 1;
    playbackAttemptRef.current = attempt;
    const source = audioSource;
    const isCurrentAttempt = () => (
      playbackAttemptRef.current === attempt
      && audioRef.current === audio
      && audioSourceRef.current === source
    );

    try {
      await resume();
      if (!isCurrentAttempt()) return;
      await audio.play();
      if (!isCurrentAttempt()) return;
      setHasEntered(true);
      setIsPlaying(true);
    } catch (error) {
      if (!isCurrentAttempt()) return;
      setIsPlaying(false);
      setAudioError(
        isAudioEngineInitializationError(error)
          ? "The audio engine couldn’t start. Reload this page to try again."
          : "Replay couldn’t start. Try pressing replay again.",
      );
    }
  };

  return (
    <main className={cn("studio-shell", photoUrl && "studio-shell--loaded")}>
      {photoUrl ? (
        <BeatVisualizer
          photoUrl={photoUrl}
          portraitImage={portraitImage}
          audioRef={audioRef}
          isPlaying={isPlaying}
          readFrame={readFrame}
          onPhotoLoad={() => setPhotoReady(true)}
          onPhotoError={() => {
            setPhotoReady(false);
            setPhotoError("This photo couldn’t be read. Choose another one.");
          }}
        />
      ) : (
        <div className="empty-stage" aria-hidden="true">
          <div className="empty-stage__orb empty-stage__orb--cyan" />
          <div className="empty-stage__orb empty-stage__orb--pink" />
          <div className="empty-stage__record"><Sparkles size={38} strokeWidth={1.5} /></div>
          <span className="empty-stage__stamp">PLAY IT LOUD</span>
        </div>
      )}

      <section className="studio-panel" aria-label="Photo beat controls">
        <div className="studio-panel__brand">
          <span className="brand-mark" aria-hidden="true">PL</span>
          <span>POSTLULLABY / LIVE</span>
        </div>

        <header className="studio-intro">
          <p className="studio-kicker">PHOTO BEAT LAB</p>
          <h1>One photo. One song. Hit the beat.</h1>
          <p className="studio-privacy">Your files stay in this browser.</p>
        </header>

        {!photoUrl ? (
          <label className="photo-drop" htmlFor="photo-input">
            <span className="photo-drop__icon"><ImagePlus size={26} /></span>
            <span className="photo-drop__title">Choose your hero shot</span>
            <span className="photo-drop__meta">JPEG, PNG or WebP · up to 10 MB</span>
            <span className="photo-drop__action"><FolderOpen size={16} /> Pick a photo</span>
          </label>
        ) : (
          <div className="photo-selected">
            <span className="photo-selected__status"><span /> PHOTO LOCKED</span>
            <strong title={photoName}>{photoName}</strong>
            <button type="button" className="text-button" onClick={() => photoInputRef.current?.click()}>
              <ImagePlus size={15} /> Change photo
            </button>
          </div>
        )}

        <input
          ref={photoInputRef}
          id="photo-input"
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoChange}
        />
        {photoError ? <p className="field-error" role="alert">{photoError}</p> : null}

        <fieldset className="track-picker">
          <legend>Pick the pulse</legend>
          <div className="track-picker__options">
            <button
              type="button"
              className={cn("track-option", audioMode === "original" && "is-active")}
              aria-pressed={audioMode === "original"}
              onClick={chooseOriginal}
            >
              <span className="track-option__number">01</span>
              <span><strong>Original Spark</strong><small>15 sec · 132 BPM</small></span>
            </button>
            <button
              type="button"
              className={cn("track-option", audioMode === "local" && "is-active")}
              aria-pressed={audioMode === "local"}
              onClick={chooseLocal}
            >
              <span className="track-option__number">02</span>
              <span><strong>Your Song</strong><small>Local audio only</small></span>
            </button>
          </div>
        </fieldset>

        {audioMode === "local" ? (
          <label className="audio-file-picker" htmlFor="audio-input">
            <Music2 size={17} />
            <span>{localAudioName || "Choose audio from this device"}</span>
            <FolderOpen size={15} />
          </label>
        ) : null}
        <input
          ref={audioInputRef}
          id="audio-input"
          className="visually-hidden"
          type="file"
          accept="audio/*"
          onChange={handleAudioChange}
        />
        {audioError ? <p className="field-error" role="alert">{audioError}</p> : null}

        <div className="now-playing" aria-live="polite">
          <span className={cn("equalizer", isPlaying && "is-playing")} aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          <span><small>NOW CUED</small><strong title={trackName}>{trackName}</strong></span>
        </div>

        <div className="playback-actions">
          <button
            type="button"
            className="primary-action"
            disabled={!canPlay}
            onClick={handlePrimaryAction}
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            {hasEntered ? (isPlaying ? "Pause" : "Play") : "Enter the beat"}
          </button>
          {hasEntered ? (
            <button type="button" className="replay-action" disabled={!canPlay} onClick={() => void replay()}>
              <RefreshCcw size={18} /> <span>Replay</span>
            </button>
          ) : null}
        </div>

        {!photoUrl ? <p className="studio-hint">Start with one photo. We’ll handle the rhythm.</p> : null}
      </section>

      <audio
        ref={audioRef}
        src={audioSource ?? undefined}
        preload="auto"
        onCanPlay={() => setAudioReady(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setAudioReady(false);
          setIsPlaying(false);
          setAudioError("This track couldn’t be played. Choose another audio file.");
        }}
      />
    </main>
  );
}
