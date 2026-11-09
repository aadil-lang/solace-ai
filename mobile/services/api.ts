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
  JournalEntry,
  JournalCreateInput,
  JournalUpdateInput,
  JournalReflectionResponse,
  JournalListResponse,
  LandscapeSummary,
  LandscapeReflectionResponse,
  LandscapeReflectionRecord,
} from '@/types';

export interface ChatStreamCallbacks {
  onMessageStart?: (data: { sessionId: string; userMessageId: string }) => void;
  onToken?: (token: string) => void;
  onMemorySuggestion?: (suggestion: MemorySuggestion) => void;
  onMessageComplete?: (data: { assistantMessageId: string; content: string; appliedMemoriesCount?: number }) => void;
  onError?: (error: string, code?: string) => void;
}

export interface ColdStartStatus {
  isColdStarting: boolean;
  message: string;
  attempt: number;
  maxAttempts: number;
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  isIdempotent?: boolean;
}

class ApiService {
  private baseUrl: string;
  private timeoutMs: number;
  private tokenProvider: (() => Promise<string | null>) | null = null;
  private coldStartListeners: Set<(status: ColdStartStatus) => void> = new Set();

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

  public subscribeColdStart(listener: (status: ColdStartStatus) => void): () => void {
    this.coldStartListeners.add(listener);
    return () => this.coldStartListeners.delete(listener);
  }

