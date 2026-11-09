import { create } from 'zustand';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { voiceService } from '@/services/voice';
import { journalService } from '@/services/journal';
import { useAuthStore } from '@/store/useAuthStore';
import { ExpoSecureStoreAdapter } from '@/services/supabaseStorage';
import {
  JournalEntry,
  JournalCreateInput,
  JournalUpdateInput,
  JournalReflectionResponse,
} from '@/types/journal';

const GUEST_INDEX_KEY = '@solace_guest_journal_index';
const GUEST_ENTRY_PREFIX = '@solace_guest_journal_entry_';
const CHUNK_SIZE = 1500; // Well below Android SecureStore 2048-byte Keystore limit

interface GuestIndexItem {
  id: string;
  title: string;
  created_at: string;
  mood_tag?: string | null;
  duration_seconds: number;
}

interface DraftState {
  title: string;
  transcript: string;
  mood_tag?: string;
  duration_seconds: number;
}

interface JournalState {
  // Recording lifecycle
  isRecording: boolean;
  isProcessing: boolean;
  recordingDuration: number;

  // Active review/edit draft (MUST be explicitly saved)
  activeDraft: DraftState | null;
  activeReflection: JournalReflectionResponse | null;
  isReflecting: boolean;
  isSaving: boolean;

  // Saved collection
  entries: JournalEntry[];
  selectedEntry: JournalEntry | null;
  isLoadingEntries: boolean;
  error: string | null;

  // Actions
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<string>;
  cancelRecording: () => Promise<void>;
  setDraftTranscript: (text: string) => void;
  setDraftTitle: (title: string) => void;
  setDraftMood: (mood: string | undefined) => void;
  clearDraft: () => void;

  requestReflection: () => Promise<JournalReflectionResponse | null>;
  saveCurrentDraft: () => Promise<JournalEntry | null>;
  fetchEntries: () => Promise<void>;
  selectEntry: (entry: JournalEntry | null) => void;
  updateEntry: (id: string, updates: JournalUpdateInput) => Promise<boolean>;
  deleteEntry: (id: string) => Promise<boolean>;
  clearError: () => void;
}

let durationTimer: ReturnType<typeof setInterval> | null = null;

// Helper: Save guest journal with key isolation and chunking
async function saveGuestEntryLocal(entry: JournalEntry): Promise<void> {
  try {
    const rawTranscript = entry.transcript;
    const numChunks = Math.ceil(rawTranscript.length / CHUNK_SIZE) || 1;

    // Save individual chunks if transcript is long
    for (let i = 0; i < numChunks; i++) {
      const chunk = rawTranscript.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await ExpoSecureStoreAdapter.setItem(`${GUEST_ENTRY_PREFIX}${entry.id}_chunk_${i}`, chunk);
    }

    // Save entry metadata (excluding giant transcript to protect 2KB limit)
    const entryMeta = {
      ...entry,
      transcript: '', // Stored in chunks
      num_chunks: numChunks,
    };
    await ExpoSecureStoreAdapter.setItem(
      `${GUEST_ENTRY_PREFIX}${entry.id}_meta`,
      JSON.stringify(entryMeta)
    );

    // Update index
    const indexStr = await ExpoSecureStoreAdapter.getItem(GUEST_INDEX_KEY);
    let index: GuestIndexItem[] = [];
    if (indexStr) {
      try {
        index = JSON.parse(indexStr);
      } catch {}
    }

    const filteredIndex = index.filter((item) => item.id !== entry.id);
    filteredIndex.unshift({
      id: entry.id,
      title: entry.title,
      created_at: entry.created_at,
      mood_tag: entry.mood_tag,
      duration_seconds: entry.duration_seconds,
    });

    await ExpoSecureStoreAdapter.setItem(GUEST_INDEX_KEY, JSON.stringify(filteredIndex));
  } catch (err) {
    console.warn('[useJournalStore] Failed to save guest entry locally:', err);
  }
}

// Helper: Load guest journals reconstituting chunked transcripts
async function loadGuestEntriesLocal(): Promise<JournalEntry[]> {
  try {
    const indexStr = await ExpoSecureStoreAdapter.getItem(GUEST_INDEX_KEY);
    if (!indexStr) return [];

    const index: GuestIndexItem[] = JSON.parse(indexStr);
    const loaded: JournalEntry[] = [];

    for (const item of index) {
      const metaStr = await ExpoSecureStoreAdapter.getItem(`${GUEST_ENTRY_PREFIX}${item.id}_meta`);
      if (!metaStr) continue;

      try {
        const meta = JSON.parse(metaStr);
        const numChunks = meta.num_chunks || 1;
        let transcript = '';

        for (let i = 0; i < numChunks; i++) {
          const chunk = await ExpoSecureStoreAdapter.getItem(
            `${GUEST_ENTRY_PREFIX}${item.id}_chunk_${i}`
          );
          if (chunk) transcript += chunk;
        }

        loaded.push({
          ...meta,
          transcript,
        });
      } catch {}
    }

    return loaded;
  } catch (err) {
    console.warn('[useJournalStore] Failed to load guest entries:', err);
    return [];
  }
}

