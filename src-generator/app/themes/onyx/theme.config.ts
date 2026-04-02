import type { ThemeConfig } from '../../types/theme-config';

const config: ThemeConfig = {
  slug: 'onyx',
  name: 'Onyx',
  description: 'Dark, technical, sharp edges',
  audience: 'Developers, engineers',
  fonts: {
    heading: 'JetBrains Mono',
    body: 'Inter',
  },
  colors: {
    primary: '#0a0a0a',
    accent: '#7c8aff',
    background: '#0a0a0a',
    surface: '#1a1a1a',
    text: '#e0e0e0',
  },
  supports: {
    portfolio: true,
    targeted: true,
  },
};

export default config;
