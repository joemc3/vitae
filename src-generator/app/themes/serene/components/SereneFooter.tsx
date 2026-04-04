import React from 'react';

interface SereneFooterProps {
  fullName: string;
}

export function SereneFooter({ fullName }: SereneFooterProps) {
  return (
    <footer className="py-12">
      <div className="max-w-3xl mx-auto px-6 text-center text-[var(--serene-text-muted)] text-sm">
        <p>&copy; {new Date().getFullYear()} {fullName}</p>
      </div>
    </footer>
  );
}
