import { useCallback, useEffect, useRef, useState } from 'react';
import { type AppSection, BottomNav } from './components/BottomNav';
import { OnlineSearchPanel } from './components/OnlineSearchPanel';
import { SavedSongsPanel } from './components/SavedSongsPanel';
import { type RegisteredSourceInfo, SettingsPanel } from './components/SettingsPanel';
import { WebImportFallback } from './components/WebImportFallback';
import type { SaveSongInput } from './core/types/song';
import { useSavedSongs } from './hooks/useSavedSongs';
import { useTheme } from './hooks/useTheme';
import cs from './i18n/cs.json';
import { platform } from './services/platform';
import {
  getAllProviders,
  isProviderEnabled,
  setProviderEnabled,
} from './services/scrapers/registry';

function buildRegisteredSources(): RegisteredSourceInfo[] {
  return getAllProviders().map((provider) => ({
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    language: provider.language,
    enabled: isProviderEnabled(provider.id),
  }));
}

export function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('library');
  const [isSongOpen, setIsSongOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const [registeredSources, setRegisteredSources] = useState<readonly RegisteredSourceInfo[]>(
    () => buildRegisteredSources(),
  );

  const {
    themePreference,
    setThemePreference,
    isStageMode,
    toggleStageMode,
  } = useTheme();

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

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleSaveSong = useCallback(
    async (input: SaveSongInput) => {
      const saved = await saveSong(input);
      platform.hapticTap();
      showToast(cs.toast.saved);
      return saved;
    },
    [saveSong, showToast],
  );

  const handleDeleteSong = useCallback(
    async (id: string) => {
      await deleteSong(id);
      platform.hapticTap();
      showToast(cs.toast.removed);
    },
    [deleteSong, showToast],
  );

  const handleToggleSource = useCallback((id: string, enabled: boolean) => {
    setProviderEnabled(id, enabled);
    setRegisteredSources(buildRegisteredSources());
  }, []);

  const handleSelectSection = useCallback((section: AppSection) => {
    setIsSongOpen(false);
    setActiveSection(section);
  }, []);

  const discoverLabel = platform.canScrape ? cs.tabs.onlineSearch : cs.tabs.fileImport;

  return (
    <div className="min-h-dvh w-full bg-surface text-on-surface">
      <main
        className={`w-full md:pl-22 md:pb-8 ${
          isSongOpen
            ? 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]'
            : 'pb-[calc(5.75rem+env(safe-area-inset-bottom))]'
        }`}
      >
        {activeSection === 'library' ? (
          <SavedSongsPanel
            savedSongs={savedSongs}
            totalSavedCount={totalSavedCount}
            libraryQuery={libraryQuery}
            onLibraryQueryChange={setLibraryQuery}
            isLoading={isLoading}
            error={error}
            discoverLabel={discoverLabel}
            isStageMode={isStageMode}
            onToggleStageMode={toggleStageMode}
            onSongOpenChange={setIsSongOpen}
            onDeleteSong={handleDeleteSong}
            onSwitchToDiscover={() => handleSelectSection('search')}
          />
        ) : activeSection === 'search' ? (
          platform.canScrape ? (
            <OnlineSearchPanel
              findSavedSong={findSavedSong}
              isStageMode={isStageMode}
              onToggleStageMode={toggleStageMode}
              onSongOpenChange={setIsSongOpen}
              onSaveSong={handleSaveSong}
              onDeleteSong={handleDeleteSong}
            />
          ) : (
            <WebImportFallback
              findSavedSong={findSavedSong}
              isStageMode={isStageMode}
              onToggleStageMode={toggleStageMode}
              onSongOpenChange={setIsSongOpen}
              onSaveSong={handleSaveSong}
              onDeleteSong={handleDeleteSong}
            />
          )
        ) : (
          <SettingsPanel
            totalSavedCount={totalSavedCount}
            registeredSources={registeredSources}
            themePreference={themePreference}
            onThemePreferenceChange={setThemePreference}
            onToggleSource={handleToggleSource}
          />
        )}
      </main>

      {toastMessage ? (
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-none fixed inset-x-4 z-50 flex justify-center md:left-26 ${
            isSongOpen
              ? 'bottom-[calc(env(safe-area-inset-bottom)+1rem)]'
              : 'bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] md:bottom-6'
          }`}
        >
          <div className="rounded-full border border-outline-variant bg-surface-container-highest px-4 py-2 text-xs font-semibold text-on-surface shadow-lg">
            {toastMessage}
          </div>
        </div>
      ) : null}

      <BottomNav
        activeSection={activeSection}
        savedCount={totalSavedCount}
        hidden={isSongOpen}
        onSelectSection={handleSelectSection}
      />
    </div>
  );
}
