import { getAvatarGradient } from "@/lib/avatar";

type AccountAvatarProps = { address: string; size?: number };

export function AccountAvatar({ address, size = 40 }: AccountAvatarProps) {
  const { color1, color2 } = getAvatarGradient(address);
  const gradientId = `avatar-${address.slice(2, 10)}`;

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${gradientId})`} />
    </svg>
  );
}
