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
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { BeatVisualizer } from "@/components/beat-visualizer";
import { useAudioBeats } from "@/components/use-audio-beats";
import { validateAudioFile, validatePhotoFile } from "@/lib/local-media";

const ORIGINAL_AUDIO_URL = "/sample/original-spark.wav";

export function PhotoBeatStudio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const photoObjectUrlRef = useRef<string | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    reset();
    setIsPlaying(false);
    setHasEntered(false);
    setAudioReady(false);
    setAudioError(null);
    audio.load();
  }, [audioSource, reset]);

  useEffect(() => {
    return () => {
      if (photoObjectUrlRef.current) URL.revokeObjectURL(photoObjectUrlRef.current);
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    };
  }, []);

  const stopAndReset = () => {
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
    setAudioMode("original");
    setAudioError(null);
  };

  const chooseLocal = () => {
    setAudioMode("local");
    setAudioError(null);
    if (!localAudioUrl) audioInputRef.current?.click();
  };

  const play = async () => {
    const audio = audioRef.current;
    if (!audio || !canPlay) return;

    setAudioError(null);
    try {
      if (audio.ended) {
        audio.currentTime = 0;
        reset();
      }
      await resume();
      await audio.play();
      setHasEntered(true);
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      setAudioError("Playback couldn’t start. Try pressing play again.");
    }
  };

  const pause = () => {
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

    try {
      await resume();
      await audio.play();
      setHasEntered(true);
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      setAudioError("Replay couldn’t start. Try pressing replay again.");
    }
  };

  return (
    <main className={`studio-shell${photoUrl ? " studio-shell--loaded" : ""}`}>
      {photoUrl ? (
        <BeatVisualizer
          photoUrl={photoUrl}
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
              className={audioMode === "original" ? "track-option is-active" : "track-option"}
              aria-pressed={audioMode === "original"}
              onClick={chooseOriginal}
            >
              <span className="track-option__number">01</span>
              <span><strong>Original Spark</strong><small>15 sec · 132 BPM</small></span>
            </button>
            <button
              type="button"
              className={audioMode === "local" ? "track-option is-active" : "track-option"}
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
          <span className={isPlaying ? "equalizer is-playing" : "equalizer"} aria-hidden="true">
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
        onPlaying={() => setIsPlaying(true)}
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
