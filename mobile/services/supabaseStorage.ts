import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Android Keystore and SecureStore require keys to contain only
 * alphanumeric characters, '.', '-', and '_'.
 * Keys starting with '@' or containing slashes/special characters are sanitized on Native.
 * On Web, raw keys are preserved in localStorage.
 */
export const sanitizeKey = (key: string): string => key.replace(/[^a-zA-Z0-9._-]/g, '_');

/**
 * Cross-platform storage adapter for Supabase Auth and offline guest persistence.
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
      return await SecureStore.getItemAsync(sanitizeKey(key));
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
      await SecureStore.setItemAsync(sanitizeKey(key), value);
    } catch (error) {
      console.warn(`[SecureStoreAdapter] Failed to set key "${key}":`, error);
      throw error;
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
      await SecureStore.deleteItemAsync(sanitizeKey(key));
    } catch (error) {
      console.warn(`[SecureStoreAdapter] Failed to delete key "${key}":`, error);
      throw error;
    }
  },
};
