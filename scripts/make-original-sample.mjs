import { mkdir, writeFile } from "node:fs/promises";

const sampleRate = 44_100;
const seconds = 15;
const frameCount = sampleRate * seconds;
const bpm = 132;
const beatSeconds = 60 / bpm;
const mix = new Float32Array(frameCount);
const bassNotes = [65.41, 82.41, 98, 73.42];
let randomState = 0x51f15e;

function noise() {
  randomState = (randomState * 1_664_525 + 1_013_904_223) >>> 0;
  return (randomState / 0xffffffff) * 2 - 1;
}

for (let index = 0; index < frameCount; index += 1) {
  const time = index / sampleRate;
  const beatPosition = time / beatSeconds;
  const beatPhase = beatPosition % 1;
  const halfBeatPhase = (beatPosition * 2) % 1;
  const barBeat = Math.floor(beatPosition) % 4;

  const kickEnvelope = Math.exp(-beatPhase * 13);
  const kickFrequency = 46 + 58 * Math.exp(-beatPhase * 18);
  const kick = Math.sin(2 * Math.PI * kickFrequency * time) * kickEnvelope;

  const clapPhase = (beatPosition + 0.5) % 1;
  const clap = clapPhase < 0.16 ? noise() * Math.exp(-clapPhase * 28) : 0;

  const bassFrequency = bassNotes[barBeat];
  const bass =
    Math.sin(2 * Math.PI * bassFrequency * time) *
    Math.exp(-halfBeatPhase * 2.8) *
    0.34;

  const chordRoot = [261.63, 220, 293.66, 246.94][Math.floor(beatPosition / 4) % 4];
  const pad = [1, 1.25, 1.5, 1.875]
    .map((ratio) => Math.sin(2 * Math.PI * chordRoot * ratio * time))
    .reduce((sum, value) => sum + value, 0) * 0.045;

  const sparkleFrequency = [659.25, 783.99, 987.77, 880][Math.floor(beatPosition * 2) % 4];
  const sparkle =
    Math.sin(2 * Math.PI * sparkleFrequency * time) *
    Math.exp(-halfBeatPhase * 8) *
    0.08;

  const fadeIn = Math.min(1, time / 0.08);
  const fadeOut = Math.min(1, (seconds - time) / 0.08);
  mix[index] = Math.max(
    -1,
    Math.min(1, (kick * 0.56 + clap * 0.15 + bass + pad + sparkle) * fadeIn * fadeOut),
  );
}

const wavBuffer = Buffer.alloc(44 + frameCount * 4);
wavBuffer.write("RIFF", 0);
wavBuffer.writeUInt32LE(36 + frameCount * 4, 4);
wavBuffer.write("WAVEfmt ", 8);
wavBuffer.writeUInt32LE(16, 16);
wavBuffer.writeUInt16LE(1, 20);
wavBuffer.writeUInt16LE(2, 22);
wavBuffer.writeUInt32LE(sampleRate, 24);
wavBuffer.writeUInt32LE(sampleRate * 4, 28);
wavBuffer.writeUInt16LE(4, 32);
wavBuffer.writeUInt16LE(16, 34);
wavBuffer.write("data", 36);
wavBuffer.writeUInt32LE(frameCount * 4, 40);

for (let index = 0; index < frameCount; index += 1) {
  const left = Math.round(mix[index] * 32_767);
  const right = Math.round(mix[index] * (0.96 + 0.04 * Math.sin(index / 1700)) * 32_767);
  wavBuffer.writeInt16LE(left, 44 + index * 4);
  wavBuffer.writeInt16LE(right, 46 + index * 4);
}

await mkdir(new URL("../public/sample/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/sample/original-spark.wav", import.meta.url), wavBuffer);
console.log("Created public/sample/original-spark.wav (15s, original, 132 BPM)");
