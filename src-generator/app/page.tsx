import { loadPortfolioData } from './lib/loadPortfolioData';
import { jetbrainsMono, inter } from './themes/onyx/fonts';
import OnyxPortfolio from './themes/onyx/portfolio';
import OnyxTargeted from './themes/onyx/targeted';

export default function Home() {
  const data = loadPortfolioData();
  const themeName = data.theme.name.toLowerCase();
  const isTargeted = data.siteType === 'targeted';

  // Font classes — each theme applies its own font variables
  let fontClasses = '';

  switch (themeName) {
    case 'onyx':
    default:
      fontClasses = `${jetbrainsMono.variable} ${inter.variable}`;
      if (isTargeted) {
        return <div className={fontClasses}><OnyxTargeted data={data} /></div>;
      }
      return <div className={fontClasses}><OnyxPortfolio data={data} /></div>;
  }
}
