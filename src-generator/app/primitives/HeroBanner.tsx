import React from 'react';
import { Profile, Contact } from '../types/portfolio';
import { PhotoFrame } from './PhotoFrame';

interface HeroBannerProps {
  profile: Profile;
  contact?: Contact;
  photoShape?: 'circle' | 'square' | 'rounded';
  photoSize?: string;
  className?: string;
  nameClassName?: string;
  titleClassName?: string;
  summaryClassName?: string;
  children?: React.ReactNode;
}

export function HeroBanner({
  profile,
  contact,
  photoShape = 'rounded',
  photoSize = 'w-32 h-32',
  className,
  nameClassName,
  titleClassName,
  summaryClassName,
  children,
}: HeroBannerProps) {
  return (
    <div className={className}>
      <PhotoFrame
        src={profile.photo}
        alt={profile.fullName}
        shape={photoShape}
        size={photoSize}
      />
      <h1 className={nameClassName}>{profile.fullName}</h1>
      <p className={titleClassName}>{profile.title}</p>
      {profile.summary && (
        <p className={summaryClassName}>{profile.summary}</p>
      )}
      {children}
    </div>
  );
}
