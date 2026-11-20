export interface SavedSong {
  readonly id: string;
  readonly chordproContent: string;
  readonly title: string;
  readonly artist: string;
  readonly key: string | null;
  readonly capo: number | null;
  readonly sourceProvider: string | null;
  readonly sourceUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly isDirty: boolean;
}

export interface SaveSongInput {
  readonly id?: string;
  readonly chordproContent: string;
  readonly sourceProvider?: string | null;
  readonly sourceUrl?: string | null;
}
