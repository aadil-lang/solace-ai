import { Platform } from 'react-native';

/**
 * Solace AI - Mobile Environment & Networking Configuration
 *
 * Android Emulator Note:
 * Android emulators route `10.0.2.2` to the host machine's `localhost` / `127.0.0.1`.
 * Direct `localhost` from inside an Android emulator refers to the emulator itself.
 */

const getDevDefaultApiUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://localhost:8000';
};

export const API_CONFIG = {
  baseUrl: getDevDefaultApiUrl(),
  timeoutMs: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS) || 12000,
  endpoints: {
    health: '/health',
    apiV1: '/api/v1',
    profile: '/api/v1/profile/me',
    checkIns: '/api/v1/check-ins',
    checkInHistory: '/api/v1/check-ins/history',
    conversations: '/api/v1/conversations',
    memories: '/api/v1/memories',
    chatStream: '/api/v1/chat/stream',
    poetryGenerate: '/api/v1/poetry/generate',
    poetrySave: '/api/v1/poetry/save',
    poetrySaved: '/api/v1/poetry/saved',
    journalReflect: '/api/v1/journal/reflect',
    journalSave: '/api/v1/journal/save',
    journalEntries: '/api/v1/journal/entries',
  },
} as const;

export const SUPABASE_CONFIG = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key',
  isConfigured: Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL &&
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.EXPO_PUBLIC_SUPABASE_URL.includes('demo.supabase.co')
  ),
} as const;
