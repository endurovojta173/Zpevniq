import { useMemo, useState } from 'react';
import { type AppSection, BottomNav } from './components/BottomNav';
import { OnlineSearchPanel } from './components/OnlineSearchPanel';
import { SavedSongsPanel } from './components/SavedSongsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { WebImportFallback } from './components/WebImportFallback';
import { useSavedSongs } from './hooks/useSavedSongs';
import cs from './i18n/cs.json';
import { platform } from './services/platform';
import { getAllProviders } from './services/scrapers/registry';

export function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('library');
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

  const registeredSources = useMemo(
    () =>
      getAllProviders().map((provider) => ({
        id: provider.id,
        name: provider.name,
        baseUrl: provider.baseUrl,
      })),
    [],
  );

  const discoverLabel = platform.canScrape ? cs.tabs.onlineSearch : cs.tabs.fileImport;

  return (
    <div className="min-h-dvh w-full bg-neutral-950 text-neutral-100">
      <main className="w-full pb-24">
        {activeSection === 'library' ? (
          <SavedSongsPanel
            savedSongs={savedSongs}
            totalSavedCount={totalSavedCount}
            libraryQuery={libraryQuery}
            onLibraryQueryChange={setLibraryQuery}
            isLoading={isLoading}
            error={error}
            discoverLabel={discoverLabel}
            onDeleteSong={deleteSong}
            onSwitchToDiscover={() => setActiveSection('search')}
          />
        ) : activeSection === 'search' ? (
          platform.canScrape ? (
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
          )
        ) : (
          <SettingsPanel
            totalSavedCount={totalSavedCount}
            registeredSources={registeredSources}
          />
        )}
      </main>

      <BottomNav
        activeSection={activeSection}
        savedCount={totalSavedCount}
        onSelectSection={setActiveSection}
      />
    </div>
  );
}
