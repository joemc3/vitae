import React from 'react';
import { DateRange } from './DateRange';

interface TimelineEntryProps {
  title: string;
  subtitle: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  description?: string;
  highlights?: string[];
  notes?: string;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  dateClassName?: string;
  highlightClassName?: string;
  highlightBullet?: React.ReactNode;
}

export function TimelineEntry({
  title,
  subtitle,
  startDate,
  endDate,
  location,
  description,
  highlights,
  notes,
  className,
  titleClassName,
  subtitleClassName,
  dateClassName,
  highlightClassName,
  highlightBullet = '▹',
}: TimelineEntryProps) {
  return (
    <div className={className}>
      <div>
        <h3 className={titleClassName}>{title}</h3>
        <p className={subtitleClassName}>{subtitle}</p>
      </div>
      <div>
        <DateRange startDate={startDate} endDate={endDate} className={dateClassName} />
        {location && <p className={dateClassName}>{location}</p>}
      </div>
      {description && <p>{description}</p>}
      {highlights && highlights.length > 0 && (
        <ul>
          {highlights.map((item, idx) => (
            <li key={idx} className={highlightClassName}>
              {highlightBullet && <span>{highlightBullet}</span>}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {notes && <p>{notes}</p>}
    </div>
  );
}
