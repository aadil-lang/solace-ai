import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  BackHandler,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useMemoryStore } from '@/store/useMemoryStore';
import { voiceService, VoiceState } from '@/services/voice';
import { Button } from '@/components/Button';

const STANDARD_STARTERS = [
  "I'm feeling a bit restless and need to untangle my thoughts.",
  "Something happened today that left me feeling unsettled.",
  "Can you guide me through a gentle grounding pause?",
  "I'd like to celebrate a small win I had today.",
];

const RANT_STARTERS = [
  "Today was completely exhausting and I just need to get it off my chest.",
  "I'm so frustrated right now and I don't want anyone trying to fix it.",
  "Everything felt overwhelming today and I need a space to complain freely.",
  "I just need to vent without receiving advice or productivity tips.",
];

const RANT_FINISHED_OPTIONS = [
  { label: 'Just to be heard', icon: 'ear-outline', text: "I'd just like to be heard and sit with it in quiet solidarity." },
  { label: 'Help gently reflecting', icon: 'sparkles-outline', text: "I'd appreciate some gentle help reflecting on what happened." },
  { label: 'Practical suggestions', icon: 'bulb-outline', text: "I'm ready for some practical suggestions and actionable ideas now." },
];

export default function CompanionScreen() {
  const router = useRouter();
  const { profile, isGuest, exitGuestMode } = useAuthStore();

  const handleExitGuestToAuth = async () => {
    await exitGuestMode();
    router.replace('/(auth)/login');
  };

  const {
    messages,
    isStreaming,
    streamingText,
    error,
    lastFailedMessage,
    appliedMemoriesCount,
    isRantMode,
    setRantMode,
    loadSessions,
    startNewSession,
    sendMessage,
    retryLastMessage,
    clearError,
  } = useChatStore();

  const { pendingSuggestion, approveSuggestion, declineSuggestion } = useMemoryStore();

  const [inputMessage, setInputMessage] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isTtsEnabled, setIsTtsEnabled] = useState<boolean>(voiceService.isSpeakingEnabled());
  const [showFinishedPrompt, setShowFinishedPrompt] = useState<boolean>(false);

  const scrollViewRef = useRef<any>(null);
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  const displayName = profile?.preferred_name || profile?.display_name || (isGuest ? 'Explorer' : 'Friend');

  // Load conversation sessions
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Subscribe to voice service state changes
  useEffect(() => {
    const unsubscribe = voiceService.subscribeState((newState) => {
      setVoiceState(newState);
    });
    return () => {
      unsubscribe();
      voiceService.stopSpeaking();
      voiceService.cancelRecording();
    };
  }, []);

  // Text-To-Speech for incoming assistant responses
  useEffect(() => {
    if (messages.length === 0 || isStreaming) return;

    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg.role === 'assistant' &&
      lastMsg.id !== lastSpokenMessageIdRef.current &&
      isTtsEnabled
    ) {
      lastSpokenMessageIdRef.current = lastMsg.id;
      voiceService.speakResponse(lastMsg.content);
    }
  }, [messages, isStreaming, isTtsEnabled]);

  // Auto-scroll when new messages arrive or during streaming
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, streamingText]);

  // Handle Android hardware back press when memory consent banner or rant mode is active
  useEffect(() => {
    if (Platform.OS === 'android') {
      const onBackPress = () => {
        if (pendingSuggestion) {
          declineSuggestion();
          return true;
        }
        if (isRantMode) {
          setRantMode(false);
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }
  }, [pendingSuggestion, declineSuggestion, isRantMode, setRantMode]);

  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText || inputMessage).trim();
    if (!textToSend || isStreaming) return;

    // Stop speaking if playing
    voiceService.stopSpeaking();

    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }

    if (!overrideText) {
      setInputMessage('');
    }

    setShowFinishedPrompt(false);
    await sendMessage(textToSend);
  };

  const handleToggleTts = () => {
    const nextVal = !isTtsEnabled;
    setIsTtsEnabled(nextVal);
    voiceService.setSpeakingEnabled(nextVal);
    if (!nextVal) {
      voiceService.stopSpeaking();
    }
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
  };

  const handleToggleRantMode = () => {
    const nextMode = !isRantMode;
    setRantMode(nextMode);
    setShowFinishedPrompt(false);
    voiceService.stopSpeaking();

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
  };

  const handleMicrophonePress = async () => {
    if (isGuest) {
      handleExitGuestToAuth();
      return;
    }

    if (voiceState === 'recording') {
      // Stop and transcribe
      try {
        const text = await voiceService.stopAndTranscribe();
        if (text && text.trim().length > 0) {
          // Append transcribed text to current input
          setInputMessage((prev) => (prev ? `${prev} ${text}` : text));
          if (Platform.OS !== 'web') {
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}
          }
        } else {
          Alert.alert('No speech detected', 'Please hold the microphone and speak clearly.');
        }
      } catch (err: any) {
        Alert.alert('Recording Note', err?.message || 'Could not complete transcription.');
      }
    } else if (voiceState === 'idle') {
      // Start recording
      try {
        await voiceService.startRecording();
      } catch (err: any) {
        Alert.alert('Microphone Access', err?.message || 'Please grant microphone permissions in Settings.');
      }
    }
  };

  const handleFinishedVenting = () => {
    setShowFinishedPrompt(true);
    handleSend("I'm finished letting it all out for now. Thank you for holding space for me.");
  };

  const starters = isRantMode ? RANT_STARTERS : STANDARD_STARTERS;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Companion Header */}
        <View style={styles.header}>
          <View style={[styles.avatarCircle, isRantMode && styles.avatarCircleRant]}>
            <Ionicons
              name={isRantMode ? 'flame-outline' : 'sparkles'}
              size={18}
              color={isRantMode ? '#B85D3B' : theme.colors.forest}
            />
          </View>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>
                {isRantMode ? 'Just Let It Out' : 'Solace Companion'}
              </Text>
              {isRantMode && (
                <View style={styles.rantActiveBadge}>
                  <Text style={styles.rantActiveBadgeText}>Rant Mode</Text>
                </View>
              )}
            </View>
            <View style={styles.headerSubRow}>
              <View style={[styles.onlineDot, isRantMode && styles.onlineDotRant]} />
              <Text style={styles.headerSubtitle}>
                {isRantMode
                  ? 'Listening freely • No advice or fixing'
                  : appliedMemoriesCount > 0
                  ? `Referenced ${appliedMemoriesCount} personal reflections`
                  : 'Holding space for you'}
              </Text>
            </View>
          </View>

          {/* Sound / TTS Toggle */}
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleToggleTts}
            accessibilityLabel={isTtsEnabled ? 'Disable spoken voice' : 'Enable spoken voice'}
          >
            <Ionicons
              name={isTtsEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
              size={20}
              color={isTtsEnabled ? theme.colors.forest : theme.colors.textMuted}
            />
          </TouchableOpacity>

          {/* New Chat Button */}
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={startNewSession}
            accessibilityLabel="Start new conversation"
          >
            <Ionicons name="create-outline" size={20} color={theme.colors.forest} />
          </TouchableOpacity>
        </View>

        {/* Rant Mode Entry / Exit Floating Banner */}
        <View style={styles.rantModeBanner}>
          <View style={styles.rantBannerLeft}>
            <Ionicons
              name={isRantMode ? 'shield-checkmark-outline' : 'leaf-outline'}
              size={16}
              color={isRantMode ? '#B85D3B' : theme.colors.forest}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.rantBannerText}>
              {isRantMode
                ? 'Free venting active. Advice is paused.'
                : "Need to vent? 'Just Let It Out' mode is ready."}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.rantBannerButton, isRantMode && styles.rantBannerButtonActive]}
            onPress={handleToggleRantMode}
            activeOpacity={0.8}
          >
            <Text style={[styles.rantBannerButtonText, isRantMode && styles.rantBannerButtonTextActive]}>
              {isRantMode ? 'Exit Mode' : 'Let It Out'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Memory Consent Banner */}
        {pendingSuggestion && (
          <View style={styles.memoryConsentBanner}>
            <View style={styles.memoryConsentIconRow}>
              <Ionicons name="bookmark" size={18} color={theme.colors.forest} />
              <Text style={styles.memoryConsentTitle}>Emotional Memory Notice</Text>
            </View>
            <Text style={styles.memoryConsentPrompt}>
              &ldquo;{pendingSuggestion.memory_text}&rdquo;
            </Text>
            <Text style={styles.memoryConsentQuestion}>
              {pendingSuggestion.prompt}
            </Text>
            <View style={styles.memoryConsentActions}>
              <TouchableOpacity
                style={styles.memoryApproveBtn}
                onPress={approveSuggestion}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.memoryApproveText}>Remember this</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.memoryDeclineBtn}
                onPress={declineSuggestion}
                activeOpacity={0.8}
              >
                <Text style={styles.memoryDeclineText}>Keep private</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Voice Playback Status Bar */}
        {voiceState === 'speaking' && (
          <View style={styles.speakingBar}>
            <View style={styles.speakingIndicator}>
              <Ionicons name="volume-medium" size={16} color={theme.colors.forest} />
              <Text style={styles.speakingText}>Solace is speaking aloud...</Text>
            </View>
            <TouchableOpacity onPress={() => voiceService.stopSpeaking()} style={styles.stopSpeakingBtn}>
              <Text style={styles.stopSpeakingText}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Chat Scroll View */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {isGuest ? (
            /* Guest Sanctuary Gate */
            <View style={styles.guestGateContainer}>
              <View style={styles.guestGateIconCircle}>
                <Ionicons name="sparkles" size={28} color={theme.colors.forest} />
              </View>
              <View style={styles.guestGateBadge}>
                <Ionicons name="leaf-outline" size={12} color={theme.colors.forest} style={{ marginRight: 4 }} />
                <Text style={styles.guestGateBadgeText}>Guest Session Active</Text>
              </View>
              <Text style={styles.guestGateTitle}>Private Companion Sanctuary</Text>
              <Text style={styles.guestGateBody}>
                Solace Companion dialogue, live streaming reflection, and consent-based emotional memories are deeply personal.
              </Text>
              <Text style={styles.guestGateSubbody}>
                To protect your emotional privacy and securely persist your journey across sessions, companion conversations require an authenticated account.
              </Text>
              <View style={styles.guestBenefitsList}>
                <View style={styles.guestBenefitItem}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.forest} style={{ marginRight: 8 }} />
                  <Text style={styles.guestBenefitText}>Real-time streaming AI companion dialogue</Text>
                </View>
                <View style={styles.guestBenefitItem}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.forest} style={{ marginRight: 8 }} />
                  <Text style={styles.guestBenefitText}>Consent-based emotional memory personalization</Text>
                </View>
                <View style={styles.guestBenefitItem}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.forest} style={{ marginRight: 8 }} />
                  <Text style={styles.guestBenefitText}>Voice input and spoken responses</Text>
                </View>
              </View>
              <Button
                title="Sign In or Create Account"
                onPress={handleExitGuestToAuth}
                style={styles.guestGateAuthBtn}
              />
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/discover')}
                style={styles.guestGateSecondaryBtn}
              >
                <Text style={styles.guestGateSecondaryText}>Explore local grounding practices in Discover →</Text>
              </TouchableOpacity>
            </View>
          ) : messages.length === 0 && !isStreaming ? (
            /* Empty State */
            <View style={styles.emptyWelcomeState}>
              <View style={[styles.welcomeSymbol, isRantMode && styles.welcomeSymbolRant]}>
                <Ionicons
                  name={isRantMode ? 'flame-outline' : 'leaf-outline'}
                  size={32}
                  color={isRantMode ? '#B85D3B' : theme.colors.forest}
                />
              </View>
              <Text style={styles.welcomeGreeting}>
                {isRantMode ? 'Just Let It Out.' : `Welcome, ${displayName}.`}
              </Text>
              <Text style={styles.welcomeText}>
                {isRantMode
                  ? "Some days, you don't need solutions. You just need a little space to let it all out. Speak or type freely without being fixed."
                  : 'This is your quiet sanctuary. You can share feelings, reflect on a challenge, or simply pause together.'}
              </Text>

              <Text style={styles.starterHeading}>
                {isRantMode ? 'Unburden your heart:' : 'Suggested starters:'}
              </Text>
              <View style={styles.startersList}>
                {starters.map((s, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.starterChip, isRantMode && styles.starterChipRant]}
                    onPress={() => setInputMessage(s)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.starterChipText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            /* Message Bubbles */
            <>
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubbleWrapper,
                      isUser ? styles.userBubbleWrapper : styles.companionBubbleWrapper,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        isUser ? styles.userBubble : styles.companionBubble,
                        isUser && isRantMode && styles.userBubbleRant,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          isUser ? styles.userMessageText : styles.companionMessageText,
                        ]}
                      >
                        {msg.content}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Live Streaming Response Bubble */}
              {isStreaming && (
                <View style={[styles.messageBubbleWrapper, styles.companionBubbleWrapper]}>
                  <View style={[styles.messageBubble, styles.companionBubble]}>
                    {streamingText ? (
                      <Text style={[styles.messageText, styles.companionMessageText]}>
                        {streamingText}
                      </Text>
                    ) : (
                      <View style={styles.thinkingRow}>
                        <ActivityIndicator size="small" color={theme.colors.forest} />
                        <Text style={styles.thinkingText}>
                          {isRantMode ? 'Holding space and listening...' : 'Listening and reflecting...'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Post-Rant Direction Choices */}
              {(isRantMode || showFinishedPrompt) && !isStreaming && messages.length > 0 && (
                <View style={styles.postRantChoicesCard}>
                  <Text style={styles.postRantPromptText}>
                    When you are ready, how would you like Solace to support you?
                  </Text>
                  <View style={styles.postRantButtonsGrid}>
                    {RANT_FINISHED_OPTIONS.map((opt, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.postRantChoiceBtn}
                        onPress={() => handleSend(opt.text)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={opt.icon as any} size={16} color={theme.colors.forest} style={{ marginRight: 6 }} />
                        <Text style={styles.postRantChoiceText}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* "I'm Finished Venting" Quick Action for Rant Mode */}
        {isRantMode && !isGuest && (
          <View style={styles.finishedVentingBar}>
            <TouchableOpacity
              style={styles.finishedVentingBtn}
              onPress={handleFinishedVenting}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={16} color="#B85D3B" style={{ marginRight: 6 }} />
              <Text style={styles.finishedVentingBtnText}>I&apos;m finished venting</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error Notice Bar with safe inspection and manual retry */}
        {error && !isGuest && (
          <View style={styles.errorNoticeBar}>
            <View style={styles.errorNoticeContent}>
              <Ionicons name="information-circle-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.errorNoticeText}>{error}</Text>
            </View>
            <View style={styles.errorNoticeActions}>
              {lastFailedMessage && error.includes("wasn't sent") && (
                <TouchableOpacity
                  style={styles.errorRetryBtn}
                  onPress={retryLastMessage}
                  activeOpacity={0.8}
                >
                  <Text style={styles.errorRetryText}>Retry</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.errorDismissBtn}
                onPress={clearError}
                activeOpacity={0.8}
                accessibilityLabel="Dismiss error"
              >
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Input Bar */}
        {isGuest ? (
          <TouchableOpacity
            style={styles.guestLockedInputBar}
            onPress={handleExitGuestToAuth}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-closed-outline" size={16} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={styles.guestLockedInputText}>Sign in to start mindful dialogue with Solace</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.inputBar}>
            {/* Microphone Button (Voice AI) */}
            <TouchableOpacity
              style={[
                styles.micButton,
                voiceState === 'recording' && styles.micButtonRecording,
                voiceState === 'processing' && styles.micButtonProcessing,
              ]}
              onPress={handleMicrophonePress}
              activeOpacity={0.7}
              accessibilityLabel="Microphone input"
            >
              {voiceState === 'processing' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={voiceState === 'recording' ? 'stop' : 'mic-outline'}
                  size={20}
                  color={voiceState === 'recording' ? '#FFFFFF' : theme.colors.forest}
                />
              )}
            </TouchableOpacity>

            {/* Recording Active Notice or Text Input */}
            {voiceState === 'recording' ? (
              <View style={styles.recordingActiveContainer}>
                <View style={styles.recordingPulseDot} />
                <Text style={styles.recordingActiveText}>Listening to your voice... Tap stop when done</Text>
              </View>
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder={
                  isRantMode
                    ? 'Let it all out... speak or type freely.'
                    : 'Share what is in your heart...'
                }
                placeholderTextColor={theme.colors.textMuted}
                value={inputMessage}
                onChangeText={setInputMessage}
                multiline
                maxLength={1000}
                editable={!isStreaming && voiceState !== 'processing'}
              />
            )}

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputMessage.trim() || isStreaming) && styles.sendButtonDisabled,
              ]}
              onPress={() => handleSend()}
              disabled={!inputMessage.trim() || isStreaming || voiceState === 'recording'}
            >
              {isStreaming ? (
                <ActivityIndicator size="small" color={theme.colors.background} />
              ) : (
                <Ionicons name="arrow-up" size={20} color={theme.colors.background} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  avatarCircleRant: {
    backgroundColor: '#FAECE6',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
  },
  rantActiveBadge: {
    backgroundColor: '#FAECE6',
    borderWidth: 1,
    borderColor: '#E8B4A2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  rantActiveBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: '#B85D3B',
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.statusConnected,
  },
  onlineDotRant: {
    backgroundColor: '#B85D3B',
  },
  headerSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  rantModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3EFE8',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rantBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  rantBannerText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  rantBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rantBannerButtonActive: {
    backgroundColor: '#B85D3B',
    borderColor: '#B85D3B',
  },
  rantBannerButtonText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
  },
  rantBannerButtonTextActive: {
    color: '#FFFFFF',
  },
  speakingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.sageLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  speakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  speakingText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.forest,
  },
  stopSpeakingBtn: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.forest,
  },
  stopSpeakingText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: theme.typography.weights.bold,
  },
  memoryConsentBanner: {
    backgroundColor: theme.colors.lavenderLight,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lavender,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  memoryConsentIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  memoryConsentTitle: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  memoryConsentPrompt: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  memoryConsentQuestion: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  memoryConsentActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  memoryApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  memoryApproveText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.background,
  },
  memoryDeclineBtn: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  memoryDeclineText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyWelcomeState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  welcomeSymbol: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  welcomeSymbolRant: {
    backgroundColor: '#FAECE6',
  },
  welcomeGreeting: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
    marginBottom: theme.spacing.xs,
  },
  welcomeText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  starterHeading: {
    alignSelf: 'flex-start',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  startersList: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  starterChip: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    minHeight: 64,
  },
  starterChipRant: {
    borderColor: '#E8B4A2',
    backgroundColor: '#FCF9F6',
  },
  starterChipText: {
    fontSize: 12,
    color: theme.colors.text,
    lineHeight: 17,
  },
  messageBubbleWrapper: {
    flexDirection: 'row',
  },
  companionBubbleWrapper: {
    justifyContent: 'flex-start',
    paddingRight: 40,
  },
  userBubbleWrapper: {
    justifyContent: 'flex-end',
    paddingLeft: 40,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
  },
  companionBubble: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
    ...theme.shadows.soft,
  },
  userBubble: {
    backgroundColor: theme.colors.forest,
    borderBottomRightRadius: 4,
  },
  userBubbleRant: {
    backgroundColor: '#8C482E',
  },
  messageText: {
    fontSize: theme.typography.sizes.sm + 1,
    lineHeight: 22,
  },
  companionMessageText: {
    color: theme.colors.text,
  },
  userMessageText: {
    color: theme.colors.background,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  thinkingText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  postRantChoicesCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginVertical: 4,
    gap: 10,
  },
  postRantPromptText: {
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  postRantButtonsGrid: {
    gap: 8,
  },
  postRantChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  postRantChoiceText: {
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.forest,
    fontWeight: theme.typography.weights.semibold,
  },
  finishedVentingBar: {
    backgroundColor: '#FAF5EE',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8DEC8',
    alignItems: 'center',
  },
  finishedVentingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: '#E0B5A2',
    shadowColor: '#B85D3B',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  finishedVentingBtnText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: '#B85D3B',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonRecording: {
    backgroundColor: '#D32F2F',
    borderColor: '#B71C1C',
  },
  micButtonProcessing: {
    backgroundColor: theme.colors.forest,
  },
  recordingActiveContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: theme.radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  recordingPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D32F2F',
  },
  recordingActiveText: {
    fontSize: 12,
    color: '#C62828',
    fontWeight: theme.typography.weights.medium,
  },
  textInput: {
    flex: 1,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.border,
    opacity: 0.6,
  },
  guestGateContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    marginVertical: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.sage,
  },
  guestGateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  guestGateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.sm,
  },
  guestGateBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.forest,
  },
  guestGateTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  guestGateBody: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 6,
  },
  guestGateSubbody: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.lg,
  },
  guestBenefitsList: {
    width: '100%',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  guestBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestBenefitText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  guestGateAuthBtn: {
    width: '100%',
    backgroundColor: theme.colors.forest,
    marginBottom: theme.spacing.sm,
  },
  guestGateSecondaryBtn: {
    paddingVertical: 6,
  },
  guestGateSecondaryText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.forest,
    fontWeight: theme.typography.weights.semibold,
  },
  guestLockedInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    backgroundColor: theme.colors.surfaceMuted,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  guestLockedInputText: {
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.forest,
    fontWeight: theme.typography.weights.medium,
  },
  errorNoticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  errorNoticeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  errorNoticeText: {
    flex: 1,
    fontSize: theme.typography.sizes.xs,
    color: '#92400E',
    lineHeight: 16,
    fontWeight: theme.typography.weights.medium,
  },
  errorNoticeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorRetryBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  errorRetryText: {
    fontSize: theme.typography.sizes.xs,
    color: '#FFFFFF',
    fontWeight: theme.typography.weights.semibold,
  },
  errorDismissBtn: {
    padding: 4,
  },
});
