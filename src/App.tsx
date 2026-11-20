import cs from './i18n/cs.json';
import { platform } from './services/platform';

export function App() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <h1 className="text-3xl font-bold tracking-tight text-white">
        {cs.app.name}
      </h1>
      <p className="mt-2 text-neutral-400">{cs.app.subtitle}</p>
      <span className="mt-6 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-sm text-neutral-300">
        {platform.canScrape ? cs.app.platformMobile : cs.app.platformWeb}
      </span>
    </main>
  );
}
