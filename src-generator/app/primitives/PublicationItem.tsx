import React from 'react';
import { Publication } from '../types/portfolio';
import { ExternalLink } from './ExternalLink';

interface PublicationItemProps {
  pub: Publication;
  className?: string;
  titleClassName?: string;
  detailClassName?: string;
  linkClassName?: string;
}

export function PublicationItem({ pub, className, titleClassName, detailClassName, linkClassName }: PublicationItemProps) {
  const title = pub.url ? (
    <ExternalLink href={pub.url} className={linkClassName}>{pub.title}</ExternalLink>
  ) : (
    <span className={titleClassName}>{pub.title}</span>
  );

  return (
    <div className={className}>
      {title}
      {pub.venue && <span className={detailClassName}>{pub.venue}</span>}
      {pub.date && <span className={detailClassName}>{pub.date}</span>}
    </div>
  );
}
