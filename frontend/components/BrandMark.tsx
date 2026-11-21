export function BrandMark({
  size = 24,
  compact = false,
  className,
}: {
  size?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      {compact ? (
        <path d="M28 64 L70 22 H114 V86 L178 22 H228 V70 L170 128 L228 186 V234 H178 L114 170 V234 H70 L28 192 Z" />
      ) : (
        <path d="M36 68 L76 28 H118 V88 L178 28 H220 V74 L166 128 L220 182 V228 H178 L118 168 V228 H76 L36 188 Z" />
      )}
    </svg>
  );
}
