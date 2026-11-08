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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useMemoryStore } from '@/store/useMemoryStore';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

const CONVERSATION_STARTERS = [
  "I'm feeling a bit restless and need to untangle my thoughts.",
  "Something happened today that left me feeling unsettled.",
  "Can you guide me through a gentle grounding pause?",
  "I'd like to celebrate a small win I had today.",
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
    appliedMemoriesCount,
    loadSessions,
    startNewSession,
    sendMessage,
    retryLastMessage,
    clearError,
  } = useChatStore();

  const { pendingSuggestion, approveSuggestion, declineSuggestion, isMemoryEnabled } = useMemoryStore();

  const [inputMessage, setInputMessage] = useState('');
  const scrollViewRef = useRef<any>(null);
  const displayName = profile?.preferred_name || profile?.display_name || (isGuest ? 'Explorer' : 'Friend');

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Auto-scroll when new messages arrive or during streaming
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, streamingText]);

  // Handle Android hardware back press when memory consent banner is active
  useEffect(() => {
    if (Platform.OS === 'android') {
      const onBackPress = () => {
        if (pendingSuggestion) {
          declineSuggestion();
          return true; // Consume event to dismiss memory banner without leaving screen
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }
  }, [pendingSuggestion, declineSuggestion]);

  const handleSend = async () => {
    const text = inputMessage.trim();
    if (!text || isStreaming) return;

    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }

    setInputMessage('');
    await sendMessage(text);
  };

  const handleSelectStarter = (starter: string) => {
    setInputMessage(starter);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Companion Header */}
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Ionicons name="sparkles" size={18} color={theme.colors.forest} />
          </View>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Solace Companion</Text>
            <View style={styles.headerSubRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerSubtitle}>
                {appliedMemoriesCount > 0
                  ? `Referenced ${appliedMemoriesCount} personal reflections`
                  : 'Holding space for you'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.newChatButton}
            onPress={startNewSession}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Start new conversation"
          >
            <Ionicons name="create-outline" size={22} color={theme.colors.forest} />
          </TouchableOpacity>
        </View>

        {/* Memory Consent Banner (Signature Feature) */}
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
              >
                <Ionicons name="checkmark" size={16} color={theme.colors.background} style={{ marginRight: 4 }} />
                <Text style={styles.memoryApproveText}>Remember this</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.memoryDeclineBtn}
                onPress={declineSuggestion}
              >
                <Text style={styles.memoryDeclineText}>Do not remember</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error / Offline Alert */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.statusDisconnected} style={{ marginRight: 6 }} />
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={retryLastMessage} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Message Thread */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isGuest ? (
            <View style={styles.guestGateContainer}>
              <View style={styles.guestGateIconCircle}>
                <Ionicons name="sparkles" size={32} color={theme.colors.forest} />
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
                  <Text style={styles.guestBenefitText}>Private cloud session persistence across devices</Text>
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
            <View style={styles.emptyWelcomeState}>
              <View style={styles.welcomeSymbol}>
                <Ionicons name="leaf-outline" size={32} color={theme.colors.forest} />
              </View>
              <Text style={styles.welcomeGreeting}>Welcome, {displayName}.</Text>
              <Text style={styles.welcomeText}>
                This is your quiet sanctuary. You can share feelings, reflect on a challenge, or simply pause together.
              </Text>

              <Text style={styles.starterHeading}>Suggested starters:</Text>
              <View style={styles.startersList}>
                {CONVERSATION_STARTERS.map((s, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.starterChip}
                    onPress={() => handleSelectStarter(s)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.starterChipText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
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
                        <Text style={styles.thinkingText}>Listening and reflecting...</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

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
            <TextInput
              style={styles.textInput}
              placeholder="Share what is in your heart..."
              placeholderTextColor={theme.colors.textMuted}
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline
              maxLength={1000}
              editable={!isStreaming}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputMessage.trim() || isStreaming) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputMessage.trim() || isStreaming}
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
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
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
  headerSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  newChatButton: {
    padding: theme.spacing.xs,
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
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.statusPillBgDisconnected,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F2C5C3',
  },
  errorBannerText: {
    flex: 1,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.statusDisconnected,
  },
  retryBtn: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  retryBtnText: {
    color: theme.colors.background,
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
    flexGrow: 1,
  },
  emptyWelcomeState: {
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: theme.spacing.sm,
  },
  starterChip: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  starterChipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: 18,
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
});