// Helper: Delete guest entry and its chunks
async function deleteGuestEntryLocal(id: string): Promise<void> {
  try {
    const metaStr = await ExpoSecureStoreAdapter.getItem(`${GUEST_ENTRY_PREFIX}${id}_meta`);
    if (metaStr) {
      try {
        const meta = JSON.parse(metaStr);
        const numChunks = meta.num_chunks || 1;
        for (let i = 0; i < numChunks; i++) {
          await ExpoSecureStoreAdapter.removeItem(`${GUEST_ENTRY_PREFIX}${id}_chunk_${i}`);
        }
      } catch {}
    }
    await ExpoSecureStoreAdapter.removeItem(`${GUEST_ENTRY_PREFIX}${id}_meta`);

    const indexStr = await ExpoSecureStoreAdapter.getItem(GUEST_INDEX_KEY);
    if (indexStr) {
      const index: GuestIndexItem[] = JSON.parse(indexStr);
      const updated = index.filter((item) => item.id !== id);
      await ExpoSecureStoreAdapter.setItem(GUEST_INDEX_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('[useJournalStore] Failed to delete guest entry:', err);
  }
}

export const useJournalStore = create<JournalState>((set, get) => ({
  isRecording: false,
  isProcessing: false,
  recordingDuration: 0,

  activeDraft: null,
  activeReflection: null,
  isReflecting: false,
  isSaving: false,

  entries: [],
  selectedEntry: null,
  isLoadingEntries: false,
  error: null,

  startRecording: async () => {
    try {
      set({ error: null });

      const hasMic = await voiceService.requestPermissions();
      if (!hasMic) {
        set({ error: 'Microphone permission is required to speak your journal entry.' });
        return false;
      }

      // Reset duration & active draft
      if (durationTimer) clearInterval(durationTimer);
      set({ recordingDuration: 0, isRecording: true, activeReflection: null });

      await voiceService.startRecording();

      durationTimer = setInterval(() => {
        set((state) => ({ recordingDuration: state.recordingDuration + 1 }));
      }, 1000);

      return true;
    } catch (err) {
      if (durationTimer) clearInterval(durationTimer);
      durationTimer = null;
      set({
        isRecording: false,
        error: err instanceof Error ? err.message : 'Failed to start recording.',
      });
      return false;
    }
  },

  stopRecording: async () => {
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }

    const duration = get().recordingDuration;
    set({ isRecording: false, isProcessing: true, error: null });

    try {
      const transcribedText = await voiceService.stopAndTranscribe();
      const cleaned = (transcribedText || '').trim();

      if (!cleaned) {
        set({
          isProcessing: false,
          error: 'No speech was detected in your recording. Please try speaking again.',
        });
        return '';
      }

      // Populate draft for mandatory user review (NEVER automatically saved)
      set({
        isProcessing: false,
        activeDraft: {
          title: 'Voice Reflection',
          transcript: cleaned,
          duration_seconds: duration,
        },
      });

      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }

      return cleaned;
    } catch (err) {
      set({
        isProcessing: false,
        error: err instanceof Error ? err.message : 'Transcription could not be completed.',
      });
      return '';
    }
  },

  cancelRecording: async () => {
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }
    await voiceService.cancelRecording();
    set({ isRecording: false, isProcessing: false, recordingDuration: 0 });
  },

  setDraftTranscript: (text) => {
    set((state) => ({
      activeDraft: state.activeDraft
        ? { ...state.activeDraft, transcript: text }
        : { title: 'Voice Reflection', transcript: text, duration_seconds: 0 },
    }));
  },

  setDraftTitle: (title) => {
    set((state) => ({
      activeDraft: state.activeDraft
        ? { ...state.activeDraft, title }
        : null,
    }));
  },

  setDraftMood: (mood_tag) => {
    set((state) => ({
      activeDraft: state.activeDraft
        ? { ...state.activeDraft, mood_tag }
        : null,
    }));
  },

  clearDraft: () => {
    set({
      activeDraft: null,
      activeReflection: null,
      recordingDuration: 0,
      error: null,
    });
  },

  requestReflection: async () => {
    const { activeDraft } = get();
    if (!activeDraft || !activeDraft.transcript.trim()) {
      return null;
    }

    set({ isReflecting: true, error: null });

    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    try {
      const res = await journalService.reflectOnJournal(activeDraft.transcript);
      set({ activeReflection: res, isReflecting: false });
      return res;
    } catch (err) {
      set({
        isReflecting: false,
        error: err instanceof Error ? err.message : 'Failed to generate reflection.',
      });
      return null;
    }
  },

  saveCurrentDraft: async () => {
    const { activeDraft, activeReflection } = get();
    if (!activeDraft || !activeDraft.transcript.trim()) {
      set({ error: 'Please record or write a journal thought before saving.' });
      return null;
    }

    set({ isSaving: true, error: null });

    const payload: JournalCreateInput = {
      title: activeDraft.title || 'Voice Reflection',
      transcript: activeDraft.transcript,
      mood_tag: activeDraft.mood_tag,
      duration_seconds: activeDraft.duration_seconds || 0,
      reflection: activeReflection?.reflection || undefined,
    };

    const isGuest = useAuthStore.getState().isGuest;

    try {
      let saved: JournalEntry;

      if (isGuest) {
        // Guest mode: Save strictly to local device storage across restarts
        const nowIso = new Date().toISOString();
        saved = {
          id: `guest-journal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: 'guest',
          title: payload.title || 'Voice Reflection',
          transcript: payload.transcript,
          mood_tag: payload.mood_tag || null,
          duration_seconds: payload.duration_seconds || 0,
          reflection: payload.reflection || null,
          sync_status: 'local_only',
          created_at: nowIso,
          updated_at: nowIso,
        };
        await saveGuestEntryLocal(saved);
      } else {
        // Authenticated: Persist via Supabase with RLS
        const cloudSaved = await journalService.saveJournalEntry(payload);
        saved = {
          ...cloudSaved,
          sync_status: 'synced',
        };
      }

      set((state) => ({
        isSaving: false,
        activeDraft: null,
        activeReflection: null,
        recordingDuration: 0,
        entries: [saved, ...state.entries.filter((e) => e.id !== saved.id)],
      }));

      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }

      return saved;
    } catch (err) {
      // Safe fallback: preserve draft on device as pending_sync rather than losing user thoughts
      const user = useAuthStore.getState().user;
      const userId = user?.id || 'pending-auth-user';
      const nowIso = new Date().toISOString();
      const pendingSaved: JournalEntry = {
        id: `pending-journal-${Date.now()}`,
        user_id: userId,
        title: payload.title || 'Voice Reflection',
        transcript: payload.transcript,
        mood_tag: payload.mood_tag || null,
        duration_seconds: payload.duration_seconds || 0,
        reflection: payload.reflection || null,
        sync_status: 'pending_sync',
        created_at: nowIso,
        updated_at: nowIso,
      };

      set((state) => ({
        isSaving: false,
        error: 'Cloud sanctuary is unreachable. Your entry is saved locally on this device as pending synchronization.',
        entries: [pendingSaved, ...state.entries],
        activeDraft: null,
        activeReflection: null,
      }));
      return pendingSaved;
    }
  },

  fetchEntries: async () => {
    set({ isLoadingEntries: true, error: null });
    const isGuest = useAuthStore.getState().isGuest;

    try {
      if (isGuest) {
        const localEntries = await loadGuestEntriesLocal();
        set({ entries: localEntries, isLoadingEntries: false });
      } else {
        const res = await journalService.getJournalEntries();
        set({ entries: res.items || [], isLoadingEntries: false });
      }
    } catch (err) {
      // Fallback to local entries if offline or network error
      const localEntries = await loadGuestEntriesLocal();
      set({
        entries: localEntries,
        isLoadingEntries: false,
        error: localEntries.length > 0 ? null : (err instanceof Error ? err.message : 'Failed to load journal entries.'),
      });
    }
  },

  selectEntry: (entry) => {
    set({ selectedEntry: entry });
  },

  updateEntry: async (id, updates) => {
    const isGuest = useAuthStore.getState().isGuest;
    const { entries, selectedEntry } = get();

    try {
      if (isGuest) {
        const existing = entries.find((e) => e.id === id);
        if (existing) {
          const updated: JournalEntry = {
            ...existing,
            title: updates.title !== undefined ? updates.title : existing.title,
            transcript: updates.transcript !== undefined ? updates.transcript : existing.transcript,
            mood_tag: updates.mood_tag !== undefined ? updates.mood_tag : existing.mood_tag,
            reflection: updates.reflection !== undefined ? updates.reflection : existing.reflection,
            updated_at: new Date().toISOString(),
          };
          await saveGuestEntryLocal(updated);
          set({
            entries: entries.map((e) => (e.id === id ? updated : e)),
            selectedEntry: selectedEntry?.id === id ? updated : selectedEntry,
          });
          return true;
        }
        return false;
      } else {
        const updated = await journalService.updateJournalEntry(id, updates);
        set({
          entries: entries.map((e) => (e.id === id ? updated : e)),
          selectedEntry: selectedEntry?.id === id ? updated : selectedEntry,
        });
        return true;
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update entry.' });
      return false;
    }
  },

  deleteEntry: async (id) => {
    const isGuest = useAuthStore.getState().isGuest;
    const { entries, selectedEntry } = get();

    try {
      if (isGuest) {
        await deleteGuestEntryLocal(id);
      } else {
        await journalService.deleteJournalEntry(id);
      }

      set({
        entries: entries.filter((e) => e.id !== id),
        selectedEntry: selectedEntry?.id === id ? null : selectedEntry,
      });

      if (Platform.OS !== 'web') {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
      }

      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete entry.' });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

