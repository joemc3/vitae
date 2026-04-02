import React from 'react';

interface DateRangeProps {
  startDate?: string;
  endDate?: string;
  className?: string;
}

function formatDate(date: string): string {
  if (date.toLowerCase() === 'present') return 'Present';

  const parts = date.split('-');
  if (parts.length === 1) return parts[0]; // Year only

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month] = parts;
  const monthIndex = parseInt(month, 10) - 1;
  if (monthIndex >= 0 && monthIndex < 12) {
    return `${monthNames[monthIndex]} ${year}`;
  }
  return year;
}

export function DateRange({ startDate, endDate, className }: DateRangeProps) {
  if (!startDate && !endDate) return null;

  if (!startDate && endDate) {
    const parts = endDate.split('-');
    return <span className={className}>{parts[0]}</span>;
  }

  const start = startDate ? formatDate(startDate) : '';
  const end = endDate ? formatDate(endDate) : '';

  return (
    <span className={className}>
      {start}{start && end ? ' \u2013 ' : ''}{end}
    </span>
  );
}
