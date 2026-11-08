import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';
import { apiService } from '@/services/api';
import { AuthUser, UserProfile, UserProfileUpdate } from '@/types';
import { ExpoSecureStoreAdapter } from '@/services/supabaseStorage';
import { SUPABASE_CONFIG } from '@/constants/config';

const GUEST_KEY = 'solace_guest_mode_active';

interface AuthState {
  session: Session | null;
  user: AuthUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  isGuest: boolean;
  authError: string | null;

  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: UserProfileUpdate) => Promise<{ success: boolean; error?: string }>;
  completeOnboarding: (
    preferredName: string,
    wellnessGoals: string[],
    interactionStyle: string
  ) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
}

const triggerHaptic = async (type: 'success' | 'error' | 'selection') => {
  if (Platform.OS === 'web') return;
  try {
    if (type === 'success') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'error') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      await Haptics.selectionAsync();
    }
  } catch {
    // Graceful fallback
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,
  isGuest: false,
  authError: null,

  initialize: async () => {
    try {
      // Wire up API service to pull JWT automatically
      apiService.setTokenProvider(async () => {
        const currentSession = get().session;
        if (currentSession?.access_token) {
          return currentSession.access_token;
        }
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token || null;
      });

      // 1. Check for active Supabase session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (session?.user) {
        set({
          session,
          user: {
            id: session.user.id,
            email: session.user.email ?? null,
            isGuest: false,
          },
          isGuest: false,
          isLoading: false,
          isInitialized: true,
        });

        // Fetch backend profile for authenticated user
        get().fetchProfile().catch(() => {});
      } else {
        // 2. Check for guest mode flag
        const isGuestSaved = await ExpoSecureStoreAdapter.getItem(GUEST_KEY);
        if (isGuestSaved === 'true') {
          set({
            session: null,
            user: {
              id: 'guest_user',
              email: null,
              isGuest: true,
            },
            profile: {
              id: 'guest_user',
              email: null,
              display_name: 'Guest Explorer',
              preferred_name: 'Guest',
              avatar_url: null,
              onboarding_completed: true,
              wellness_goals: ['General mindfulness'],
              interaction_style: 'gentle',
            },
            isGuest: true,
            isLoading: false,
            isInitialized: true,
          });
        } else {
          set({
            session: null,
            user: null,
            profile: null,
            isGuest: false,
            isLoading: false,
            isInitialized: true,
          });
        }
      }

      // 3. Listen to auth state transitions
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (newSession?.user) {
          await ExpoSecureStoreAdapter.removeItem(GUEST_KEY);
          set({
            session: newSession,
            user: {
              id: newSession.user.id,
              email: newSession.user.email ?? null,
              isGuest: false,
            },
            isGuest: false,
            isLoading: false,
          });
          get().fetchProfile().catch(() => {});
        } else if (!get().isGuest) {
          set({
            session: null,
            user: null,
            profile: null,
            isGuest: false,
            isLoading: false,
          });
        }
      });
    } catch (err: unknown) {
      console.warn('Auth initialization error:', err);
      set({ isLoading: false, isInitialized: true });
    }
  },

  signUp: async (email: string, password: string, fullName?: string) => {
    set({ isLoading: true, authError: null });

    if (!SUPABASE_CONFIG.isConfigured) {
      const msg = 'Live Supabase credentials are not configured in mobile/.env. Please configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, or tap "Explore as Guest" below.';
      set({ authError: msg, isLoading: false });
      await triggerHaptic('error');
      return { error: msg };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName?.trim() || '',
            name: fullName?.trim() || '',
          },
        },
      });

      if (error) {
        set({ authError: error.message, isLoading: false });
        await triggerHaptic('error');
        return { error: error.message };
      }

      if (data.session) {
        await ExpoSecureStoreAdapter.removeItem(GUEST_KEY);
        set({
          session: data.session,
          user: {
            id: data.session.user.id,
            email: data.session.user.email ?? null,
            isGuest: false,
          },
          isGuest: false,
          isLoading: false,
        });
        await triggerHaptic('success');
        return {};
      } else {
        // Confirmation email required by Supabase project settings
        const confirmMsg = 'Account registered! Please confirm your email before signing in, or disable "Confirm email" in Supabase Auth settings to log in immediately.';
        set({ authError: confirmMsg, isLoading: false });
        await triggerHaptic('selection');
        return { error: confirmMsg };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      set({ authError: message, isLoading: false });
      await triggerHaptic('error');
      return { error: message };
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, authError: null });

    if (!SUPABASE_CONFIG.isConfigured) {
      const msg = 'Live Supabase credentials are not configured in mobile/.env. Please configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, or tap "Explore as Guest" below.';
      set({ authError: msg, isLoading: false });
      await triggerHaptic('error');
      return { error: msg };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Friendly mapping of typical auth errors
        let friendlyMsg = error.message;
        if (error.message.includes('Invalid login credentials')) {
          friendlyMsg = 'Incorrect email or password. Please try again.';
        } else if (error.message.includes('Email not confirmed')) {
          friendlyMsg = 'Your email has not been confirmed yet. Please check your inbox, or disable "Confirm email" in Supabase Auth settings.';
        }
        set({ authError: friendlyMsg, isLoading: false });
        await triggerHaptic('error');
        return { error: friendlyMsg };
      }

      await ExpoSecureStoreAdapter.removeItem(GUEST_KEY);
      set({
        session: data.session,
        user: {
          id: data.user.id,
          email: data.user.email ?? null,
          isGuest: false,
        },
        isGuest: false,
        isLoading: false,
      });

      await triggerHaptic('success');
      get().fetchProfile().catch(() => {});
      return {};
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ authError: message, isLoading: false });
      await triggerHaptic('error');
      return { error: message };
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await supabase.auth.signOut();
      await ExpoSecureStoreAdapter.removeItem(GUEST_KEY);
      set({
        session: null,
        user: null,
        profile: null,
        isGuest: false,
        isLoading: false,
        authError: null,
      });
      await triggerHaptic('selection');
    } catch (err: unknown) {
      console.warn('Sign out error:', err);
      set({ isLoading: false });
    }
  },

  continueAsGuest: async () => {
    set({ isLoading: true });
    try {
      await ExpoSecureStoreAdapter.setItem(GUEST_KEY, 'true');
      const guestProfile: UserProfile = {
        id: 'guest_user',
        email: null,
        display_name: 'Guest Explorer',
        preferred_name: 'Guest',
        avatar_url: null,
        onboarding_completed: true,
        wellness_goals: ['General mindfulness'],
        interaction_style: 'gentle',
      };
      set({
        session: null,
        user: {
          id: 'guest_user',
          email: null,
          isGuest: true,
        },
        profile: guestProfile,
        isGuest: true,
        isLoading: false,
      });
      await triggerHaptic('success');
    } catch (err: unknown) {
      console.warn('Failed to enter guest mode:', err);
      set({ isLoading: false });
    }
  },

  fetchProfile: async () => {
    const { session, isGuest } = get();
    if (isGuest || !session?.access_token) return;

    try {
      const profile = await apiService.getProfile(session.access_token);
      set({ profile });
    } catch (error) {
      // Fallback: use user session metadata if backend profile not yet synced
      if (session?.user) {
        const rawName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Friend';
        set({
          profile: {
            id: session.user.id,
            email: session.user.email ?? null,
            display_name: rawName,
            preferred_name: rawName,
            avatar_url: null,
            onboarding_completed: false,
          },
        });
      }
    }
  },

  updateProfile: async (updates: UserProfileUpdate) => {
    const { session, isGuest, profile } = get();

    if (isGuest) {
      set({
        profile: profile ? { ...profile, ...updates } : null,
      });
      return { success: true };
    }

    try {
      const updated = await apiService.updateProfile(updates, session?.access_token);
      set({ profile: updated });
      await triggerHaptic('success');
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Profile update failed';
      return { success: false, error: message };
    }
  },

  completeOnboarding: async (
    preferredName: string,
    wellnessGoals: string[],
    interactionStyle: string
  ) => {
    const updates: UserProfileUpdate = {
      preferred_name: preferredName.trim() || undefined,
      wellness_goals: wellnessGoals,
      interaction_style: interactionStyle,
      onboarding_completed: true,
    };
    return await get().updateProfile(updates);
  },

  clearError: () => set({ authError: null }),
}));

