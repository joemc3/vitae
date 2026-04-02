import React from 'react';

interface PhotoFrameProps {
  src?: string;
  alt: string;
  shape?: 'circle' | 'square' | 'rounded';
  size?: string;
  className?: string;
}

const shapeClasses: Record<string, string> = {
  circle: 'rounded-full',
  square: '',
  rounded: 'rounded-lg',
};

export function PhotoFrame({ src, alt, shape = 'rounded', size = 'w-32 h-32', className }: PhotoFrameProps) {
  if (!src) return null;

  return (
    <div className={`${size} overflow-hidden ${shapeClasses[shape]} ${className || ''}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
