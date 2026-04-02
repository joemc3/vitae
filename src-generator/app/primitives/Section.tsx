import React from 'react';

interface SectionProps {
  id: string;
  title: string;
  data: unknown[] | unknown | null | undefined;
  className?: string;
  containerClassName?: string;
  titleClassName?: string;
  children: React.ReactNode;
}

function isEmpty(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  return false;
}

export function Section({ id, title, data, className, containerClassName, titleClassName, children }: SectionProps) {
  if (isEmpty(data)) return null;

  return (
    <section id={id} className={className}>
      <div className={containerClassName}>
        <h2 className={titleClassName}>{title}</h2>
        {children}
      </div>
    </section>
  );
}
