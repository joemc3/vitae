import type { ThemeConfig } from '../../types/theme-config';

const config: ThemeConfig = {
  slug: 'serene',
  name: 'Serene',
  description: 'Clean, minimal, spacious',
  audience: 'Consultants, executives',
  fonts: {
    heading: 'Source Serif 4',
    body: 'Source Sans 3',
  },
  colors: {
    primary: '#2c3e50',
    accent: '#7f8c8d',
    background: '#fafbfc',
    surface: '#ffffff',
    text: '#2c3e50',
  },
  supports: {
    portfolio: true,
    targeted: true,
  },
};

export default config;
