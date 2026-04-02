import React from 'react';
import { LanguageSkill } from '../types/portfolio';

interface LanguageItemProps {
  lang: LanguageSkill;
  className?: string;
  nameClassName?: string;
  proficiencyClassName?: string;
}

export function LanguageItem({ lang, className, nameClassName, proficiencyClassName }: LanguageItemProps) {
  return (
    <span className={className}>
      <span className={nameClassName}>{lang.language}</span>
      {lang.proficiency && <span className={proficiencyClassName}>{lang.proficiency}</span>}
    </span>
  );
}
