/** Country flag image (emoji flags render as letters like "GB" on Windows). */
export function LocFlag({
  iso2,
  className = "loc-flag-img",
}: {
  iso2: string;
  className?: string;
}) {
  return (
    <img
      className={className}
      src={`/flags/${iso2}.png`}
      alt=""
      width={18}
      height={12}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}
