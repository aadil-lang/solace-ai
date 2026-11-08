import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { apiService } from '@/services/api';
import { ConnectionStatus, BackendHealthResponse } from '@/types';
import { API_CONFIG } from '@/constants/config';

interface AppState {
  connectionStatus: ConnectionStatus;
  healthData: BackendHealthResponse | null;
  errorMessage: string | null;
  lastChecked: string | null;
  apiUrl: string;

  // Actions
  setApiUrl: (url: string) => void;
  checkBackendHealth: () => Promise<void>;
  resetError: () => void;
}

const triggerHaptic = async (type: 'success' | 'error') => {
  if (Platform.OS === 'web') return;
  try {
    if (type === 'success') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {
    // Gracefully ignore haptic failures on unsupported platforms/emulators
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  connectionStatus: 'idle',
  healthData: null,
  errorMessage: null,
  lastChecked: null,
  apiUrl: API_CONFIG.baseUrl,

  setApiUrl: (url: string) => {
    apiService.setBaseUrl(url);
    set({ apiUrl: url });
  },

  checkBackendHealth: async () => {
    set({ connectionStatus: 'loading', errorMessage: null });

    try {
      const data = await apiService.checkHealth();
      set({
        connectionStatus: 'connected',
        healthData: data,
        lastChecked: new Date().toLocaleTimeString(),
        errorMessage: null,
      });
      await triggerHaptic('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Backend unreachable';
      set({
        connectionStatus: 'disconnected',
        healthData: null,
        lastChecked: new Date().toLocaleTimeString(),
        errorMessage: message,
      });
      await triggerHaptic('error');
    }
  },

  resetError: () => set({ errorMessage: null }),
}));

