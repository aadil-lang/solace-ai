import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Cross-platform storage adapter for Supabase Auth.
 * Uses Expo SecureStore on Native (iOS/Android) and localStorage on Web.
 */
export const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStoreAdapter] Failed to get key "${key}":`, error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn(`[SecureStoreAdapter] Failed to set key "${key}":`, error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStoreAdapter] Failed to delete key "${key}":`, error);
    }
  },
};

