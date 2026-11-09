import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { apiService } from './api';

export type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking';

class VoiceService {
  private recording: Audio.Recording | null = null;
  private isTtsEnabled: boolean = true;
  private currentState: VoiceState = 'idle';
  private stateListeners: Set<(state: VoiceState) => void> = new Set();

  public subscribeState(listener: (state: VoiceState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.currentState);
    return () => this.stateListeners.delete(listener);
  }

  private setState(state: VoiceState) {
    this.currentState = state;
    this.stateListeners.forEach((l) => l(state));
  }

  public getState(): VoiceState {
    return this.currentState;
  }

  public isSpeakingEnabled(): boolean {
    return this.isTtsEnabled;
  }

  public setSpeakingEnabled(enabled: boolean): void {
    this.isTtsEnabled = enabled;
    if (!enabled) {
      this.stopSpeaking();
    }
  }

  /**
   * Request microphone permission from user
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn('Microphone permission request error:', err);
      return false;
    }
  }

  /**
   * Start recording audio from the microphone
   */
  public async startRecording(): Promise<boolean> {
    try {
      // Stop any active speech first so we don't record ourselves
      await this.stopSpeaking();

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission is required to speak to Solace.');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      if (this.recording) {
        try {
          await this.recording.stopAndUnloadAsync();
        } catch {}
        this.recording = null;
      }

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.setState('recording');

      if (Platform.OS !== 'web') {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }

      return true;
    } catch (err) {
      this.setState('idle');
      console.warn('Failed to start audio recording:', err);
      throw err;
    }
  }

  /**
   * Stop recording and transcribe audio via backend Gemini
   */
  public async stopAndTranscribe(): Promise<string> {
    if (!this.recording) {
      this.setState('idle');
      return '';
    }

    try {
      this.setState('processing');

      if (Platform.OS !== 'web') {
        try {
          await Haptics.selectionAsync();
        } catch {}
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      if (!uri) {
        this.setState('idle');
        return '';
      }

      // Convert local audio file to base64
      const response = await fetch(uri);
      const blob = await response.blob();

      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          // Strip data:...;base64, prefix if present
          const cleanBase64 = res.includes(',') ? res.split(',')[1] : res;
          resolve(cleanBase64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      if (!base64Audio || base64Audio.length === 0) {
        this.setState('idle');
        return '';
      }

      const transcribedText = await apiService.transcribeVoice(base64Audio, 'audio/mp4');
      this.setState('idle');
      return transcribedText;
    } catch (err) {
      this.setState('idle');
      console.warn('Voice transcription failed:', err);
      throw err;
    } finally {
      if (this.recording) {
        try {
          await this.recording.stopAndUnloadAsync();
        } catch {}
        this.recording = null;
      }
      // Audio mode reset
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      }).catch(() => {});
    }
  }

  /**
   * Cancel recording without transcribing and clean up audio subsystem
   */
  public async cancelRecording(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch {}
      this.recording = null;
    }
    this.setState('idle');
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    }).catch(() => {});
  }

  /**
   * Speak Solace's response aloud using on-device Text-to-Speech
   */
  public speakResponse(text: string, onDone?: () => void): void {
    if (!this.isTtsEnabled || !text || text.trim().length === 0) return;

    this.stopSpeaking();
    this.setState('speaking');

    // Clean markdown asterisks or special tokens for natural speech
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/•/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    Speech.speak(cleanText, {
      language: 'en',
      pitch: 0.95,
      rate: 0.9, // Gentle, calming, unhurried cadence
      onDone: () => {
        this.setState('idle');
        onDone?.();
      },
      onStopped: () => {
        this.setState('idle');
      },
      onError: (err) => {
        console.warn('[VoiceService] Speech playback failed or unavailable in this build:', err);
        this.setState('idle');
      },
    });
  }

  /**
   * Stop any current speech playback
   */
  public stopSpeaking(): void {
    try {
      Speech.stop();
    } catch {}
    if (this.currentState === 'speaking') {
      this.setState('idle');
    }
  }
}

export const voiceService = new VoiceService();
export default voiceService;

