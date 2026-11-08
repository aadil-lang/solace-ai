import { create } from 'zustand';
import { apiService } from '@/services/api';
import { ConversationSession, ConversationMessage } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { useMemoryStore } from '@/store/useMemoryStore';

interface ChatState {
  sessions: ConversationSession[];
  activeSessionId: string | null;
  messages: ConversationMessage[];
  isStreaming: boolean;
  streamingText: string;
  appliedMemoriesCount: number;
  lastFailedMessage: string | null;
  isRantMode: boolean;
  error: string | null;

  setRantMode: (enabled: boolean) => void;
  loadSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  startNewSession: () => void;
  sendMessage: (content: string, modeOverride?: 'standard' | 'rant') => Promise<void>;
  retryLastMessage: () => Promise<void>;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  isStreaming: false,
  streamingText: '',
  appliedMemoriesCount: 0,
  lastFailedMessage: null,
  isRantMode: false,
  error: null,

  setRantMode: (enabled: boolean) => set({ isRantMode: enabled }),

  loadSessions: async () => {
    const isGuest = useAuthStore.getState().isGuest;
    if (isGuest) return;

    try {
      const sessions = await apiService.getConversations();
      set({ sessions });
      // If no active session, auto-select the latest if available
      if (!get().activeSessionId && sessions.length > 0) {
        await get().selectSession(sessions[0].id);
      }
    } catch (err) {
      console.warn('Could not load chat sessions:', err);
    }
  },

  selectSession: async (sessionId: string) => {
    set({ activeSessionId: sessionId, messages: [], error: null });
    try {
      const messages = await apiService.getMessages(sessionId, 50);
      set({ messages });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load conversation history';
      set({ error: msg });
    }
  },

  startNewSession: () => {
    set({
      activeSessionId: null,
      messages: [],
      streamingText: '',
      isStreaming: false,
      error: null,
      appliedMemoriesCount: 0,
    });
  },

  sendMessage: async (content: string, modeOverride?: 'standard' | 'rant') => {
    const trimmed = content.trim();
    if (!trimmed || get().isStreaming) return;

    const mode = modeOverride || (get().isRantMode ? 'rant' : 'standard');
    const { activeSessionId, messages, lastFailedMessage } = get();
    const tempUserId = useAuthStore.getState().user?.id || 'user';
    const tempMsgId = `temp_user_${Date.now()}`;

    // If retrying the exact failed message and it's already the last bubble, don't duplicate it
    const isRetrying =
      lastFailedMessage === trimmed &&
      messages.length > 0 &&
      messages[messages.length - 1].role === 'user' &&
      messages[messages.length - 1].content === trimmed;

    const optimisticUserMsg: ConversationMessage = {
      id: tempMsgId,
      session_id: activeSessionId || 'pending',
      user_id: tempUserId,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    set({
      messages: isRetrying ? messages : [...messages, optimisticUserMsg],
      isStreaming: true,
      streamingText: '',
      appliedMemoriesCount: 0,
      lastFailedMessage: null,
      error: null,
    });

    let currentSessionId = activeSessionId;
    let accumulatedText = '';

    await apiService.streamChat(trimmed, currentSessionId, {
      onMessageStart: ({ sessionId, userMessageId }) => {
        currentSessionId = sessionId;
        set({ activeSessionId: sessionId });
      },
      onToken: (token) => {
        accumulatedText += token;
        set({ streamingText: accumulatedText });
      },
      onMemorySuggestion: (suggestion) => {
        useMemoryStore.getState().setPendingSuggestion(suggestion);
      },
      onMessageComplete: ({ assistantMessageId, content, appliedMemoriesCount }) => {
        const assistantMsg: ConversationMessage = {
          id: assistantMessageId,
          session_id: currentSessionId || 'pending',
          user_id: 'assistant',
          role: 'assistant',
          content,
          created_at: new Date().toISOString(),
        };
        set((state) => ({
          messages: [...state.messages, assistantMsg],
          isStreaming: false,
          streamingText: '',
          appliedMemoriesCount: appliedMemoriesCount || 0,
        }));
        // Refresh session list
        get().loadSessions().catch(() => {});
      },
      onError: (errMsg, code) => {
        set({
          isStreaming: false,
          streamingText: '',
          lastFailedMessage: trimmed,
          error: errMsg,
        });
      },
    }, mode);
  },

  retryLastMessage: async () => {
    const failed = get().lastFailedMessage;
    if (failed) {
      await get().sendMessage(failed);
    }
  },

  clearError: () => set({ error: null }),
}));

