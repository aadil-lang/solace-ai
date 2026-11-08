import { API_CONFIG } from '@/constants/config';
import {
  BackendHealthResponse,
  UserProfile,
  UserProfileUpdate,
  CheckIn,
  CheckInCreate,
  CheckInHistoryResponse,
  ConversationSession,
  ConversationMessage,
  UserMemory,
  MemoryCreate,
  MemoryUpdate,
  MemorySuggestion,
  PoetryGenerateRequest,
  PoetryGenerateResponse,
  SavedPoemCreate,
  SavedPoem,
  SavedPoemListResponse,
} from '@/types';

export interface ChatStreamCallbacks {
  onMessageStart?: (data: { sessionId: string; userMessageId: string }) => void;
  onToken?: (token: string) => void;
  onMemorySuggestion?: (suggestion: MemorySuggestion) => void;
  onMessageComplete?: (data: { assistantMessageId: string; content: string; appliedMemoriesCount?: number }) => void;
  onError?: (error: string, code?: string) => void;
}

class ApiService {
  private baseUrl: string;
  private timeoutMs: number;
  private tokenProvider: (() => Promise<string | null>) | null = null;

  constructor(baseUrl: string = API_CONFIG.baseUrl, timeoutMs: number = API_CONFIG.timeoutMs) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setTokenProvider(provider: () => Promise<string | null>): void {
    this.tokenProvider = provider;
  }

  private async getAuthToken(override?: string | null): Promise<string | null> {
    if (override !== undefined) return override;
    if (this.tokenProvider) {
      try {
        return await this.tokenProvider();
      } catch {
        return null;
      }
    }
    return null;
  }

