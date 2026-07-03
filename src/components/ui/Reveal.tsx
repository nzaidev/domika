'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

type RevealProps = {
  delay?: number;
  children: ReactNode;
  as?: ElementType;
  className?: string;
  onClick?: () => void;
};

export function Reveal({ delay, children, as: Tag = "div", ...rest }: RevealProps) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          el.classList.add('is-visible');
          io.unobserve(el);
        }
      });
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={'reveal' + (delay ? ` reveal--delay-${delay}` : '')} {...rest}>{children}</Tag>;

}