  private notifyColdStart(isColdStarting: boolean, attempt: number, maxAttempts: number): void {
    const status: ColdStartStatus = {
      isColdStarting,
      message: isColdStarting
        ? 'Solace is gently waking up. Please hold a moment...'
        : '',
      attempt,
      maxAttempts,
    };
    this.coldStartListeners.forEach((fn) => {
      try {
        fn(status);
      } catch {}
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isColdStartOrTransient(err: unknown, response?: Response): boolean {
    if (response) {
      // HTTP 502, 503, 504 are standard reverse-proxy responses when upstream container is booting
      return response.status === 502 || response.status === 503 || response.status === 504;
    }
    if (err instanceof Error) {
      if (err.name === 'AbortError') return true;
      const msg = err.message.toLowerCase();
      if (
        msg.includes('network request failed') ||
        msg.includes('failed to fetch') ||
        msg.includes('connection refused') ||
        msg.includes('econnrefused')
      ) {
        return true;
      }
    }
    return false;
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
    options: FetchOptions = {},
    tokenOverride?: string | null
  ): Promise<Response> {
    const method = (options.method || 'GET').toUpperCase();
    const isIdempotent =
      options.isIdempotent !== undefined
        ? options.isIdempotent
        : (method === 'GET' || method === 'DELETE' || method === 'HEAD');

    // Bounded retries: up to 2 retries (3 total attempts) for idempotent or safe read calls
    const maxRetries = options.retries !== undefined ? options.retries : (isIdempotent ? 2 : 0);
    const timeout = options.timeoutMs || this.timeoutMs;
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    let lastError: unknown = null;
    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const authToken = await this.getAuthToken(tokenOverride);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...((options.headers as Record<string, string>) || {}),
        };

        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers,
        });

        clearTimeout(timeoutId);

        // Check if reverse proxy indicates upstream cold boot
        if (this.isColdStartOrTransient(null, response) && attempt < maxRetries) {
          lastResponse = response;
          this.notifyColdStart(true, attempt + 1, maxRetries + 1);
          await this.delay(1500 * (attempt + 1));
          continue;
        }

        // Authoritative response received
        if (attempt > 0) {
          this.notifyColdStart(false, attempt + 1, maxRetries + 1);
        }
        return response;
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        lastError = err;

        if (this.isColdStartOrTransient(err) && attempt < maxRetries) {
          this.notifyColdStart(true, attempt + 1, maxRetries + 1);
          await this.delay(1500 * (attempt + 1));
          continue;
        }

        if (attempt > 0) {
          this.notifyColdStart(false, attempt + 1, maxRetries + 1);
        }

        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            throw new Error(
              `Solace is taking a moment to wake up (request to ${endpoint} timed out after ${timeout}ms). ` +
              `Your local records remain safe.`
            );
          }
          if (err.message.includes('Network request failed') || err.message.includes('Failed to fetch')) {
            throw new Error(
              `Cannot connect to Solace backend at ${this.baseUrl}. ` +
              `The server may be warming up or offline. Your thoughts remain safely preserved on your device.`
            );
          }
        }
        throw err;
      }
    }

    if (lastResponse) return lastResponse;
    throw lastError || new Error(`Request to ${endpoint} failed after ${maxRetries + 1} attempts.`);
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

  public async getCheckInHistory(
    limit: number = 20,
    offset: number = 0,
    meaningfulOnly: boolean = false,
    token?: string | null
  ): Promise<CheckInHistoryResponse> {
    const endpoint = `${API_CONFIG.endpoints.checkInHistory}?limit=${limit}&offset=${offset}&meaningful_only=${meaningfulOnly}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'GET' }, token);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch check-in history (${response.status})`);
    }
    return response.json();
  }

  public async toggleCheckInMeaningful(
    checkInId: string,
    isMeaningful: boolean,
    token?: string | null
  ): Promise<CheckIn> {
    const endpoint = `${API_CONFIG.endpoints.checkIns}/${checkInId}/meaningful`;
    const response = await this.fetchWithTimeout(
      endpoint,
      { method: 'PATCH', body: JSON.stringify({ is_meaningful: isMeaningful }) },
      token
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to update meaningful bookmark (${response.status})`);
    }
    return response.json();
  }

  public async getLandscapeSummary(
    timeframe: '7d' | '30d' | 'all' = '7d',
    tz: string = 'UTC',
    token?: string | null
  ): Promise<LandscapeSummary> {
    const endpoint = `${API_CONFIG.endpoints.landscapeSummary}?timeframe=${timeframe}&tz=${encodeURIComponent(tz)}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'GET' }, token);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to fetch landscape summary (${response.status})`);
    }
    return response.json();
  }

  public async generateLandscapeReflection(
    timeframe: string = '7d',
    selectedCheckIns?: CheckIn[],
    token?: string | null
  ): Promise<LandscapeReflectionResponse> {
    const response = await this.fetchWithTimeout(
      API_CONFIG.endpoints.landscapeReflect,
      {
        method: 'POST',
        body: JSON.stringify({
          timeframe,
          selected_check_ins: selectedCheckIns || undefined,
        }),
      },
      token
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to generate reflection (${response.status})`);
    }
    return response.json();
  }

  public async saveLandscapeReflection(
    data: { timeframe: string; reflection: string; dominant_mood?: string | null },
    token?: string | null
  ): Promise<LandscapeReflectionRecord> {
    const response = await this.fetchWithTimeout(
      API_CONFIG.endpoints.landscapeReflections,
      { method: 'POST', body: JSON.stringify(data) },
      token
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to save reflection (${response.status})`);
    }
    return response.json();
  }

  public async getSavedLandscapeReflections(
    limit: number = 20,
    offset: number = 0,
    token?: string | null
  ): Promise<{ items: LandscapeReflectionRecord[]; total: number }> {
    const endpoint = `${API_CONFIG.endpoints.landscapeReflections}?limit=${limit}&offset=${offset}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'GET' }, token);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to fetch saved reflections (${response.status})`);
    }
    return response.json();
  }

  public async deleteSavedLandscapeReflection(
    reflectionId: string,
    token?: string | null
  ): Promise<void> {
    const endpoint = `${API_CONFIG.endpoints.landscapeReflections}/${reflectionId}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'DELETE' }, token);
    if (!response.ok) {
      throw new Error(`Failed to delete saved reflection (${response.status})`);
    }
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

  // --- Voice Journal ---
  public async reflectOnJournal(
    transcript: string,
    tokenOverride?: string | null
  ): Promise<JournalReflectionResponse> {
    const response = await this.fetchWithTimeout(
      API_CONFIG.endpoints.journalReflect,
      {
        method: 'POST',
        body: JSON.stringify({ transcript }),
      },
      tokenOverride
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to generate reflection (${response.status})`);
    }
    return response.json();
  }

  public async saveJournalEntry(
    data: JournalCreateInput,
    tokenOverride?: string | null
  ): Promise<JournalEntry> {
    const response = await this.fetchWithTimeout(
      API_CONFIG.endpoints.journalSave,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      tokenOverride
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to save journal entry (${response.status})`);
    }
    return response.json();
  }

  public async getJournalEntries(
    limit: number = 50,
    offset: number = 0,
    tokenOverride?: string | null
  ): Promise<JournalListResponse> {
    const endpoint = `${API_CONFIG.endpoints.journalEntries}?limit=${limit}&offset=${offset}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'GET' }, tokenOverride);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to fetch journal entries (${response.status})`);
    }
    return response.json();
  }

  public async getJournalEntry(
    journalId: string,
    tokenOverride?: string | null
  ): Promise<JournalEntry> {
    const endpoint = `${API_CONFIG.endpoints.journalEntries}/${journalId}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'GET' }, tokenOverride);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to fetch journal entry (${response.status})`);
    }
    return response.json();
  }

  public async updateJournalEntry(
    journalId: string,
    data: JournalUpdateInput,
    tokenOverride?: string | null
  ): Promise<JournalEntry> {
    const endpoint = `${API_CONFIG.endpoints.journalEntries}/${journalId}`;
    const response = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      tokenOverride
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || `Failed to update journal entry (${response.status})`);
    }
    return response.json();
  }

  public async deleteJournalEntry(
    journalId: string,
    tokenOverride?: string | null
  ): Promise<void> {
    const endpoint = `${API_CONFIG.endpoints.journalEntries}/${journalId}`;
    const response = await this.fetchWithTimeout(endpoint, { method: 'DELETE' }, tokenOverride);
    if (!response.ok) {
      throw new Error(`Failed to delete journal entry (${response.status})`);
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
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ content, session_id: sessionId, mode }),
        });
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          this.notifyColdStart(true, 1, 2);
          await this.delay(2000);
          response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ content, session_id: sessionId, mode }),
          });
          this.notifyColdStart(false, 2, 2);
        }
      } catch (connErr: unknown) {
        this.notifyColdStart(true, 1, 2);
        await this.delay(2000);
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ content, session_id: sessionId, mode }),
        });
        this.notifyColdStart(false, 2, 2);
      }

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
