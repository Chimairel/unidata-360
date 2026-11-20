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
        <>
          <rect x="30" y="28" width="40" height="140" />
          <rect x="90" y="46" width="40" height="122" />
          <path d="M146 40 L184.6 29.6 L221.7 168 H180.3 Z" />
          <rect x="18" y="192" width="220" height="36" />
        </>
      ) : (
        <>
          <rect x="38" y="34" width="36" height="140" />
          <rect x="92" y="52" width="36" height="122" />
          <path d="M146.5 46 L181.3 36.7 L218.1 174 H180.8 Z" />
          <rect x="24" y="194" width="208" height="30" />
        </>
      )}
    </svg>
  );
}
