import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { apiService } from '@/services/api';
import {
  CheckIn,
  CheckInCreate,
  MoodType,
  LandscapeSummary,
  LandscapeReflectionResponse,
  LandscapeReflectionRecord,
} from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { ExpoSecureStoreAdapter } from '@/services/supabaseStorage';
import { computeLandscapeSummary } from '@/services/landscapeAnalytics';

const GUEST_CHECKIN_INDEX_KEY = '@solace_guest_checkin_index';
const GUEST_CHECKIN_ENTRY_PREFIX = '@solace_guest_checkin_entry_';
const AUTH_PENDING_CHECKINS_KEY = '@solace_auth_pending_checkins';
const CHUNK_SIZE = 1500; // Well below Android 2048-byte Keystore limits

interface GuestCheckInIndexItem {
  id: string;
  mood: MoodType;
  created_at: string;
  is_meaningful?: boolean;
}

// Helper: Save guest check-in with chunked note storage
async function saveGuestCheckInLocal(entry: CheckIn): Promise<void> {
  try {
    const rawNote = entry.note || '';
    const numChunks = Math.ceil(rawNote.length / CHUNK_SIZE) || 1;

    for (let i = 0; i < numChunks; i++) {
      const chunk = rawNote.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await ExpoSecureStoreAdapter.setItem(`${GUEST_CHECKIN_ENTRY_PREFIX}${entry.id}_chunk_${i}`, chunk);
    }

    const entryMeta = {
      ...entry,
      note: '', // Stored in chunks
      num_chunks: numChunks,
    };
    await ExpoSecureStoreAdapter.setItem(
      `${GUEST_CHECKIN_ENTRY_PREFIX}${entry.id}_meta`,
      JSON.stringify(entryMeta)
    );

    const indexStr = await ExpoSecureStoreAdapter.getItem(GUEST_CHECKIN_INDEX_KEY);
    let index: GuestCheckInIndexItem[] = [];
    if (indexStr) {
      try {
        index = JSON.parse(indexStr);
      } catch {}
    }

    const filtered = index.filter((item) => item.id !== entry.id);
    filtered.unshift({
      id: entry.id,
      mood: entry.mood,
      created_at: entry.created_at,
      is_meaningful: entry.is_meaningful,
    });

    await ExpoSecureStoreAdapter.setItem(GUEST_CHECKIN_INDEX_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('[useCheckInStore] Failed to save guest check-in locally:', err);
  }
}

// Helper: Load guest check-ins with chunk reassembly
async function loadGuestCheckInsLocal(): Promise<CheckIn[]> {
  try {
    const indexStr = await ExpoSecureStoreAdapter.getItem(GUEST_CHECKIN_INDEX_KEY);
    if (!indexStr) return [];

    const index: GuestCheckInIndexItem[] = JSON.parse(indexStr);
    const loaded: CheckIn[] = [];

    for (const item of index) {
      const metaStr = await ExpoSecureStoreAdapter.getItem(`${GUEST_CHECKIN_ENTRY_PREFIX}${item.id}_meta`);
      if (!metaStr) continue;

      try {
        const meta = JSON.parse(metaStr);
        const numChunks = meta.num_chunks || 1;
        let note = '';

        for (let i = 0; i < numChunks; i++) {
          const chunk = await ExpoSecureStoreAdapter.getItem(
            `${GUEST_CHECKIN_ENTRY_PREFIX}${item.id}_chunk_${i}`
          );
          if (chunk) note += chunk;
        }

        loaded.push({
          ...meta,
          note: note || null,
          sync_status: 'local_only',
        });
      } catch {}
    }

    return loaded;
  } catch (err) {
    console.warn('[useCheckInStore] Failed to load guest check-ins:', err);
    return [];
  }
}

// Helper: Delete guest check-in and all chunks
async function deleteGuestCheckInLocal(id: string): Promise<void> {
  try {
    const metaStr = await ExpoSecureStoreAdapter.getItem(`${GUEST_CHECKIN_ENTRY_PREFIX}${id}_meta`);
    if (metaStr) {
      try {
        const meta = JSON.parse(metaStr);
        const numChunks = meta.num_chunks || 1;
        for (let i = 0; i < numChunks; i++) {
          await ExpoSecureStoreAdapter.removeItem(`${GUEST_CHECKIN_ENTRY_PREFIX}${id}_chunk_${i}`);
        }
      } catch {}
    }
    await ExpoSecureStoreAdapter.removeItem(`${GUEST_CHECKIN_ENTRY_PREFIX}${id}_meta`);

    const indexStr = await ExpoSecureStoreAdapter.getItem(GUEST_CHECKIN_INDEX_KEY);
    if (indexStr) {
      try {
        const index: GuestCheckInIndexItem[] = JSON.parse(indexStr);
        const filtered = index.filter((item) => item.id !== id);
        await ExpoSecureStoreAdapter.setItem(GUEST_CHECKIN_INDEX_KEY, JSON.stringify(filtered));
      } catch {}
    }
  } catch (err) {
    console.warn('[useCheckInStore] Failed to delete guest check-in:', err);
  }
}

// Helper: Save pending sync queue for authenticated offline check-ins
async function saveAuthPendingCheckIns(entries: CheckIn[]): Promise<void> {
  try {
    await ExpoSecureStoreAdapter.setItem(AUTH_PENDING_CHECKINS_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('[useCheckInStore] Failed to save pending check-ins queue:', err);
  }
}

// Helper: Load pending sync queue
async function loadAuthPendingCheckIns(): Promise<CheckIn[]> {
  try {
    const str = await ExpoSecureStoreAdapter.getItem(AUTH_PENDING_CHECKINS_KEY);
    if (!str) return [];
    return JSON.parse(str);
  } catch (err) {
    console.warn('[useCheckInStore] Failed to load pending check-ins:', err);
    return [];
  }
}

interface CheckInState {
  checkIns: CheckIn[];
  todayCheckIn: CheckIn | null;
  isLoading: boolean;
  isSyncingPending: boolean;
  error: string | null;

  // Active ephemeral reflection (not saved until user explicitly consents)
  activeReflection: LandscapeReflectionResponse | null;
  isReflecting: boolean;
  savedReflections: LandscapeReflectionRecord[];
  isLoadingReflections: boolean;

  // Actions
  fetchHistory: (meaningfulOnly?: boolean) => Promise<void>;
  recordCheckIn: (
    mood: MoodType,
    intensity: number,
    note?: string | null,
    isMeaningful?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  toggleMeaningful: (id: string) => Promise<boolean>;
  removeCheckIn: (id: string) => Promise<void>;
  syncPendingCheckIns: () => Promise<void>;

  // Landscape reflections
  generateReflection: (
    timeframe: '7d' | '30d' | 'all' | 'moment',
    selectedCheckIns?: CheckIn[]
  ) => Promise<LandscapeReflectionResponse | null>;
  saveActiveReflection: (timeframe: string) => Promise<LandscapeReflectionRecord | null>;
  clearActiveReflection: () => void;
  fetchSavedReflections: () => Promise<void>;
  deleteSavedReflection: (id: string) => Promise<boolean>;

  // Analytics helper
  getSummary: (timeframe?: '7d' | '30d' | 'all') => LandscapeSummary;
}

export const useCheckInStore = create<CheckInState>((set, get) => ({
  checkIns: [],
  todayCheckIn: null,
  isLoading: false,
  isSyncingPending: false,
  error: null,

  activeReflection: null,
  isReflecting: false,
  savedReflections: [],
  isLoadingReflections: false,

  fetchHistory: async (meaningfulOnly: boolean = false) => {
    const isGuest = useAuthStore.getState().isGuest;
    set({ isLoading: true, error: null });

    if (isGuest) {
      const items = await loadGuestCheckInsLocal();
      const filtered = meaningfulOnly ? items.filter((c) => c.is_meaningful) : items;
      const todayStr = new Date().toISOString().split('T')[0];
      const today = items.find((c) => c.created_at.startsWith(todayStr)) || null;
      set({ checkIns: filtered, todayCheckIn: today, isLoading: false });
      return;
    }

    try {
      // 1. Fetch cloud history
      const res = await apiService.getCheckInHistory(50, 0, meaningfulOnly);
      const serverItems = (res.items || []).map((c) => ({
        ...c,
        sync_status: 'synced' as const,
      }));

      // 2. Load any local pending sync entries and merge safely
      const pendingItems = await loadAuthPendingCheckIns();
      const mergedMap = new Map<string, CheckIn>();

      // Server items first
      serverItems.forEach((c) => mergedMap.set(c.id, c));
      // Pending items override if local edits are pending
      pendingItems.forEach((c) => mergedMap.set(c.id, c));

      let allItems = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (meaningfulOnly) {
        allItems = allItems.filter((c) => c.is_meaningful);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const today = allItems.find((c) => c.created_at.startsWith(todayStr)) || null;

      set({ checkIns: allItems, todayCheckIn: today, isLoading: false });

      // Trigger background sync if pending items exist
      if (pendingItems.length > 0) {
        get().syncPendingCheckIns();
      }
    } catch (err: unknown) {
      // Offline fallback: load local pending queue
      const pendingItems = await loadAuthPendingCheckIns();
      const todayStr = new Date().toISOString().split('T')[0];
      const today = pendingItems.find((c) => c.created_at.startsWith(todayStr)) || null;

      set({
        checkIns: pendingItems,
        todayCheckIn: today,
        isLoading: false,
        error: 'Offline mode: displaying local records.',
      });
    }
  },

  recordCheckIn: async (
    mood: MoodType,
    intensity: number,
    note?: string | null,
    isMeaningful: boolean = false
  ) => {
    const isGuest = useAuthStore.getState().isGuest;
    set({ isLoading: true, error: null });

    const nowIso = new Date().toISOString();
    const newCheckIn: CheckIn = {
      id: isGuest ? `guest_ci_${Date.now()}` : `pending_ci_${Date.now()}`,
      user_id: isGuest ? 'guest' : '',
      mood,
      intensity,
      note: note || null,
      is_meaningful: isMeaningful,
      created_at: nowIso,
      sync_status: isGuest ? 'local_only' : 'pending_sync',
    };

    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }

    if (isGuest) {
      await saveGuestCheckInLocal(newCheckIn);
      set((state) => ({
        checkIns: [newCheckIn, ...state.checkIns],
        todayCheckIn: newCheckIn,
        isLoading: false,
      }));
      return { success: true };
    }

    // Authenticated path: try cloud save, fallback safely to local pending queue
    try {
      const payload: CheckInCreate = {
        mood,
        intensity,
        note: note || null,
        is_meaningful: isMeaningful,
        created_at: nowIso,
      };
      const saved = await apiService.createCheckIn(payload);
      const syncedCheckIn: CheckIn = {
        ...saved,
        sync_status: 'synced',
      };

      set((state) => ({
        checkIns: [syncedCheckIn, ...state.checkIns.filter((c) => c.id !== syncedCheckIn.id)],
        todayCheckIn: syncedCheckIn,
        isLoading: false,
      }));
      return { success: true };
    } catch (err: unknown) {
      console.warn('[useCheckInStore] Cloud save failed, preserving locally as pending_sync');
      // Save locally to pending queue
      const existingPending = await loadAuthPendingCheckIns();
      const updatedPending = [newCheckIn, ...existingPending];
      await saveAuthPendingCheckIns(updatedPending);

      set((state) => ({
        checkIns: [newCheckIn, ...state.checkIns],
        todayCheckIn: newCheckIn,
        isLoading: false,
      }));
      return { success: true };
    }
  },

  toggleMeaningful: async (id: string) => {
    const isGuest = useAuthStore.getState().isGuest;
    const item = get().checkIns.find((c) => c.id === id);
    if (!item) return false;

    const newMeaningful = !item.is_meaningful;

    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }

    // Optimistic update
    set((state) => ({
      checkIns: state.checkIns.map((c) =>
        c.id === id ? { ...c, is_meaningful: newMeaningful } : c
      ),
      todayCheckIn:
        state.todayCheckIn?.id === id
          ? { ...state.todayCheckIn, is_meaningful: newMeaningful }
          : state.todayCheckIn,
    }));

    if (isGuest) {
      const updatedItem = { ...item, is_meaningful: newMeaningful };
      await saveGuestCheckInLocal(updatedItem);
      return true;
    }

    try {
      await apiService.toggleCheckInMeaningful(id, newMeaningful);
      return true;
    } catch (err) {
      console.warn('[useCheckInStore] Failed to update meaningful flag on server:', err);
      // Revert optimistic update on cloud failure
      set((state) => ({
        checkIns: state.checkIns.map((c) =>
          c.id === id ? { ...c, is_meaningful: item.is_meaningful } : c
        ),
      }));
      return false;
    }
  },

  removeCheckIn: async (id: string) => {
    const isGuest = useAuthStore.getState().isGuest;

    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    if (isGuest) {
      await deleteGuestCheckInLocal(id);
      set((state) => ({
        checkIns: state.checkIns.filter((c) => c.id !== id),
        todayCheckIn: state.todayCheckIn?.id === id ? null : state.todayCheckIn,
      }));
      return;
    }

    // If it was a pending entry, remove from local queue
    const pending = await loadAuthPendingCheckIns();
    const updatedPending = pending.filter((c) => c.id !== id);
    await saveAuthPendingCheckIns(updatedPending);

    set((state) => ({
      checkIns: state.checkIns.filter((c) => c.id !== id),
      todayCheckIn: state.todayCheckIn?.id === id ? null : state.todayCheckIn,
    }));

    try {
      await apiService.deleteCheckIn(id);
    } catch (err) {
      console.warn('[useCheckInStore] Failed to delete check-in from cloud:', err);
    }
  },

  syncPendingCheckIns: async () => {
    const isGuest = useAuthStore.getState().isGuest;
    if (isGuest || get().isSyncingPending) return;

    const pending = await loadAuthPendingCheckIns();
    if (!pending.length) return;

    set({ isSyncingPending: true });

    const remainingPending: CheckIn[] = [];
    const syncedItems: CheckIn[] = [];

    for (const item of pending) {
      try {
        const payload: CheckInCreate = {
          mood: item.mood,
          intensity: item.intensity,
          note: item.note,
          is_meaningful: item.is_meaningful,
          created_at: item.created_at,
        };
        const synced = await apiService.createCheckIn(payload);
        syncedItems.push({ ...synced, sync_status: 'synced' });
      } catch (err) {
        remainingPending.push(item);
      }
    }

    await saveAuthPendingCheckIns(remainingPending);

    // Update store with newly synced entries
    set((state) => {
      const mergedMap = new Map<string, CheckIn>();
      state.checkIns.forEach((c) => mergedMap.set(c.id, c));
      syncedItems.forEach((c) => mergedMap.set(c.id, c));

      return {
        checkIns: Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        isSyncingPending: false,
      };
    });
  },

  generateReflection: async (
    timeframe: '7d' | '30d' | 'all' | 'moment',
    selectedCheckIns?: CheckIn[]
  ) => {
    set({ isReflecting: true, error: null });

    const isGuest = useAuthStore.getState().isGuest;
    const targetCheckIns = selectedCheckIns || get().checkIns;

    try {
      // Call backend reflection endpoint with scoped check-ins
      const res = await apiService.generateLandscapeReflection(timeframe, targetCheckIns);
      set({ activeReflection: res, isReflecting: false });
      return res;
    } catch (err) {
      console.warn('[useCheckInStore] Online reflection failed, providing grounded fallback');
      const fallback: LandscapeReflectionResponse = {
        reflection:
          'Every season carries its own rhythm and wisdom. Giving yourself permission to notice these inner shifts without needing to steer or fix them is a quiet act of kindness to yourself.',
        is_crisis_override: false,
        dominant_season: get().getSummary(timeframe === 'moment' ? '7d' : timeframe).dominant_season,
      };
      set({ activeReflection: fallback, isReflecting: false });
      return fallback;
    }
  },

  saveActiveReflection: async (timeframe: string) => {
    const isGuest = useAuthStore.getState().isGuest;
    const active = get().activeReflection;
    if (!active) return null;

    if (isGuest) {
      // Guest local-only saved reflection
      const record: LandscapeReflectionRecord = {
        id: `guest_ref_${Date.now()}`,
        user_id: 'guest',
        timeframe,
        reflection: active.reflection,
        dominant_mood: active.dominant_season || null,
        created_at: new Date().toISOString(),
      };
      set((state) => ({
        savedReflections: [record, ...state.savedReflections],
      }));
      return record;
    }

    try {
      const record = await apiService.saveLandscapeReflection({
        timeframe,
        reflection: active.reflection,
        dominant_mood: active.dominant_season,
      });
      set((state) => ({
        savedReflections: [record, ...state.savedReflections],
      }));
      return record;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save reflection';
      set({ error: msg });
      return null;
    }
  },

  clearActiveReflection: () => {
    set({ activeReflection: null });
  },

  fetchSavedReflections: async () => {
    const isGuest = useAuthStore.getState().isGuest;
    if (isGuest) return;

    set({ isLoadingReflections: true });
    try {
      const res = await apiService.getSavedLandscapeReflections(20, 0);
      set({ savedReflections: res.items || [], isLoadingReflections: false });
    } catch (err) {
      set({ isLoadingReflections: false });
    }
  },

  deleteSavedReflection: async (id: string) => {
    const isGuest = useAuthStore.getState().isGuest;
    set((state) => ({
      savedReflections: state.savedReflections.filter((r) => r.id !== id),
    }));

    if (isGuest) return true;

    try {
      await apiService.deleteSavedLandscapeReflection(id);
      return true;
    } catch (err) {
      return false;
    }
  },

  getSummary: (timeframe: '7d' | '30d' | 'all' = '7d') => {
    const checkIns = get().checkIns;
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {}

    return computeLandscapeSummary(checkIns, timeframe, tz);
  },
}));
