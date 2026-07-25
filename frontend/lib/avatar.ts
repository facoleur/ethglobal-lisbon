export function getAvatarGradient(address: string): {
  color1: string;
  color2: string;
} {
  const hex = address.replace(/^0x/i, "").padEnd(8, "0");
  const h1 = parseInt(hex.slice(0, 4), 16) % 360;
  const h2 = (h1 + 60 + (parseInt(hex.slice(4, 8), 16) % 60)) % 360;
  return {
    color1: `hsl(${h1} 70% 60%)`,
    color2: `hsl(${h2} 80% 55%)`,
  };
}
