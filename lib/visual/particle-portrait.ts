export type PortraitParticle = {
  /** 0–1，相对图片平面的归一化坐标 */
  homeX: number;
  homeY: number;
  /** CSS 颜色，取自照片对应区域的平均色 */
  color: string;
  /** 0–1 相对尺寸，由渲染层乘以格子像素尺寸 */
  size: number;
  /** 0–1 亮度，渲染层可用于透明度和发光强度 */
  luminance: number;
};

export type PortraitImageSource = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type SampleParticlesOptions = {
  /** 网格列数；行数按图片纵横比推导 */
  columns: number;
  /** 低于该亮度的格子不出粒子（0–1） */
  minLuminance?: number;
  maxParticles?: number;
  /** 阈值筛选后不足此数时，从更暗（但非全黑）的格子回填 */
  minParticles?: number;
};

const DEFAULT_MIN_LUMINANCE = 0.09;
const DEFAULT_MAX_PARTICLES = 6_000;
const DEFAULT_MIN_PARTICLES = 3_000;
const MINIMUM_SIZE = 0.35;

type CellSample = PortraitParticle & { qualified: boolean };

export function sampleParticles(
  image: PortraitImageSource,
  options: SampleParticlesOptions,
): PortraitParticle[] {
  const columns = Math.max(1, Math.floor(options.columns));
  const minLuminance = options.minLuminance ?? DEFAULT_MIN_LUMINANCE;
  const maxParticles = options.maxParticles ?? DEFAULT_MAX_PARTICLES;
  const minParticles = options.minParticles ?? DEFAULT_MIN_PARTICLES;

  const cellSize = image.width / columns;
  const rows = Math.max(1, Math.round(image.height / cellSize));
  const cells: CellSample[] = [];

  for (let row = 0; row < rows; row += 1) {
    const yStart = Math.floor((row / rows) * image.height);
    const yEnd = Math.max(yStart + 1, Math.floor(((row + 1) / rows) * image.height));

    for (let column = 0; column < columns; column += 1) {
      const xStart = Math.floor((column / columns) * image.width);
      const xEnd = Math.max(xStart + 1, Math.floor(((column + 1) / columns) * image.width));

      let redSum = 0;
      let greenSum = 0;
      let blueSum = 0;
      let alphaSum = 0;
      let pixelCount = 0;

      for (let y = yStart; y < yEnd; y += 1) {
        for (let x = xStart; x < xEnd; x += 1) {
          const offset = (y * image.width + x) * 4;
          redSum += image.data[offset];
          greenSum += image.data[offset + 1];
          blueSum += image.data[offset + 2];
          alphaSum += image.data[offset + 3];
          pixelCount += 1;
        }
      }

      const red = Math.round(redSum / pixelCount);
      const green = Math.round(greenSum / pixelCount);
      const blue = Math.round(blueSum / pixelCount);
      const alphaFactor = alphaSum / pixelCount / 255;
      const luminance =
        ((0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255) * alphaFactor;

      if (luminance <= 0) continue;

      cells.push({
        homeX: (column + 0.5) / columns,
        homeY: (row + 0.5) / rows,
        color: `rgb(${red}, ${green}, ${blue})`,
        size: MINIMUM_SIZE + luminance * (1 - MINIMUM_SIZE),
        luminance,
        qualified: luminance >= minLuminance,
      });
    }
  }

  const qualified = cells.filter((cell) => cell.qualified);

  let selected: CellSample[];
  if (qualified.length > maxParticles) {
    selected = [...qualified]
      .sort((left, right) => right.luminance - left.luminance)
      .slice(0, maxParticles);
  } else if (qualified.length < minParticles) {
    const backfill = cells
      .filter((cell) => !cell.qualified)
      .sort((left, right) => right.luminance - left.luminance)
      .slice(0, minParticles - qualified.length);
    selected = [...qualified, ...backfill];
  } else {
    selected = qualified;
  }

  return selected.map((cell) => ({
    homeX: cell.homeX,
    homeY: cell.homeY,
    color: cell.color,
    size: cell.size,
    luminance: cell.luminance,
  }));
}
