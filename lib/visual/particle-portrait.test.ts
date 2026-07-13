import { describe, expect, it } from "vitest";
import { sampleParticles } from "./particle-portrait";

type PixelPainter = (x: number, y: number) => [number, number, number, number];

function makeImage(width: number, height: number, paint: PixelPainter) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha] = paint(x, y);
      const offset = (y * width + x) * 4;
      data[offset] = red;
      data[offset + 1] = green;
      data[offset + 2] = blue;
      data[offset + 3] = alpha;
    }
  }
  return { width, height, data };
}

const BLACK: [number, number, number, number] = [0, 0, 0, 255];
const WHITE: [number, number, number, number] = [255, 255, 255, 255];

describe("sampleParticles", () => {
  it("emits particles only for cells above the luminance threshold", () => {
    // 亮块居中，四周纯黑：粒子必须全部来自中心区域
    const image = makeImage(80, 80, (x, y) =>
      x >= 20 && x < 60 && y >= 20 && y < 60 ? WHITE : BLACK,
    );

    const particles = sampleParticles(image, { columns: 8, minParticles: 0 });

    expect(particles.length).toBe(16);
    for (const particle of particles) {
      expect(particle.homeX).toBeGreaterThan(0.2);
      expect(particle.homeX).toBeLessThan(0.8);
      expect(particle.homeY).toBeGreaterThan(0.2);
      expect(particle.homeY).toBeLessThan(0.8);
    }
  });

  it("keeps particle colors from the source pixels", () => {
    const image = makeImage(40, 40, () => [255, 0, 0, 255]);

    const particles = sampleParticles(image, { columns: 4, minParticles: 0 });

    expect(particles.length).toBe(16);
    for (const particle of particles) {
      expect(particle.color).toBe("rgb(255, 0, 0)");
    }
  });

  it("caps the particle count by keeping the brightest cells", () => {
    // 上半亮白、下半暗灰：裁剪后应只剩上半的格子
    const image = makeImage(100, 100, (x, y) =>
      y < 50 ? WHITE : [70, 70, 70, 255],
    );

    const particles = sampleParticles(image, {
      columns: 10,
      maxParticles: 50,
      minParticles: 0,
    });

    expect(particles.length).toBe(50);
    for (const particle of particles) {
      expect(particle.homeY).toBeLessThan(0.5);
    }
  });

  it("backfills dim cells to reach the minimum, but never lightless ones", () => {
    // 全图亮度低于默认阈值，但仍有微光：minParticles 应回填这些格子
    const image = makeImage(60, 60, (x) =>
      x < 30 ? [16, 16, 16, 255] : [0, 0, 0, 255],
    );

    const particles = sampleParticles(image, { columns: 6, minParticles: 12 });

    expect(particles.length).toBe(12);
    for (const particle of particles) {
      expect(particle.homeX).toBeLessThan(0.5);
    }
  });

  it("maps home coordinates into the unit square with aspect-aware rows", () => {
    const image = makeImage(200, 100, () => WHITE);

    const particles = sampleParticles(image, { columns: 20, minParticles: 0 });

    // 200x100 配 20 列 → 10 行网格
    expect(particles.length).toBe(200);
    for (const particle of particles) {
      expect(particle.homeX).toBeGreaterThanOrEqual(0);
      expect(particle.homeX).toBeLessThanOrEqual(1);
      expect(particle.homeY).toBeGreaterThanOrEqual(0);
      expect(particle.homeY).toBeLessThanOrEqual(1);
    }
    const uniqueRows = new Set(particles.map((particle) => particle.homeY));
    expect(uniqueRows.size).toBe(10);
  });

  it("gives brighter cells larger sizes", () => {
    const image = makeImage(80, 40, (x) =>
      x < 40 ? WHITE : [90, 90, 90, 255],
    );

    const particles = sampleParticles(image, { columns: 8, minParticles: 0 });
    const bright = particles.filter((particle) => particle.homeX < 0.5);
    const dim = particles.filter((particle) => particle.homeX >= 0.5);

    expect(bright.length).toBeGreaterThan(0);
    expect(dim.length).toBeGreaterThan(0);
    expect(Math.min(...bright.map((particle) => particle.size))).toBeGreaterThan(
      Math.max(...dim.map((particle) => particle.size)),
    );
  });

  it("treats transparent pixels as lightless", () => {
    const image = makeImage(40, 40, (x) =>
      x < 20 ? WHITE : [255, 255, 255, 0],
    );

    const particles = sampleParticles(image, { columns: 4, minParticles: 0 });

    expect(particles.length).toBe(8);
    for (const particle of particles) {
      expect(particle.homeX).toBeLessThan(0.5);
    }
  });
});
