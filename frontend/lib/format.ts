function getTextWidth(text: string, font: string): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
}

export function truncateMiddle(
  text: string,
  maxWidth: number,
  font: string,
): string {
  if (getTextWidth(text, font) <= maxWidth) return text;

  const ellipsis = "…";

  for (let total = text.length - 1; total >= 4; total--) {
    const startLen = Math.ceil(total / 2);
    const endLen = Math.floor(total / 2);
    const candidate =
      text.slice(0, startLen) + ellipsis + text.slice(text.length - endLen);
    if (getTextWidth(candidate, font) <= maxWidth) return candidate;
  }

  return text.slice(0, 2) + ellipsis;
}
