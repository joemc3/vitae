import { PortfolioData } from '../types/portfolio';
import fs from 'fs';
import path from 'path';

/**
 * Load portfolio data written by generate.js.
 * Reads from .data/portfolio-data.json (written before next build).
 */
export function loadPortfolioData(): PortfolioData {
  const dataPath = path.join(process.cwd(), '.data', 'portfolio-data.json');

  try {
    const fileContents = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(fileContents) as PortfolioData;
  } catch (error) {
    console.error('Error loading portfolio data:', error);
    return getDefaultPortfolioData();
  }
}

/**
 * Returns default/sample portfolio data for development and testing.
 */
export function getDefaultPortfolioData(): PortfolioData {
  return {
    profile: {
      fullName: 'Sample Portfolio',
      title: 'Professional Developer',
      summary: 'This is a sample portfolio. Please generate your own portfolio data.',
    },
    contact: {
      email: 'contact@example.com',
      socialLinks: [],
    },
    workExperience: [],
    projects: [],
    education: [],
    skills: [],
    certifications: [],
    publications: [],
    awards: [],
    volunteer: [],
    languages: [],
    theme: {
      name: 'onyx',
    },
    siteType: 'portfolio',
  };
}
