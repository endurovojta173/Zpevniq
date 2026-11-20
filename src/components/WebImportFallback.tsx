import { type ChangeEvent, useState } from 'react';
import {
  chordsOverLyricsToChordPro,
  isAlreadyChordPro,
} from '../core/chordpro/converter';
import type { SaveSongInput, SavedSong } from '../core/types/song';
import cs from '../i18n/cs.json';
import { SongPreview } from './SongPreview';

export interface WebImportFallbackProps {
  readonly findSavedSong: (sourceUrl?: string | null, id?: string | null) => SavedSong | undefined;
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
  onSaveSong,
  onDeleteSong,
}: WebImportFallbackProps) {
  const [importedSong, setImportedSong] = useState<ImportedSong | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      <div
        className="sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/95 px-4 pb-3 backdrop-blur-md"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-white">{cs.tabs.fileImport}</h1>
          <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 text-xs text-neutral-400">
            {cs.app.platformWeb}
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 pt-6">
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center">
          <h2 className="text-lg font-semibold text-white">{cs.webFallback.title}</h2>
          <p className="text-sm leading-relaxed text-neutral-400">
            {cs.webFallback.description}
          </p>

          <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400">
            {cs.webFallback.importButton}
            <input
              type="file"
              accept=".cho,.chordpro,.chopro,.pro,.txt,text/plain"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>

          {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}
        </div>
      </div>
    </section>
  );
}
