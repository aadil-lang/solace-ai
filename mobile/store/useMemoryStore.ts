import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { apiService } from '@/services/api';
import { UserMemory, MemoryCreate, MemoryCategory, MemorySuggestion } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';

interface MemoryState {
  memories: UserMemory[];
  pendingSuggestion: MemorySuggestion | null;
  isMemoryEnabled: boolean;
  isLoading: boolean;
  error: string | null;

  fetchMemories: () => Promise<void>;
  setPendingSuggestion: (suggestion: MemorySuggestion | null) => void;
  approveSuggestion: () => Promise<void>;
  declineSuggestion: () => void;
  createMemory: (text: string, category: MemoryCategory) => Promise<{ success: boolean; error?: string }>;
  toggleMemoryActive: (id: string, isActive: boolean) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  toggleGlobalMemory: (enabled: boolean) => void;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  memories: [],
  pendingSuggestion: null,
  isMemoryEnabled: true,
  isLoading: false,
  error: null,

  fetchMemories: async () => {
    const isGuest = useAuthStore.getState().isGuest;
    if (isGuest) return;

    set({ isLoading: true, error: null });
    try {
      const items = await apiService.getMemories(false);
      set({ memories: items, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not fetch memories';
      set({ error: msg, isLoading: false });
    }
  },

  setPendingSuggestion: (suggestion) => set({ pendingSuggestion: suggestion }),

  approveSuggestion: async () => {
    const suggestion = get().pendingSuggestion;
    if (!suggestion) return;

    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }

    const isGuest = useAuthStore.getState().isGuest;
    const payload: MemoryCreate = {
      memory_text: suggestion.memory_text,
      category: suggestion.category,
      source: 'conversation',
      consent_status: 'approved',
    };

    if (isGuest) {
      const guestMemory: UserMemory = {
        id: `guest_mem_${Date.now()}`,
        user_id: 'guest',
        memory_text: suggestion.memory_text,
        category: suggestion.category,
        source: 'conversation',
        consent_status: 'approved',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((state) => ({
        memories: [guestMemory, ...state.memories],
        pendingSuggestion: null,
      }));
      return;
    }

    try {
      const created = await apiService.createMemory(payload);
      set((state) => ({
        memories: [created, ...state.memories],
        pendingSuggestion: null,
      }));
    } catch (err) {
      console.warn('Failed to save approved memory:', err);
      set({ pendingSuggestion: null });
    }
  },

  declineSuggestion: () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    set({ pendingSuggestion: null });
  },

  createMemory: async (text: string, category: MemoryCategory) => {
    set({ isLoading: true });
    try {
      const created = await apiService.createMemory({
        memory_text: text,
        category,
        source: 'user_created',
        consent_status: 'approved',
      });
      set((state) => ({
        memories: [created, ...state.memories],
        isLoading: false,
      }));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create memory';
      set({ isLoading: false });
      return { success: false, error: msg };
    }
  },

  toggleMemoryActive: async (id: string, isActive: boolean) => {
    try {
      await apiService.updateMemory(id, { is_active: isActive });
      set((state) => ({
        memories: state.memories.map((m) => (m.id === id ? { ...m, is_active: isActive } : m)),
      }));
    } catch (err) {
      console.warn('Toggle memory error:', err);
    }
  },

  deleteMemory: async (id: string) => {
    try {
      await apiService.deleteMemory(id);
      set((state) => ({
        memories: state.memories.filter((m) => m.id !== id),
      }));
    } catch (err) {
      console.warn('Delete memory error:', err);
    }
  },

  toggleGlobalMemory: (enabled: boolean) => set({ isMemoryEnabled: enabled }),
}));

