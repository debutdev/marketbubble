import type { ComponentProps } from "react";
import styles from "./Spinner.module.css";

type SpinnerProps = ComponentProps<"div"> & {
  disabled?: boolean;
  invert?: boolean;
  size?: number;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Spinner({
  className,
  disabled,
  invert,
  size = 16,
  style,
  ...props
}: SpinnerProps) {
  if (disabled) {
    return null;
  }

  const sizePx = `${size}px`;
  const barWidth = `${(size * 0.2).toFixed(2)}px`;
  const barHeight = `${(size * 0.075).toFixed(2)}px`;

  return (
    <div
      className={classNames(styles.spinner, className)}
      style={{ ...style, width: sizePx, height: sizePx }}
      {...props}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          className={styles.track}
          key={index}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div
            className={styles.bar}
            style={{
              backgroundColor: invert ? "var(--background)" : "var(--foreground)",
              borderRadius: "9999px",
              height: barHeight,
              width: barWidth,
            }}
          />
        </div>
      ))}
    </div>
  );
}
