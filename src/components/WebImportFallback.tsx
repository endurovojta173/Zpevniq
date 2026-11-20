import { type ChangeEvent, useState } from 'react';
import {
  chordsOverLyricsToChordPro,
  isAlreadyChordPro,
} from '../core/chordpro/converter';
import cs from '../i18n/cs.json';
import { SongPreview } from './SongPreview';

interface ImportedSong {
  readonly title: string;
  readonly sourceName: string;
  readonly chordproContent: string;
}

function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim() || filename;
}

export function WebImportFallback() {
  const [importedSong, setImportedSong] = useState<ImportedSong | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    return (
      <SongPreview
        chordproContent={importedSong.chordproContent}
        sourceName={importedSong.sourceName}
        fallbackTitle={importedSong.title}
        onBack={() => setImportedSong(null)}
      />
    );
  }

  return (
    <section className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center">
      <h2 className="text-lg font-semibold text-white">{cs.webFallback.title}</h2>
      <p className="text-sm leading-relaxed text-neutral-400">{cs.webFallback.description}</p>

      <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400">
        {cs.webFallback.importButton}
        <input
          type="file"
          accept=".cho,.chordpro,.chopro,.pro,.txt,text/plain"
          onChange={handleFileChange}
          className="sr-only"
        />
      </label>

      {errorMessage ? (
        <p className="text-sm text-red-400">{errorMessage}</p>
      ) : null}
    </section>
  );
}
