import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { apiService } from '@/services/api';
import { CheckIn, CheckInCreate, MoodType } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';

interface CheckInState {
  checkIns: CheckIn[];
  todayCheckIn: CheckIn | null;
  isLoading: boolean;
  error: string | null;

  fetchHistory: () => Promise<void>;
  recordCheckIn: (mood: MoodType, intensity: number, note?: string | null) => Promise<{ success: boolean; error?: string }>;
  removeCheckIn: (id: string) => Promise<void>;
}

export const useCheckInStore = create<CheckInState>((set, get) => ({
  checkIns: [],
  todayCheckIn: null,
  isLoading: false,
  error: null,

  fetchHistory: async () => {
    const isGuest = useAuthStore.getState().isGuest;
    if (isGuest) return;

    set({ isLoading: true, error: null });
    try {
      const res = await apiService.getCheckInHistory(30, 0);
      const items = res.items || [];

      // Check if user checked in today
      const todayStr = new Date().toISOString().split('T')[0];
      const today = items.find((c) => c.created_at.startsWith(todayStr)) || null;

      set({ checkIns: items, todayCheckIn: today, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not fetch check-ins';
      set({ error: msg, isLoading: false });
    }
  },

  recordCheckIn: async (mood: MoodType, intensity: number, note?: string | null) => {
    const isGuest = useAuthStore.getState().isGuest;
    set({ isLoading: true, error: null });

    const newCheckIn: CheckIn = {
      id: isGuest ? `guest_ci_${Date.now()}` : '',
      user_id: isGuest ? 'guest' : '',
      mood,
      intensity,
      note,
      created_at: new Date().toISOString(),
    };

    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }

    if (isGuest) {
      set((state) => ({
        checkIns: [newCheckIn, ...state.checkIns],
        todayCheckIn: newCheckIn,
        isLoading: false,
      }));
      return { success: true };
    }

    try {
      const payload: CheckInCreate = { mood, intensity, note: note || null };
      const saved = await apiService.createCheckIn(payload);

      set((state) => ({
        checkIns: [saved, ...state.checkIns.filter((c) => c.id !== saved.id)],
        todayCheckIn: saved,
        isLoading: false,
      }));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record check-in';
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  removeCheckIn: async (id: string) => {
    const isGuest = useAuthStore.getState().isGuest;
    if (isGuest) {
      set((state) => ({
        checkIns: state.checkIns.filter((c) => c.id !== id),
        todayCheckIn: state.todayCheckIn?.id === id ? null : state.todayCheckIn,
      }));
      return;
    }

    try {
      await apiService.deleteCheckIn(id);
      set((state) => ({
        checkIns: state.checkIns.filter((c) => c.id !== id),
        todayCheckIn: state.todayCheckIn?.id === id ? null : state.todayCheckIn,
      }));
    } catch (err) {
      console.warn('Delete check-in error:', err);
    }
  },
}));

