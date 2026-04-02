import React from 'react';

interface ConditionalRenderProps {
  data: unknown;
  children: React.ReactNode;
}

export function ConditionalRender({ data, children }: ConditionalRenderProps) {
  if (data === null || data === undefined || data === '') return null;
  if (Array.isArray(data) && data.length === 0) return null;
  return <>{children}</>;
}
