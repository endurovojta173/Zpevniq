import { OnlineSearchPanel } from './components/OnlineSearchPanel';
import { WebImportFallback } from './components/WebImportFallback';
import cs from './i18n/cs.json';
import { platform } from './services/platform';

export function App() {
  return (
    <main
      className="flex min-h-screen flex-col items-center px-4 py-6 sm:px-6"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
      }}
    >
      <header className="mb-6 flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{cs.app.name}</h1>
          <p className="text-xs text-neutral-400">{cs.app.subtitle}</p>
        </div>
        <span className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-300">
          {platform.canScrape ? cs.app.platformMobile : cs.app.platformWeb}
        </span>
      </header>

      {platform.canScrape ? <OnlineSearchPanel /> : <WebImportFallback />}
    </main>
  );
}
