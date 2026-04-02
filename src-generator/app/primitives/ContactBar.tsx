import React from 'react';
import { Contact } from '../types/portfolio';
import { ExternalLink } from './ExternalLink';

interface ContactBarProps {
  contact: Contact;
  className?: string;
  linkClassName?: string;
}

export function ContactBar({ contact, className, linkClassName }: ContactBarProps) {
  const hasContent = contact.email || contact.phone || contact.website ||
    (contact.socialLinks && contact.socialLinks.length > 0);

  if (!hasContent) return null;

  return (
    <div className={className}>
      {contact.email && (
        <a href={`mailto:${contact.email}`} className={linkClassName}>
          {contact.email}
        </a>
      )}
      {contact.phone && (
        <a href={`tel:${contact.phone}`} className={linkClassName}>
          {contact.phone}
        </a>
      )}
      {contact.website && (
        <ExternalLink href={contact.website} className={linkClassName}>
          {contact.website}
        </ExternalLink>
      )}
      {contact.socialLinks?.map((link, idx) => (
        <ExternalLink key={idx} href={link.url} className={linkClassName}>
          {link.platform}
        </ExternalLink>
      ))}
    </div>
  );
}
