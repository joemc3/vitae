import React from 'react';
import { Award } from '../types/portfolio';

interface AwardItemProps {
  award: Award;
  className?: string;
  titleClassName?: string;
  detailClassName?: string;
}

export function AwardItem({ award, className, titleClassName, detailClassName }: AwardItemProps) {
  return (
    <div className={className}>
      <h3 className={titleClassName}>{award.title}</h3>
      {award.issuer && <span className={detailClassName}>{award.issuer}</span>}
      {award.date && <span className={detailClassName}>{award.date}</span>}
      {award.description && <p>{award.description}</p>}
    </div>
  );
}
