import QRCode from "qrcode";

export type QRMatrix = {
  modules: boolean[][];
  size: number;
};

export async function generateQRMatrix(
  data: string,
  errorCorrectionLevel: "L" | "M" | "Q" | "H" = "M",
): Promise<QRMatrix> {
  const qr = await QRCode.create(data, { errorCorrectionLevel });
  const size = qr.modules.size;
  const modules: boolean[][] = [];

  for (let row = 0; row < size; row++) {
    modules[row] = [];
    for (let col = 0; col < size; col++) {
      modules[row][col] = qr.modules.get(row, col) === 1;
    }
  }

  return { modules, size };
}

function isEyeCell(row: number, col: number, size: number): boolean {
  if (row < 7 && col < 7) return true;
  if (row < 7 && col >= size - 7) return true;
  if (row >= size - 7 && col < 7) return true;
  return false;
}

function isInnerEyeCell(row: number, col: number, size: number): boolean {
  if (row >= 2 && row <= 4 && col >= 2 && col <= 4) return true;
  if (row >= 2 && row <= 4 && col >= size - 5 && col <= size - 3) return true;
  if (row >= size - 5 && row <= size - 3 && col >= 2 && col <= 4) return true;
  return false;
}

function circleToPath(cx: number, cy: number, r: number): string {
  return `M${cx - r},${cy}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 -${r * 2},0`;
}

function roundedRectToPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0,1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0,1 -${r},${r}h-${w - 2 * r}a${r},${r} 0 0,1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0,1 ${r},-${r}z`;
}

type GenerateSvgOptions = {
  size: number;
  color: string;
  backgroundColor: string;
  outerEyeColor: string;
  innerEyeColor: string;
  outerEyeBorderRadius: number;
  innerEyeBorderRadius: number;
};

export function generateQRCodeSvgContent(
  matrix: QRMatrix,
  options: GenerateSvgOptions,
): string {
  const {
    size,
    color,
    backgroundColor,
    outerEyeColor,
    innerEyeColor,
    outerEyeBorderRadius,
    innerEyeBorderRadius,
  } = options;

  const moduleCount = matrix.size;
  const cellSize = size / moduleCount;
  const elements: string[] = [];

  elements.push(
    `<rect width="${size}" height="${size}" fill="${backgroundColor}"/>`,
  );

  const circlePathParts: string[] = [];
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (isEyeCell(row, col, moduleCount)) continue;

      if (matrix.modules[row][col]) {
        const cx = (col + 0.5) * cellSize;
        const cy = (row + 0.5) * cellSize;
        const r = (cellSize / 2) * 0.95;
        circlePathParts.push(circleToPath(cx, cy, r));
      }
    }
  }

  if (circlePathParts.length > 0) {
    elements.push(
      `<path d="${circlePathParts.join("")}" fill="${color}"/>`,
    );
  }

  const eyePositions = [
    { row: 0, col: 0 },
    { row: 0, col: moduleCount - 7 },
    { row: moduleCount - 7, col: 0 },
  ];

  const outerEyePaths: string[] = [];
  const innerHolePaths: string[] = [];
  const innerSquarePaths: string[] = [];

  for (const eye of eyePositions) {
    const x = eye.col * cellSize;
    const y = eye.row * cellSize;
    const eyeSize = 7 * cellSize;
    const borderWidth = cellSize;

    outerEyePaths.push(
      roundedRectToPath(x, y, eyeSize, eyeSize, outerEyeBorderRadius),
    );

    innerHolePaths.push(
      roundedRectToPath(
        x + borderWidth,
        y + borderWidth,
        eyeSize - 2 * borderWidth,
        eyeSize - 2 * borderWidth,
        outerEyeBorderRadius * 0.6,
      ),
    );

    const innerX = (eye.col + 2) * cellSize;
    const innerY = (eye.row + 2) * cellSize;
    const innerSize = 3 * cellSize;
    innerSquarePaths.push(
      roundedRectToPath(innerX, innerY, innerSize, innerSize, innerEyeBorderRadius),
    );
  }

  elements.push(
    `<path d="${outerEyePaths.join("")}" fill="${outerEyeColor}"/>`,
  );
  elements.push(
    `<path d="${innerHolePaths.join("")}" fill="${backgroundColor}"/>`,
  );
  elements.push(
    `<path d="${innerSquarePaths.join("")}" fill="${innerEyeColor}"/>`,
  );

  return elements.join("");
}

export async function generateStyledQRCodeSvg(
  data: string,
  options: Partial<GenerateSvgOptions> & { size: number },
): Promise<string> {
  const matrix = await generateQRMatrix(data, "M");

  const fullOptions: GenerateSvgOptions = {
    size: options.size,
    color: options.color ?? "#000000",
    backgroundColor: options.backgroundColor ?? "#FFFFFF",
    outerEyeColor: options.outerEyeColor ?? options.color ?? "#000000",
    innerEyeColor: options.innerEyeColor ?? options.color ?? "#000000",
    outerEyeBorderRadius: options.outerEyeBorderRadius ?? 0,
    innerEyeBorderRadius: options.innerEyeBorderRadius ?? 0,
  };

  const content = generateQRCodeSvgContent(matrix, fullOptions);

  return `<svg viewBox="0 0 ${options.size} ${options.size}" xmlns="http://www.w3.org/2000/svg">
${content}
</svg>`;
}