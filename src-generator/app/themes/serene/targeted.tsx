import React from 'react';
import { PortfolioData } from '@/types/portfolio';
import { Section, SectionList, ContactBar, TimelineEntry, ProjectCard, SkillGroup, CertificationItem, LanguageItem } from '@/primitives';
import { PhotoFrame } from '@/primitives';
import { SereneFooter } from './components/SereneFooter';
import './styles/theme.css';

interface SereneTargetedProps {
  data: PortfolioData;
}

export default function SereneTargeted({ data }: SereneTargetedProps) {
  return (
    <div className="serene-theme min-h-screen bg-[var(--serene-bg)] text-[var(--serene-text)] font-body">
      <header className="pt-16 pb-12">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex items-center gap-6">
            <PhotoFrame
              src={data.profile.photo}
              alt={data.profile.fullName}
              shape="circle"
              size="w-16 h-16"
            />
            <div>
              <h1 className="text-3xl font-heading font-semibold text-[var(--serene-text)] tracking-tight">
                {data.profile.fullName}
              </h1>
              <p className="text-[var(--serene-text-muted)] mt-1">{data.profile.title}</p>
              {data.jobPosting && (
                <p className="text-sm text-[var(--serene-accent)] mt-1">
                  Prepared for {data.jobPosting.company} &mdash; {data.jobPosting.title}
                </p>
              )}
            </div>
          </div>
          {data.profile.summary && (
            <p className="text-[var(--serene-text)] mt-8 leading-relaxed">
              {data.profile.summary}
            </p>
          )}
        </div>
      </header>

      <hr className="divider max-w-3xl mx-auto" />

      <main>
        <Section id="experience" title="Experience" data={data.workExperience} containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.workExperience}
            className="space-y-8"
            renderItem={(exp, idx) => (
              <TimelineEntry
                key={idx}
                title={exp.title}
                subtitle={exp.company}
                startDate={exp.startDate}
                endDate={exp.endDate}
                highlights={exp.responsibilities}
                titleClassName="text-lg font-heading font-semibold text-[var(--serene-text)] mb-1"
                subtitleClassName="text-[var(--serene-text-muted)]"
                dateClassName="text-[var(--serene-text-muted)] text-sm"
                highlightClassName="flex items-start text-[var(--serene-text)] leading-relaxed"
                highlightBullet={<span className="text-[var(--serene-accent)] mr-3 mt-1">&mdash;</span>}
              />
            )}
          />
        </Section>

        <hr className="divider max-w-3xl mx-auto" />

        <Section id="skills" title="Skills" data={data.skills} containerClassName="section-container" titleClassName="section-title">
          <div className="space-y-4">
            {data.skills.map((skill, idx) => (
              <SkillGroup
                key={idx}
                skill={skill}
                className="flex flex-wrap items-baseline gap-x-1"
                categoryClassName="text-sm font-semibold text-[var(--serene-text)] uppercase tracking-wider mr-3"
                itemClassName="text-[var(--serene-text-muted)] text-sm after:content-[',_'] last:after:content-['']"
              />
            ))}
          </div>
        </Section>

        <hr className="divider max-w-3xl mx-auto" />

        <Section id="projects" title="Projects" data={data.projects} containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.projects}
            className="space-y-6"
            renderItem={(project, idx) => (
              <ProjectCard
                key={idx}
                project={project}
                nameClassName="text-lg font-heading font-semibold text-[var(--serene-text)] mb-1"
                techClassName="text-xs text-[var(--serene-text-muted)] bg-[var(--serene-border)] px-2 py-0.5 rounded mr-1.5 mb-1 inline-block"
                linkClassName="text-[var(--serene-text-muted)] hover:text-[var(--serene-text)] underline text-sm transition-colors"
              />
            )}
          />
        </Section>

        <hr className="divider max-w-3xl mx-auto" />

        <Section id="education" title="Education" data={data.education} containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.education}
            className="space-y-6"
            renderItem={(edu, idx) => (
              <TimelineEntry
                key={idx}
                title={edu.institution}
                subtitle={`${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}`}
                endDate={edu.endDate}
                titleClassName="text-lg font-heading font-semibold text-[var(--serene-text)] mb-1"
                subtitleClassName="text-[var(--serene-text-muted)]"
                dateClassName="text-[var(--serene-text-muted)] text-sm"
              />
            )}
          />
        </Section>

        <hr className="divider max-w-3xl mx-auto" />

        <Section id="certifications" title="Certifications" data={data.certifications} containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.certifications}
            className="space-y-3"
            renderItem={(cert, idx) => (
              <CertificationItem
                key={idx}
                cert={cert}
                nameClassName="font-heading font-semibold text-[var(--serene-text)]"
                detailClassName="text-[var(--serene-text-muted)] text-sm ml-2"
              />
            )}
          />
        </Section>

        <hr className="divider max-w-3xl mx-auto" />

        <Section id="languages" title="Languages" data={data.languages} containerClassName="section-container" titleClassName="section-title">
          <div className="flex flex-wrap gap-6">
            {data.languages.map((lang, idx) => (
              <LanguageItem
                key={idx}
                lang={lang}
                className="flex items-baseline gap-2"
                nameClassName="text-[var(--serene-text)] font-semibold"
                proficiencyClassName="text-[var(--serene-text-muted)] text-sm"
              />
            ))}
          </div>
        </Section>

        <hr className="divider max-w-3xl mx-auto" />

        <section>
          <div className="max-w-3xl mx-auto px-6 py-12">
            <ContactBar
              contact={data.contact}
              className="flex flex-wrap gap-6"
              linkClassName="text-[var(--serene-text-muted)] hover:text-[var(--serene-text)] transition-colors text-sm"
            />
          </div>
        </section>
      </main>

      <SereneFooter fullName={data.profile.fullName} />
    </div>
  );
}
