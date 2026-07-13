import { describe, expect, it } from "vitest";
import { validateAudioFile, validatePhotoFile } from "./local-media";

describe("local media validation", () => {
  it("accepts a JPEG photo and MP3 audio", () => {
    expect(validatePhotoFile(new File(["x"], "pet.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(validateAudioFile(new File(["x"], "gee.mp3", { type: "audio/mpeg" }))).toBeNull();
  });

  it("rejects unsupported files with useful messages", () => {
    expect(validatePhotoFile(new File(["x"], "pet.gif", { type: "image/gif" }))).toBe(
      "Choose a JPEG, PNG, or WebP photo.",
    );
    expect(validateAudioFile(new File(["x"], "notes.txt", { type: "text/plain" }))).toBe(
      "Choose an audio file your browser can play.",
    );
  });
});
