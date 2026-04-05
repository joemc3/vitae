import React from 'react';
import { PortfolioData } from '@/types/portfolio';
import { Section, SectionList, ContactBar, TimelineEntry, ProjectCard, SkillGroup, CertificationItem, PublicationItem, AwardItem, LanguageItem } from '@/primitives';
import { PhotoFrame } from '@/primitives';
import { SereneFooter } from './components/SereneFooter';
import './styles/theme.css';

interface SerenePortfolioProps {
  data: PortfolioData;
}

export default function SerenePortfolio({ data }: SerenePortfolioProps) {
  return (
    <div className="serene-theme min-h-screen bg-[var(--serene-bg)] text-[var(--serene-text)] font-body">
      <header className="pt-16 pb-12">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex items-center gap-6">
            <PhotoFrame
              src={data.profile.photo}
              alt={data.profile.fullName}
              shape="circle"
              size="w-20 h-20"
            />
            <div>
              <h1 className="text-3xl md:text-4xl font-heading font-semibold text-[var(--serene-text)] tracking-tight">
                {data.profile.fullName}
              </h1>
              <p className="text-lg text-[var(--serene-text-muted)] mt-1">{data.profile.title}</p>
            </div>
          </div>
          {data.profile.summary && (
            <p className="text-[var(--serene-text)] mt-8 leading-relaxed text-lg">
              {data.profile.summary}
            </p>
          )}
          {data.hasResume && (
            <div className="mt-6">
              <a
                href="resume.pdf"
                download
                className="inline-block text-sm text-[var(--serene-text-muted)] hover:text-[var(--serene-text)] underline underline-offset-4 transition-colors"
              >
                Download Resume
              </a>
            </div>
          )}
        </div>
      </header>

      <hr className="divider max-w-3xl mx-auto" />

      <main>
        <Section id="experience" title="Experience" data={data.workExperience} containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.workExperience}
            className="space-y-10"
            renderItem={(exp, idx) => (
              <TimelineEntry
                key={idx}
                title={exp.title}
                subtitle={exp.company}
                startDate={exp.startDate}
                endDate={exp.endDate}
                location={exp.location}
                highlights={exp.responsibilities}
                titleClassName="text-xl font-heading font-semibold text-[var(--serene-text)] mb-1"
                subtitleClassName="text-lg text-[var(--serene-text-muted)]"
                dateClassName="text-[var(--serene-text-muted)] text-sm"
                highlightClassName="flex items-start text-[var(--serene-text)] leading-relaxed"
                highlightBullet={<span className="text-[var(--serene-accent)] mr-3 mt-1">&mdash;</span>}
              />
            )}
          />
        </Section>

        <hr className="divider max-w-3xl mx-auto" />

        <Section id="education" title="Education" data={data.education} containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.education}
            className="space-y-8"
            renderItem={(edu, idx) => (
              <TimelineEntry
                key={idx}
                title={edu.institution}
                subtitle={`${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}`}
                startDate={edu.startDate}
                endDate={edu.endDate}
                notes={edu.notes}
                titleClassName="text-xl font-heading font-semibold text-[var(--serene-text)] mb-1"
                subtitleClassName="text-lg text-[var(--serene-text-muted)]"
                dateClassName="text-[var(--serene-text-muted)] text-sm"
              />
            )}
          />
        </Section>

        <hr className="divider max-w-3xl mx-auto" />

        <Section id="skills" title="Skills" data={data.skills} containerClassName="section-container" titleClassName="section-title">
          <div className="space-y-6">
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
            className="space-y-8"
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

        <Section id="certifications" title="Certifications" data={data.certifications} containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.certifications}
            className="space-y-4"
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

        <Section id="publications" title="Publications" data={data.publications} containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.publications}
            className="space-y-4"
            renderItem={(pub, idx) => (
              <PublicationItem
                key={idx}
                pub={pub}
                className="flex flex-col gap-0.5"
                titleClassName="font-heading font-semibold text-[var(--serene-text)]"
                detailClassName="text-[var(--serene-text-muted)] text-sm"
                linkClassName="font-heading font-semibold text-[var(--serene-text)] hover:text-[var(--serene-text-muted)] underline"
              />
            )}
          />
        </Section>

        <hr className="divider max-w-3xl mx-auto" />

        <Section id="awards" title="Awards" data={data.awards} containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.awards}
            className="space-y-4"
            renderItem={(award, idx) => (
              <AwardItem
                key={idx}
                award={award}
                titleClassName="font-heading font-semibold text-[var(--serene-text)]"
                detailClassName="text-[var(--serene-text-muted)] text-sm ml-2"
              />
            )}
          />
        </Section>

        <hr className="divider max-w-3xl mx-auto" />

        <Section id="volunteer" title="Volunteer" data={data.volunteer} containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.volunteer}
            className="space-y-8"
            renderItem={(vol, idx) => (
              <TimelineEntry
                key={idx}
                title={vol.role || ''}
                subtitle={vol.organization}
                startDate={vol.startDate}
                endDate={vol.endDate}
                description={vol.description}
                titleClassName="text-lg font-heading font-semibold text-[var(--serene-text)] mb-1"
                subtitleClassName="text-[var(--serene-text-muted)]"
                dateClassName="text-[var(--serene-text-muted)] text-sm"
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

        <Section id="contact" title="Contact" data={data.contact} containerClassName="section-container" titleClassName="section-title">
          <ContactBar
            contact={data.contact}
            className="flex flex-col space-y-3"
            linkClassName="text-[var(--serene-text-muted)] hover:text-[var(--serene-text)] transition-colors"
          />
        </Section>
      </main>

      <SereneFooter fullName={data.profile.fullName} />
    </div>
  );
}
