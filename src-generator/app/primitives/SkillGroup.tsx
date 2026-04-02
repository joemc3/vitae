import React from 'react';
import { SkillCategory } from '../types/portfolio';

interface SkillGroupProps {
  skill: SkillCategory;
  className?: string;
  categoryClassName?: string;
  itemClassName?: string;
}

export function SkillGroup({ skill, className, categoryClassName, itemClassName }: SkillGroupProps) {
  return (
    <div className={className}>
      <h3 className={categoryClassName}>{skill.category}</h3>
      <div>
        {skill.items.map((item, idx) => (
          <span key={idx} className={itemClassName}>{item}</span>
        ))}
      </div>
    </div>
  );
}
