export interface ThemeConfig {
  slug: string;
  name: string;
  description: string;
  audience: string;
  fonts: {
    heading: string;
    body: string;
  };
  colors: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  supports: {
    portfolio: boolean;
    targeted: boolean;
  };
}
