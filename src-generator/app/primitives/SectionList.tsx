import React from 'react';

interface SectionListProps<T> {
  items: T[] | null | undefined;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function SectionList<T>({ items, renderItem, className }: SectionListProps<T>) {
  if (!items || items.length === 0) return null;

  return (
    <div className={className}>
      {items.map((item, index) => renderItem(item, index))}
    </div>
  );
}
