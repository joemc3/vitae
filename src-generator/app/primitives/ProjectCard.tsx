import React from 'react';
import { Project } from '../types/portfolio';
import { ExternalLink } from './ExternalLink';

interface ProjectCardProps {
  project: Project;
  className?: string;
  nameClassName?: string;
  techClassName?: string;
  linkClassName?: string;
}

export function ProjectCard({ project, className, nameClassName, techClassName, linkClassName }: ProjectCardProps) {
  return (
    <div className={className}>
      <h3 className={nameClassName}>{project.name}</h3>
      {project.role && <p>{project.role}</p>}
      <p>{project.description}</p>
      {project.technologies && project.technologies.length > 0 && (
        <div>
          {project.technologies.map((tech, idx) => (
            <span key={idx} className={techClassName}>{tech}</span>
          ))}
        </div>
      )}
      {project.outcomes && project.outcomes.length > 0 && (
        <ul>
          {project.outcomes.map((outcome, idx) => (
            <li key={idx}>{outcome}</li>
          ))}
        </ul>
      )}
      {project.url && (
        <ExternalLink href={project.url} className={linkClassName}>
          View Project
        </ExternalLink>
      )}
    </div>
  );
}
