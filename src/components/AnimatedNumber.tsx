"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AnimatedNumberProps = {
  className?: string;
  duration?: number;
  formatOptions?: Intl.NumberFormatOptions;
  suffix?: string;
  value: number;
};

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

export function AnimatedNumber({
  className,
  duration = 650,
  formatOptions,
  suffix = "",
  value,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const currentValueRef = useRef(value);
  const frameRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const formatter = useMemo(
    () => new Intl.NumberFormat(undefined, formatOptions),
    [formatOptions],
  );

  useEffect(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      currentValueRef.current = value;
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || duration <= 0) {
      currentValueRef.current = value;
      frameRef.current = window.requestAnimationFrame(() => {
        setDisplayValue(value);
      });

      return () => {
        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current);
        }
      };
    }

    const startValue = currentValueRef.current;
    const change = value - startValue;
    const startedAt = performance.now();

    const tick = (timestamp: number) => {
      const progress = Math.min((timestamp - startedAt) / duration, 1);
      const nextValue = startValue + change * easeOutCubic(progress);

      currentValueRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      currentValueRef.current = value;
      setDisplayValue(value);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [duration, value]);

  return (
    <span className={className}>
      {formatter.format(Math.round(displayValue))}
      {suffix}
    </span>
  );
}
