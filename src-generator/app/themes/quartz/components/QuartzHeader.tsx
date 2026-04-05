import React from 'react';
import { Profile, JobPosting } from '@/types/portfolio';
import { PhotoFrame } from '@/primitives';

interface QuartzHeaderProps {
  profile: Profile;
  jobPosting?: JobPosting;
  hasResume?: boolean;
}

export function QuartzHeader({ profile, jobPosting, hasResume }: QuartzHeaderProps) {
  return (
    <header className="bg-[var(--quartz-navy)] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center gap-6">
          <PhotoFrame
            src={profile.photo}
            alt={profile.fullName}
            shape="square"
            size="w-20 h-20"
            className="rounded-lg"
          />
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold">
              {profile.fullName}
            </h1>
            <p className="text-lg text-blue-300 mt-1">{profile.title}</p>
            {jobPosting && (
              <p className="text-sm text-blue-200/80 mt-1">
                {jobPosting.title} at {jobPosting.company}
              </p>
            )}
          </div>
        </div>
        {profile.summary && (
          <p className="text-white/80 mt-6 max-w-3xl leading-relaxed">
            {profile.summary}
          </p>
        )}
        {hasResume && (
          <div className="mt-5">
            <a
              href="resume.pdf"
              download
              className="inline-block bg-[var(--quartz-primary)] text-white font-semibold px-6 py-2 rounded hover:bg-[var(--quartz-primary-light)] transition-colors text-sm"
            >
              Download Resume
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
