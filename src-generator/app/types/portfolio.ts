/**
 * TypeScript types for portfolio data.
 * Aligned with JSON Resume schema. This is the contract between
 * the Python backend and the Next.js generator.
 */

export interface Profile {
  fullName: string;
  title: string;
  summary?: string;
  photo?: string;
  location?: string;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface Contact {
  email?: string;
  phone?: string;
  website?: string;
  socialLinks?: SocialLink[];
}

export interface WorkExperience {
  company: string;
  location?: string;
  title: string;
  startDate: string;
  endDate: string;
  responsibilities?: string[];
}

export interface Project {
  name: string;
  description: string;
  role?: string;
  technologies?: string[];
  outcomes?: string[];
  url?: string;
}

export interface Education {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate: string;
  notes?: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface Certification {
  name: string;
  issuer?: string;
  dateObtained?: string;
  expiration?: string;
  credentialId?: string;
}

export interface Publication {
  title: string;
  venue?: string;
  date?: string;
  url?: string;
}

export interface Award {
  title: string;
  issuer?: string;
  date?: string;
  description?: string;
}

export interface Volunteer {
  organization: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface LanguageSkill {
  language: string;
  proficiency?: string;
}

export interface Theme {
  name: string;
  layoutOptions?: Record<string, unknown>;
}

export interface JobPosting {
  company: string;
  title: string;
  description: string;
}

export interface PortfolioData {
  profile: Profile;
  contact: Contact;
  workExperience: WorkExperience[];
  projects: Project[];
  education: Education[];
  skills: SkillCategory[];
  certifications: Certification[];
  publications: Publication[];
  awards: Award[];
  volunteer: Volunteer[];
  languages: LanguageSkill[];
  theme: Theme;
  siteType: 'portfolio' | 'targeted';
  jobPosting?: JobPosting;
}
