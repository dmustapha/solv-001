"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useInView — fires once when the element enters the viewport.
 * Returns [ref, hasEntered].
 */
export function useInView<T extends Element>(
  options: IntersectionObserverInit = { threshold: 0.15 },
): [React.RefCallback<T>, boolean] {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: T | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observerRef.current?.disconnect();
        }
      }, options);

      observerRef.current.observe(node);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.threshold],
  );

  return [ref, inView];
}

/**
 * useCountUp — counts from 0 to `target` over `duration` ms.
 * Starts when `start` is true. Uses ease-out cubic.
 */
export function useCountUp(
  target: number,
  duration = 1400,
  start = true,
  decimals = 0,
): string {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [start, target, duration]);

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
