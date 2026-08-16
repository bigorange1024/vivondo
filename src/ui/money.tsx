/** Virtual currency mark: G with two bars (like $). */

export function Money({
  amount,
  className,
}: {
  amount: number | string;
  className?: string;
}) {
  return (
    <span className={`money${className ? ` ${className}` : ""}`}>
      <span className="money-g" aria-hidden="true">
        G
      </span>
      <span className="money-n">{amount}</span>
    </span>
  );
}
