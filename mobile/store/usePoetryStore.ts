import { create } from 'zustand';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';
import { ExpoSecureStoreAdapter } from '@/services/supabaseStorage';
import {
  PoetryFormat,
  PoetryTheme,
  PoetryGenerateRequest,
  PoetryGenerateResponse,
  SavedPoem,
  SavedPoemCreate,
} from '@/types';

const GUEST_POEMS_KEY = '@solace_guest_saved_poems';

interface PoetryState {
  selectedFormat: PoetryFormat;
  selectedTheme: PoetryTheme;
  userContext: string;

  activePoem: PoetryGenerateResponse | null;
  savedPoems: SavedPoem[];
  isGenerating: boolean;
  isSaving: boolean;
  isLoadingSaved: boolean;
  isCurrentPoemSaved: boolean;
  error: string | null;

  setFormat: (format: PoetryFormat) => void;
  setTheme: (theme: PoetryTheme) => void;
  setUserContext: (context: string) => void;

  generatePoem: (requestOverride?: Partial<PoetryGenerateRequest>) => Promise<PoetryGenerateResponse | null>;
  regeneratePoem: () => Promise<PoetryGenerateResponse | null>;
  saveCurrentPoem: () => Promise<boolean>;
  fetchSavedPoems: () => Promise<void>;
  deletePoem: (poemId: string) => Promise<boolean>;
  clearActivePoem: () => void;
  clearError: () => void;
}

// In-memory guest store across app session
let guestLocalSavedPoems: SavedPoem[] = [];

export const usePoetryStore = create<PoetryState>((set, get) => ({
  selectedFormat: 'english',
  selectedTheme: 'moment_of_calm',
  userContext: '',

  activePoem: null,
  savedPoems: [],
  isGenerating: false,
  isSaving: false,
  isLoadingSaved: false,
  isCurrentPoemSaved: false,
  error: null,

  setFormat: (selectedFormat) => set({ selectedFormat }),
  setTheme: (selectedTheme) => set({ selectedTheme }),
  setUserContext: (userContext) => set({ userContext: userContext.slice(0, 300) }),

  generatePoem: async (override) => {
    const { selectedFormat, selectedTheme, userContext } = get();
    const req: PoetryGenerateRequest = {
      format: override?.format || selectedFormat,
      theme: override?.theme || selectedTheme,
      context: override?.context !== undefined ? override.context : (userContext.trim() || undefined),
    };

    set({ isGenerating: true, error: null, isCurrentPoemSaved: false });

    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    try {
      const response = await apiService.generatePoem(req);
      set({
        activePoem: response,
        isGenerating: false,
        selectedFormat: response.format,
        selectedTheme: response.theme,
      });

      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }

      return response;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to compose poetry at this moment.';
      set({ error: msg, isGenerating: false });
      return null;
    }
  },

  regeneratePoem: async () => {
    return await get().generatePoem();
  },

  saveCurrentPoem: async () => {
    const { activePoem, selectedFormat, selectedTheme } = get();
    if (!activePoem) return false;

    const isGuest = useAuthStore.getState().isGuest;
    const nowIso = new Date().toISOString();

    set({ isSaving: true, error: null });

    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }

    const payload: SavedPoemCreate = {
      title: activePoem.title,
      content: activePoem.lines.join('\n'),
      format: activePoem.format || selectedFormat,
      theme: activePoem.theme || selectedTheme,
      secondary_content: activePoem.secondary_lines ? activePoem.secondary_lines.join('\n') : null,
      reflection: activePoem.reflection,
    };

    if (isGuest) {
      // Local-only guest storage: persists across restarts but never creates cloud records
      const guestPoem: SavedPoem = {
        id: `guest_poem_${Date.now()}`,
        user_id: 'guest',
        title: payload.title,
        content: payload.content,
        format: payload.format,
        theme: payload.theme,
        secondary_content: payload.secondary_content,
        reflection: payload.reflection,
        metadata: {},
        created_at: nowIso,
      };

      guestLocalSavedPoems = [guestPoem, ...guestLocalSavedPoems];
      try {
        await ExpoSecureStoreAdapter.setItem(GUEST_POEMS_KEY, JSON.stringify(guestLocalSavedPoems));
      } catch (err) {
        console.warn('Failed to persist guest poem to local storage:', err);
      }

      set((state) => ({
        savedPoems: [guestPoem, ...state.savedPoems],
        isSaving: false,
        isCurrentPoemSaved: true,
      }));
      return true;
    }

    try {
      const saved = await apiService.savePoem(payload);
      set((state) => ({
        savedPoems: [saved, ...state.savedPoems],
        isSaving: false,
        isCurrentPoemSaved: true,
      }));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save poem.';
      set({ error: msg, isSaving: false });
      return false;
    }
  },

  fetchSavedPoems: async () => {
    const isGuest = useAuthStore.getState().isGuest;

    if (isGuest) {
      set({ isLoadingSaved: true, error: null });
      try {
        const stored = await ExpoSecureStoreAdapter.getItem(GUEST_POEMS_KEY);
        if (stored) {
          guestLocalSavedPoems = JSON.parse(stored);
        }
      } catch (err) {
        console.warn('Failed to load guest poems from local storage:', err);
      }
      set({ savedPoems: [...guestLocalSavedPoems], isLoadingSaved: false });
      return;
    }

    set({ isLoadingSaved: true, error: null });
    try {
      const res = await apiService.getSavedPoems(50, 0);
      set({ savedPoems: res.items, isLoadingSaved: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not fetch saved poems.';
      set({ error: msg, isLoadingSaved: false });
    }
  },

  deletePoem: async (poemId: string) => {
    const isGuest = useAuthStore.getState().isGuest;

    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    if (isGuest) {
      guestLocalSavedPoems = guestLocalSavedPoems.filter((p) => p.id !== poemId);
      try {
        await ExpoSecureStoreAdapter.setItem(GUEST_POEMS_KEY, JSON.stringify(guestLocalSavedPoems));
      } catch (err) {
        console.warn('Failed to update guest poems in local storage:', err);
      }
      set((state) => ({
        savedPoems: state.savedPoems.filter((p) => p.id !== poemId),
      }));
      return true;
    }

    try {
      await apiService.deleteSavedPoem(poemId);
      set((state) => ({
        savedPoems: state.savedPoems.filter((p) => p.id !== poemId),
      }));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete poem.';
      set({ error: msg });
      return false;
    }
  },

  clearActivePoem: () => set({ activePoem: null, isCurrentPoemSaved: false, error: null }),
  clearError: () => set({ error: null }),
}));

