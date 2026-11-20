import { type ChangeEvent, useEffect, useState } from 'react';
import {
  chordsOverLyricsToChordPro,
  isAlreadyChordPro,
} from '../core/chordpro/converter';
import type { SaveSongInput, SavedSong } from '../core/types/song';
import cs from '../i18n/cs.json';
import { platform } from '../services/platform';
import { SongPreview } from './SongPreview';

export interface WebImportFallbackProps {
  readonly findSavedSong: (sourceUrl?: string | null, id?: string | null) => SavedSong | undefined;
  readonly isStageMode?: boolean;
  readonly onToggleStageMode?: () => void;
  readonly onSongOpenChange?: (isOpen: boolean) => void;
  readonly onSaveSong: (input: SaveSongInput) => Promise<SavedSong>;
  readonly onDeleteSong: (id: string) => Promise<void>;
}

interface ImportedSong {
  readonly savedId?: string;
  readonly title: string;
  readonly sourceName: string;
  readonly chordproContent: string;
}

function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim() || filename;
}

export function WebImportFallback({
  findSavedSong,
  isStageMode = false,
  onToggleStageMode,
  onSongOpenChange,
  onSaveSong,
  onDeleteSong,
}: WebImportFallbackProps) {
  const [importedSong, setImportedSong] = useState<ImportedSong | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    onSongOpenChange?.(Boolean(importedSong));
    return () => onSongOpenChange?.(false);
  }, [importedSong, onSongOpenChange]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      if (rawText.trim().length === 0) {
        setErrorMessage(cs.webFallback.importError);
        return;
      }

      const titleFromName = stripFileExtension(file.name);
      const isChordProFile =
        /\.(?:cho|chordpro|chopro|pro)$/i.test(file.name) || isAlreadyChordPro(rawText);

      const chordproContent = isChordProFile
        ? rawText
        : chordsOverLyricsToChordPro(rawText, { title: titleFromName });

      setErrorMessage(null);
      setSaveError(null);
      setImportedSong({
        title: titleFromName,
        sourceName: `${cs.preview.localFileSource} (${file.name})`,
        chordproContent,
      });
    } catch {
      setErrorMessage(cs.webFallback.importError);
    }
  };

  if (importedSong) {
    const savedMatch = importedSong.savedId
      ? findSavedSong(null, importedSong.savedId)
      : undefined;

    const handleSave = async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const saved = await onSaveSong({
          id: importedSong.savedId,
          chordproContent: importedSong.chordproContent,
          sourceProvider: 'local-file',
        });
        setImportedSong((prev) => (prev ? { ...prev, savedId: saved.id } : null));
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : cs.preview.saveError);
      } finally {
        setIsSaving(false);
      }
    };

    const handleDelete = savedMatch
      ? async () => {
          setIsSaving(true);
          setSaveError(null);
          try {
            await onDeleteSong(savedMatch.id);
            setImportedSong((prev) =>
              prev
                ? {
                    title: prev.title,
                    sourceName: prev.sourceName,
                    chordproContent: prev.chordproContent,
                  }
                : null,
            );
          } catch (err) {
            setSaveError(err instanceof Error ? err.message : cs.preview.saveError);
          } finally {
            setIsSaving(false);
          }
        }
      : undefined;

    return (
      <SongPreview
        chordproContent={importedSong.chordproContent}
        sourceName={importedSong.sourceName}
        fallbackTitle={importedSong.title}
        isSaved={Boolean(savedMatch)}
        isSaving={isSaving}
        saveError={saveError}
        isStageMode={isStageMode}
        onToggleStageMode={onToggleStageMode}
        onSave={() => {
          void handleSave();
        }}
        onDelete={
          handleDelete
            ? () => {
                void handleDelete();
              }
            : undefined
        }
        onBack={() => {
          setSaveError(null);
          setImportedSong(null);
        }}
      />
    );
  }

  return (
    <section className="flex w-full flex-col">
      <div className="sticky top-0 z-20 border-b border-outline-variant chrome-bar pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)] select-none">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-on-surface">
            {cs.tabs.fileImport}
          </h1>
          <span className="rounded-full border border-outline-variant bg-surface-container px-2.5 py-0.5 text-xs text-on-surface-variant">
            {cs.app.platformWeb}
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 pt-6 pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)]">
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-outline-variant bg-surface-container-low p-6 text-center">
          <h2 className="text-lg font-semibold text-on-surface">{cs.webFallback.title}</h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            {cs.webFallback.description}
          </p>

          <label
            onClick={() => platform.hapticTap()}
            className="mt-2 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-on-primary select-none transition-transform duration-150 hover:brightness-110 active:scale-[0.98]"
          >
            {cs.webFallback.importButton}
            <input
              type="file"
              accept=".cho,.chordpro,.chopro,.pro,.txt,text/plain"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>

          {errorMessage ? (
            <p role="alert" className="text-sm font-medium text-error">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
