'use client';

import { useEffect, useState } from 'react';
import { animate } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  format?: (value: number) => string;
  duration?: number;
}

export default function AnimatedNumber({ value, format = (v) => Math.round(v).toString(), duration = 1.2 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setDisplay });
    return () => controls.stop();
  }, [value, duration]);

  return <>{format(display)}</>;
}
