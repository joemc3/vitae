import React from 'react';
import { PortfolioData } from '@/types/portfolio';
import { Section, SectionList, ContactBar, TimelineEntry, ProjectCard, CertificationItem, LanguageItem } from '@/primitives';
import { PhotoFrame } from '@/primitives';
import { OnyxSkillGrid } from './components/OnyxSkillGrid';
import { OnyxFooter } from './components/OnyxFooter';
import './styles/theme.css';

interface OnyxTargetedProps {
  data: PortfolioData;
}

export default function OnyxTargeted({ data }: OnyxTargetedProps) {
  return (
    <div className="onyx-theme min-h-screen bg-[var(--onyx-950)] text-gray-100 font-body">
      {/* Targeted header — no full nav, focus on role match */}
      <header className="bg-[var(--onyx-900)] border-b border-[var(--onyx-700)]">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-center gap-8">
            <PhotoFrame
              src={data.profile.photo}
              alt={data.profile.fullName}
              shape="rounded"
              size="w-24 h-24"
            />
            <div>
              <h1 className="text-4xl font-heading font-bold text-white">
                {data.profile.fullName}
              </h1>
              {data.jobPosting && (
                <p className="text-xl text-[var(--accent-blue)] mt-1">
                  for {data.jobPosting.title} at {data.jobPosting.company}
                </p>
              )}
              <p className="text-gray-400 mt-2">{data.profile.title}</p>
            </div>
          </div>
          {data.profile.summary && (
            <p className="text-gray-300 mt-6 max-w-3xl leading-relaxed">
              {data.profile.summary}
            </p>
          )}
        </div>
      </header>

      <main>
        <Section id="skills" title="Skills" data={data.skills} className="bg-[var(--onyx-950)]" containerClassName="section-container" titleClassName="section-title">
          <OnyxSkillGrid skills={data.skills} />
        </Section>

        <Section id="experience" title="Experience" data={data.workExperience} className="bg-[var(--onyx-900)]" containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.workExperience}
            className="space-y-6"
            renderItem={(exp, idx) => (
              <TimelineEntry
                key={idx}
                title={exp.title}
                subtitle={exp.company}
                startDate={exp.startDate}
                endDate={exp.endDate}
                highlights={exp.responsibilities}
                className="card"
                titleClassName="text-xl font-bold text-white mb-1"
                subtitleClassName="text-lg text-[var(--accent-blue)]"
                dateClassName="text-gray-400 text-sm"
                highlightClassName="flex items-start text-gray-300"
                highlightBullet={<span className="text-[var(--accent-teal)] mr-2 mt-1">&#x25B9;</span>}
              />
            )}
          />
        </Section>

        <Section id="projects" title="Projects" data={data.projects} className="bg-[var(--onyx-950)]" containerClassName="section-container" titleClassName="section-title">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.projects.map((project, idx) => (
              <ProjectCard
                key={idx}
                project={project}
                className="card"
                nameClassName="text-lg font-bold text-white mb-2"
                techClassName="tech-tag"
                linkClassName="text-[var(--accent-blue)] hover:text-[var(--accent-teal)] transition-colors text-sm"
              />
            ))}
          </div>
        </Section>

        <Section id="education" title="Education" data={data.education} className="bg-[var(--onyx-900)]" containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.education}
            className="space-y-4"
            renderItem={(edu, idx) => (
              <TimelineEntry
                key={idx}
                title={edu.institution}
                subtitle={`${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}`}
                endDate={edu.endDate}
                className="card"
                titleClassName="text-lg font-bold text-white mb-1"
                subtitleClassName="text-[var(--accent-blue)]"
                dateClassName="text-gray-400 text-sm"
              />
            )}
          />
        </Section>

        <Section id="certifications" title="Certifications" data={data.certifications} className="bg-[var(--onyx-950)]" containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.certifications}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            renderItem={(cert, idx) => (
              <CertificationItem
                key={idx}
                cert={cert}
                className="card"
                nameClassName="text-white font-bold"
                detailClassName="text-gray-400 text-sm"
              />
            )}
          />
        </Section>

        <Section id="languages" title="Languages" data={data.languages} className="bg-[var(--onyx-900)]" containerClassName="section-container" titleClassName="section-title">
          <div className="flex flex-wrap gap-3">
            {data.languages.map((lang, idx) => (
              <LanguageItem
                key={idx}
                lang={lang}
                className="card flex items-center gap-2 px-4 py-2"
                nameClassName="text-white font-bold"
                proficiencyClassName="text-gray-400 text-sm"
              />
            ))}
          </div>
        </Section>

        <section className="bg-[var(--onyx-950)]">
          <div className="max-w-5xl mx-auto px-6 py-12 text-center">
            <ContactBar
              contact={data.contact}
              className="flex flex-wrap justify-center gap-6"
              linkClassName="text-[var(--accent-blue)] hover:text-[var(--accent-teal)] transition-colors"
            />
          </div>
        </section>
      </main>

      <OnyxFooter fullName={data.profile.fullName} />
    </div>
  );
}
