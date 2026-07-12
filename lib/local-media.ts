const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

export function validatePhotoFile(file: File): string | null {
  if (!PHOTO_TYPES.has(file.type)) return "Choose a JPEG, PNG, or WebP photo.";
  if (file.size > MAX_PHOTO_BYTES) return "Keep the photo under 10 MB.";
  return null;
}

export function validateAudioFile(file: File): string | null {
  if (!file.type.startsWith("audio/")) return "Choose an audio file your browser can play.";
  if (file.size > MAX_AUDIO_BYTES) return "Keep the song under 30 MB for this prototype.";
  return null;
}
