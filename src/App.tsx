import { useState } from 'react';
import { OnlineSearchPanel } from './components/OnlineSearchPanel';
import { SavedSongsPanel } from './components/SavedSongsPanel';
import { WebImportFallback } from './components/WebImportFallback';
import { useSavedSongs } from './hooks/useSavedSongs';
import cs from './i18n/cs.json';
import { platform } from './services/platform';

type AppTab = 'library' | 'discover';

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('library');
  const {
    savedSongs,
    totalSavedCount,
    libraryQuery,
    setLibraryQuery,
    isLoading,
    error,
    findSavedSong,
    saveSong,
    deleteSong,
  } = useSavedSongs();

  const discoverLabel = platform.canScrape ? cs.tabs.onlineSearch : cs.tabs.fileImport;

  return (
    <main
      className="flex min-h-screen flex-col items-center px-4 py-6 sm:px-6"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
      }}
    >
      <header className="mb-6 flex w-full max-w-3xl flex-col gap-4 border-b border-neutral-800 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{cs.app.name}</h1>
            <p className="text-xs text-neutral-400">{cs.app.subtitle}</p>
          </div>
          <span className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-300">
            {platform.canScrape ? cs.app.platformMobile : cs.app.platformWeb}
          </span>
        </div>

        <nav className="grid grid-cols-2 gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === 'library'
                ? 'bg-amber-500 text-neutral-950'
                : 'text-neutral-300 hover:text-white'
            }`}
          >
            {cs.tabs.mySongbook} ({totalSavedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('discover')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === 'discover'
                ? 'bg-amber-500 text-neutral-950'
                : 'text-neutral-300 hover:text-white'
            }`}
          >
            {discoverLabel}
          </button>
        </nav>
      </header>

      {activeTab === 'library' ? (
        <SavedSongsPanel
          savedSongs={savedSongs}
          totalSavedCount={totalSavedCount}
          libraryQuery={libraryQuery}
          onLibraryQueryChange={setLibraryQuery}
          isLoading={isLoading}
          error={error}
          discoverLabel={discoverLabel}
          onDeleteSong={deleteSong}
          onSwitchToDiscover={() => setActiveTab('discover')}
        />
      ) : platform.canScrape ? (
        <OnlineSearchPanel
          findSavedSong={findSavedSong}
          onSaveSong={saveSong}
          onDeleteSong={deleteSong}
        />
      ) : (
        <WebImportFallback
          findSavedSong={findSavedSong}
          onSaveSong={saveSong}
          onDeleteSong={deleteSong}
        />
      )}
    </main>
  );
}
