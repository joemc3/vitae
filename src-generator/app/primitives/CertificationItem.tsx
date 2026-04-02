import React from 'react';
import { Certification } from '../types/portfolio';

interface CertificationItemProps {
  cert: Certification;
  className?: string;
  nameClassName?: string;
  detailClassName?: string;
}

export function CertificationItem({ cert, className, nameClassName, detailClassName }: CertificationItemProps) {
  return (
    <div className={className}>
      <h3 className={nameClassName}>{cert.name}</h3>
      {cert.issuer && <p className={detailClassName}>{cert.issuer}</p>}
      {cert.dateObtained && <p className={detailClassName}>Obtained: {cert.dateObtained}</p>}
      {cert.expiration && <p className={detailClassName}>Expires: {cert.expiration}</p>}
      {cert.credentialId && <p className={detailClassName}>ID: {cert.credentialId}</p>}
    </div>
  );
}