  private async fetchWithTimeout(
    endpoint: string,
    options: RequestInit = {},
    tokenOverride?: string | null
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const authToken = await this.getAuthToken(tokenOverride);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });
      return response;
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error(`Request to ${url} timed out after ${this.timeoutMs}ms.`);
        }
        if (err.message.includes('Network request failed')) {
          throw new Error(
            `Cannot connect to ${this.baseUrl}. ` +
            `If using Android emulator, use 'http://10.0.2.2:8000'. ` +
            `If using a physical device, use your machine's LAN IP.`
          );
        }
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // --- Health ---
  public async checkHealth(): Promise<BackendHealthResponse> {
    const response = await this.fetchWithTimeout(API_CONFIG.endpoints.health, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Backend returned status ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // --- User Profile ---
  public async getProfile(token?: string | null): Promise<UserProfile> {
    const response = await this.fetchWithTimeout(API_CONFIG.endpoints.profile, { method: 'GET' }, token);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch profile (${response.status})`);
    }
    return response.json();
  }

  public async updateProfile(updates: UserProfileUpdate, token?: string | null): Promise<UserProfile> {
    const response = await this.fetchWithTimeout(
      API_CONFIG.endpoints.profile,
      { method: 'PATCH', body: JSON.stringify(updates) },
      token
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to update profile (${response.status})`);
    }
    return response.json();
  }

  // --- Mood Check-ins ---
  public async createCheckIn(data: CheckInCreate, token?: string | null): Promise<CheckIn> {
    const response = await this.fetchWithTimeout(
      API_CONFIG.endpoints.checkIns,
      { method: 'POST', body: JSON.stringify(data) },
      token
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to create check-in (${response.status})`);
    }
    return response.json();
  }

  public async getCheckInHistory(limit: number = 20, offset: number = 0, token?: string | null): Promise<CheckInHistoryResponse> {
    const endpoint = `${API_CONFIG.endpoints.checkInHistory}?limit=${limit}&offset=${offset}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'GET' }, token);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch check-in history (${response.status})`);
    }
    return response.json();
  }

  public async deleteCheckIn(checkInId: string, token?: string | null): Promise<void> {
    const endpoint = `${API_CONFIG.endpoints.checkIns}/${checkInId}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'DELETE' }, token);
    if (!response.ok) {
      throw new Error(`Failed to delete check-in (${response.status})`);
    }
  }

  // --- Conversations & Messages ---
  public async createConversation(title?: string, token?: string | null): Promise<ConversationSession> {
    const response = await this.fetchWithTimeout(
      API_CONFIG.endpoints.conversations,
      { method: 'POST', body: JSON.stringify({ title }) },
      token
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to create conversation (${response.status})`);
    }
    return response.json();
  }

  public async getConversations(token?: string | null): Promise<ConversationSession[]> {
    const response = await this.fetchWithTimeout(API_CONFIG.endpoints.conversations, { method: 'GET' }, token);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to list conversations (${response.status})`);
    }
    return response.json();
  }

  public async getMessages(sessionId: string, limit: number = 50, token?: string | null): Promise<ConversationMessage[]> {
    const endpoint = `${API_CONFIG.endpoints.conversations}/${sessionId}/messages?limit=${limit}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'GET' }, token);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to get messages (${response.status})`);
    }
    return response.json();
  }

  public async deleteConversation(sessionId: string, token?: string | null): Promise<void> {
    const endpoint = `${API_CONFIG.endpoints.conversations}/${sessionId}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'DELETE' }, token);
    if (!response.ok) {
      throw new Error(`Failed to delete conversation (${response.status})`);
    }
  }

  // --- Emotional Memories ---
  public async getMemories(activeOnly: boolean = false, token?: string | null): Promise<UserMemory[]> {
    const endpoint = `${API_CONFIG.endpoints.memories}?active_only=${activeOnly}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'GET' }, token);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch memories (${response.status})`);
    }
    const data = await response.json();
    return data.items || [];
  }

  public async createMemory(data: MemoryCreate, token?: string | null): Promise<UserMemory> {
    const response = await this.fetchWithTimeout(
      API_CONFIG.endpoints.memories,
      { method: 'POST', body: JSON.stringify(data) },
      token
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to create memory (${response.status})`);
    }
    return response.json();
  }

  public async updateMemory(memoryId: string, updates: MemoryUpdate, token?: string | null): Promise<UserMemory> {
    const endpoint = `${API_CONFIG.endpoints.memories}/${memoryId}`;
    const response = await this.fetchWithTimeout(
      endpoint,
      { method: 'PATCH', body: JSON.stringify(updates) },
      token
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to update memory (${response.status})`);
    }
    return response.json();
  }

  public async deleteMemory(memoryId: string, token?: string | null): Promise<void> {
    const endpoint = `${API_CONFIG.endpoints.memories}/${memoryId}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'DELETE' }, token);
    if (!response.ok) {
      throw new Error(`Failed to delete memory (${response.status})`);
    }
  }

  // --- Words of Solace (Poetry) ---
  public async generatePoem(
    request: PoetryGenerateRequest,
    tokenOverride?: string | null
  ): Promise<PoetryGenerateResponse> {
    const response = await this.fetchWithTimeout(
      API_CONFIG.endpoints.poetryGenerate,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      tokenOverride
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Poetry generation failed (${response.status})`);
    }
    return response.json();
  }

  public async savePoem(
    data: SavedPoemCreate,
    tokenOverride?: string | null
  ): Promise<SavedPoem> {
    const response = await this.fetchWithTimeout(
      API_CONFIG.endpoints.poetrySave,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      tokenOverride
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to save poem (${response.status})`);
    }
    return response.json();
  }

  public async getSavedPoems(
    limit: number = 50,
    offset: number = 0,
    tokenOverride?: string | null
  ): Promise<SavedPoemListResponse> {
    const endpoint = `${API_CONFIG.endpoints.poetrySaved}?limit=${limit}&offset=${offset}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'GET' }, tokenOverride);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to fetch saved poems (${response.status})`);
    }
    return response.json();
  }

  public async deleteSavedPoem(
    poemId: string,
    tokenOverride?: string | null
  ): Promise<void> {
    const endpoint = `${API_CONFIG.endpoints.poetrySaved}/${poemId}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'DELETE' }, tokenOverride);
    if (!response.ok) {
      throw new Error(`Failed to delete poem (${response.status})`);
    }
  }

  // --- Streaming Chat (SSE over POST) ---
  public async streamChat(
    content: string,
    sessionId: string | null,
    callbacks: ChatStreamCallbacks,
    mode: 'standard' | 'rant' = 'standard',
    tokenOverride?: string | null
  ): Promise<void> {
    const url = `${this.baseUrl}${API_CONFIG.endpoints.chatStream}`;
    const authToken = await this.getAuthToken(tokenOverride);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, session_id: sessionId, mode }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const msg = errorJson?.error?.message || `Chat stream failed with status ${response.status}`;
        callbacks.onError?.(msg, errorJson?.error?.code);
        return;
      }

      // Stream parsing supporting both Web ReadableStream and React Native response text chunks
      if (response.body && typeof (response.body as any).getReader === 'function') {
        const reader = (response.body as any).getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            this.processSSEBlock(part, callbacks);
          }
        }
        if (buffer.trim()) {
          this.processSSEBlock(buffer, callbacks);
        }
      } else {
        // Fallback for environments where body.getReader is unavailable
        const fullText = await response.text();
        const blocks = fullText.split('\n\n');
        for (const block of blocks) {
          this.processSSEBlock(block, callbacks);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Chat connection failed.';
      callbacks.onError?.(message);
    }
  }

  /**
   * Transcribe recorded audio via the backend Gemini multimodal speech recognition endpoint.
   */
  public async transcribeVoice(audioBase64: string, mimeType: string = 'audio/mp4'): Promise<string> {
    const response = await this.fetchWithTimeout('/api/v1/voice/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audio_base64: audioBase64, mime_type: mimeType }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || 'Voice transcription failed.');
    }

    const data = await response.json();
    return data.text || '';
  }

  private processSSEBlock(block: string, callbacks: ChatStreamCallbacks): void {
    const trimmed = block.trim();
    if (!trimmed || !trimmed.startsWith('data: ')) return;

    try {
      const jsonStr = trimmed.replace(/^data:\s*/, '');
      const eventData = JSON.parse(jsonStr);

      switch (eventData.event) {
        case 'message_start':
          callbacks.onMessageStart?.({
            sessionId: eventData.session_id,
            userMessageId: eventData.user_message_id,
          });
          break;
        case 'token':
          callbacks.onToken?.(eventData.token);
          break;
        case 'memory_suggestion':
          callbacks.onMemorySuggestion?.({
            memory_text: eventData.memory_text,
            category: eventData.category,
            prompt: eventData.prompt,
          });
          break;
        case 'message_complete':
          callbacks.onMessageComplete?.({
            assistantMessageId: eventData.assistant_message_id,
            content: eventData.content,
            appliedMemoriesCount: eventData.applied_memories_count,
          });
          break;
        case 'error':
          callbacks.onError?.(eventData.error, eventData.code);
          break;
      }
    } catch {
      // Ignore unparseable lines
    }
  }
}

export const apiService = new ApiService();
export default apiService;
