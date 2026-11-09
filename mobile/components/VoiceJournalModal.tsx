import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { theme } from '@/constants/theme';
import { useJournalStore } from '@/store/useJournalStore';
import { useAuthStore } from '@/store/useAuthStore';
import { JournalEntry } from '@/types/journal';

const brandColors = {
  primary: theme.colors.forest,
  primaryLight: theme.colors.forestLight,
  accentBg: theme.colors.sageLight,
  text: theme.colors.text,
  textSecondary: theme.colors.textSecondary,
  textMuted: theme.colors.textMuted,
  border: theme.colors.border,
  background: theme.colors.background,
  surface: theme.colors.surface,
  surfaceMuted: theme.colors.surfaceMuted,
  warmAccent: '#B5835A',
  warmBg: '#FBF5EF',
  crisisBg: '#FDF2F2',
  crisisBorder: '#E07A7A',
};

const MOOD_TAGS = [
  { id: 'peaceful', label: 'Peaceful', icon: 'sunny-outline' },
  { id: 'reflective', label: 'Reflective', icon: 'water-outline' },
  { id: 'anxious', label: 'Anxious', icon: 'cloud-outline' },
  { id: 'heavy', label: 'Heavy', icon: 'rainy-outline' },
  { id: 'hopeful', label: 'Hopeful', icon: 'sparkles-outline' },
  { id: 'grateful', label: 'Grateful', icon: 'heart-outline' },
];

interface VoiceJournalModalProps {
  visible: boolean;
  onClose: () => void;
}

export const VoiceJournalModal: React.FC<VoiceJournalModalProps> = ({ visible, onClose }) => {
  const { isGuest } = useAuthStore();
  const {
    isRecording,
    isProcessing,
    recordingDuration,
    activeDraft,
    activeReflection,
    isReflecting,
    isSaving,
    entries,
    selectedEntry,
    isLoadingEntries,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    setDraftTranscript,
    setDraftTitle,
    setDraftMood,
    clearDraft,
    requestReflection,
    saveCurrentDraft,
    fetchEntries,
    selectEntry,
    updateEntry,
    deleteEntry,
    clearError,
  } = useJournalStore();

  const [activeTab, setActiveTab] = useState<'record' | 'collection'>('record');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditingEntry, setIsEditingEntry] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editTranscript, setEditTranscript] = useState<string>('');

  useEffect(() => {
    if (visible) {
      fetchEntries();
    }
  }, [visible, fetchEntries]);

  // Sync edit state when selecting an entry
  useEffect(() => {
    if (selectedEntry) {
      setEditTitle(selectedEntry.title);
      setEditTranscript(selectedEntry.transcript);
      setIsEditingEntry(false);
    }
  }, [selectedEntry]);

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleRecord = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleCancelRecord = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    await cancelRecording();
  };

  const handleSaveDraft = async () => {
    const saved = await saveCurrentDraft();
    if (saved) {
      Alert.alert(
        'Journal Saved',
        isGuest
          ? 'Your voice journal entry has been saved privately on your device.'
          : 'Your voice journal entry has been saved to your private sanctuary.',
        [{ text: 'View Entries', onPress: () => setActiveTab('collection') }, { text: 'Done' }]
      );
    }
  };

  const handleDiscardDraft = () => {
    Alert.alert(
      'Discard Journal Draft?',
      'Are you sure you want to discard this spoken draft? This action cannot be undone.',
      [
        { text: 'Keep Draft', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            clearDraft();
            if (Platform.OS !== 'web') {
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch {}
            }
          },
        },
      ]
    );
  };

  const handleCopyText = async (text: string, id: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedId(id);
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDeleteEntry = (id: string) => {
    Alert.alert(
      'Delete Journal Entry?',
      'Are you sure you want to delete this private journal entry permanently?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(id);
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!selectedEntry) return;
    await updateEntry(selectedEntry.id, {
      title: editTitle,
      transcript: editTranscript,
    });
    setIsEditingEntry(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.badgeRow}>
              <Ionicons name="mic-outline" size={14} color={brandColors.warmAccent} />
              <Text style={styles.badgeText}>VOICE JOURNAL</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={brandColors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>Private Audio Sanctuary</Text>
          <Text style={styles.headerSubtitle}>
            Some thoughts are easier to speak than write. This is your space to let them out.
          </Text>

          {/* Tab Navigation */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'record' && styles.tabBtnActive]}
              onPress={() => {
                setActiveTab('record');
                selectEntry(null);
              }}
            >
              <Ionicons
                name="mic"
                size={16}
                color={activeTab === 'record' ? brandColors.primary : brandColors.textMuted}
              />
              <Text style={[styles.tabBtnText, activeTab === 'record' && styles.tabBtnTextActive]}>
                Speak a Thought
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'collection' && styles.tabBtnActive]}
              onPress={() => setActiveTab('collection')}
            >
              <Ionicons
                name="book-outline"
                size={16}
                color={activeTab === 'collection' ? brandColors.primary : brandColors.textMuted}
              />
              <Text style={[styles.tabBtnText, activeTab === 'collection' && styles.tabBtnTextActive]}>
                Sanctuary ({entries.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Global Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#C53030" />
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={clearError}>
              <Ionicons name="close-circle" size={16} color="#C53030" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Tab 1: Record & Review/Edit Draft */}
        {activeTab === 'record' ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Ephemeral Privacy Notice */}
            <View style={styles.privacyCard}>
              <Ionicons name="shield-checkmark-outline" size={18} color={brandColors.primary} />
              <View style={styles.privacyTextContainer}>
                <Text style={styles.privacyCardTitle}>Ephemeral & Protected Audio</Text>
                <Text style={styles.privacyCardDesc}>
                  Audio is processed by the AI provider to transcribe your speech and immediately purged.
                  Transcripts remain temporary drafts until you explicitly save. Never added to conversational memory.
                </Text>
              </View>
            </View>

            {/* If no active draft: Show Recording Controller */}
            {!activeDraft ? (
              <View style={styles.recordingCard}>
                <View style={[styles.micRing, isRecording && styles.micRingRecording]}>
                  <TouchableOpacity
                    style={[styles.micButton, isRecording && styles.micButtonRecording]}
                    onPress={handleToggleRecord}
                    disabled={isProcessing}
                    activeOpacity={0.8}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="large" color="#FFFFFF" />
                    ) : (
                      <Ionicons
                        name={isRecording ? 'stop' : 'mic'}
                        size={38}
                        color="#FFFFFF"
                      />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Duration / Status */}
                <Text style={styles.timerText}>
                  {isRecording ? formatTimer(recordingDuration) : isProcessing ? 'Transcribing...' : 'Tap to Speak'}
                </Text>

                <Text style={styles.recordHint}>
                  {isRecording
                    ? 'Speak freely. Tap the square when you are finished.'
                    : isProcessing
                    ? 'Gently translating your spoken words into text...'
                    : 'Unfiltered, unhurried, non-judgmental.'}
                </Text>

                {isRecording && (
                  <TouchableOpacity style={styles.cancelRecBtn} onPress={handleCancelRecord}>
                    <Ionicons name="close" size={16} color={brandColors.textMuted} />
                    <Text style={styles.cancelRecText}>Cancel Recording</Text>
                  </TouchableOpacity>
                )}

                {/* Or type directly */}
                {!isRecording && !isProcessing && (
                  <TouchableOpacity
                    style={styles.textFallbackBtn}
                    onPress={() => {
                      setDraftTranscript('');
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color={brandColors.primary} />
                    <Text style={styles.textFallbackText}>Or write with keyboard instead</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              /* If active draft: Mandatory Review & Edit View */
              <View style={styles.draftContainer}>
                <View style={styles.draftHeaderRow}>
                  <View style={styles.draftBadge}>
                    <Ionicons name="pencil-outline" size={14} color={brandColors.primary} />
                    <Text style={styles.draftBadgeText}>REVIEW & EDIT DRAFT</Text>
                  </View>
                  <Text style={styles.draftDuration}>
                    {activeDraft.duration_seconds > 0 ? `${formatTimer(activeDraft.duration_seconds)} audio` : 'Text Draft'}
                  </Text>
                </View>

                {/* Editable Title */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Title</Text>
                  <TextInput
                    style={styles.titleInput}
                    value={activeDraft.title}
                    onChangeText={setDraftTitle}
                    placeholder="Give your thought a name..."
                    placeholderTextColor={brandColors.textMuted}
                    maxLength={100}
                  />
                </View>

                {/* Mood Tag Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>How did it feel to express this?</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRow}>
                    {MOOD_TAGS.map((m) => {
                      const isSelected = activeDraft.mood_tag === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.moodChip, isSelected && styles.moodChipSelected]}
                          onPress={() => setDraftMood(isSelected ? undefined : m.id)}
                        >
                          <Ionicons
                            name={m.icon as any}
                            size={14}
                            color={isSelected ? brandColors.primary : brandColors.textSecondary}
                          />
                          <Text style={[styles.moodChipText, isSelected && styles.moodChipTextSelected]}>
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Mandatory Editable Transcript */}
                <View style={styles.inputGroup}>
                  <View style={styles.transcriptLabelRow}>
                    <Text style={styles.inputLabel}>Spoken Transcript</Text>
                    <Text style={styles.charCountText}>
                      {activeDraft.transcript.length} chars ({activeDraft.transcript.trim().split(/\s+/).filter(Boolean).length} words)
                    </Text>
                  </View>
                  <TextInput
                    style={styles.transcriptInput}
                    value={activeDraft.transcript}
                    onChangeText={setDraftTranscript}
                    placeholder="Review, correct, or add to your thoughts here..."
                    placeholderTextColor={brandColors.textMuted}
                    multiline
                    textAlignVertical="top"
                  />
                  <Text style={styles.editHintText}>
                    Feel free to correct any misheard words or remove anything private before saving.
                  </Text>
                </View>

                {/* Optional AI Reflection Section */}
                {activeReflection ? (
                  <View style={[styles.reflectionCard, activeReflection.is_crisis_override && styles.crisisCard]}>
                    <View style={styles.reflectionHeader}>
                      <Ionicons
                        name={activeReflection.is_crisis_override ? 'heart-outline' : 'sparkles-outline'}
                        size={16}
                        color={activeReflection.is_crisis_override ? '#C53030' : brandColors.warmAccent}
                      />
                      <Text
                        style={[
                          styles.reflectionTitle,
                          activeReflection.is_crisis_override && styles.crisisTitle,
                        ]}
                      >
                        {activeReflection.is_crisis_override ? 'Support & Crisis Resources' : 'Grounded Reflection'}
                      </Text>
                    </View>
                    <Text style={styles.reflectionContent}>{activeReflection.reflection}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.reflectionPromptBtn}
                    onPress={requestReflection}
                    disabled={isReflecting || !activeDraft.transcript.trim()}
                  >
                    {isReflecting ? (
                      <ActivityIndicator size="small" color={brandColors.primary} />
                    ) : (
                      <>
                        <Ionicons name="sparkles" size={16} color={brandColors.warmAccent} />
                        <Text style={styles.reflectionPromptText}>Reflect on this entry (Optional AI Mirror)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Action Row: Save or Discard */}
                <View style={styles.draftActionsRow}>
                  <TouchableOpacity
                    style={styles.saveDraftBtn}
                    onPress={handleSaveDraft}
                    disabled={isSaving || !activeDraft.transcript.trim()}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.saveDraftBtnText}>Save Journal Entry</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.discardDraftBtn} onPress={handleDiscardDraft} disabled={isSaving}>
                    <Ionicons name="trash-outline" size={18} color={brandColors.textMuted} />
                    <Text style={styles.discardDraftBtnText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        ) : (
          /* Tab 2: Saved Journal Collection / Sanctuary */
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* If an entry is selected, show its full detail */}
            {selectedEntry ? (
              <View style={styles.detailContainer}>
                <TouchableOpacity style={styles.backToListBtn} onPress={() => selectEntry(null)}>
                  <Ionicons name="arrow-back" size={18} color={brandColors.primary} />
                  <Text style={styles.backToListText}>Back to Collection</Text>
                </TouchableOpacity>

                {isEditingEntry ? (
                  <View style={styles.editSection}>
                    <Text style={styles.inputLabel}>Title</Text>
                    <TextInput
                      style={styles.titleInput}
                      value={editTitle}
                      onChangeText={setEditTitle}
                      placeholder="Title"
                      placeholderTextColor={brandColors.textMuted}
                    />

                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>Transcript</Text>
                    <TextInput
                      style={styles.transcriptInput}
                      value={editTranscript}
                      onChangeText={setEditTranscript}
                      multiline
                      textAlignVertical="top"
                    />

                    <View style={styles.editActionRow}>
                      <TouchableOpacity style={styles.saveEditBtn} onPress={handleSaveEdit}>
                        <Text style={styles.saveEditBtnText}>Save Changes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setIsEditingEntry(false)}>
                        <Text style={styles.cancelEditBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.detailCard}>
                    <View style={styles.detailMetaRow}>
                      <Text style={styles.detailDate}>
                        {new Date(selectedEntry.created_at).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      {selectedEntry.duration_seconds > 0 && (
                        <View style={styles.durationTag}>
                          <Ionicons name="mic-outline" size={12} color={brandColors.textMuted} />
                          <Text style={styles.durationTagText}>
                            {formatTimer(selectedEntry.duration_seconds)}
                          </Text>
                        </View>
                      )}
                      {selectedEntry.mood_tag && (
                        <View style={styles.moodTagBadge}>
                          <Text style={styles.moodTagBadgeText}>{selectedEntry.mood_tag}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.detailTitle}>{selectedEntry.title}</Text>
                    <Text style={styles.detailTranscript}>{selectedEntry.transcript}</Text>

                    {selectedEntry.reflection && (
                      <View style={styles.detailReflectionBox}>
                        <View style={styles.reflectionHeader}>
                          <Ionicons name="sparkles" size={14} color={brandColors.warmAccent} />
                          <Text style={styles.reflectionTitle}>Reflective Mirror</Text>
                        </View>
                        <Text style={styles.detailReflectionText}>{selectedEntry.reflection}</Text>
                      </View>
                    )}

                    <View style={styles.detailActionsRow}>
                      <TouchableOpacity
                        style={styles.detailActionBtn}
                        onPress={() => handleCopyText(selectedEntry.transcript, selectedEntry.id)}
                      >
                        <Ionicons
                          name={copiedId === selectedEntry.id ? 'checkmark' : 'copy-outline'}
                          size={16}
                          color={brandColors.primary}
                        />
                        <Text style={styles.detailActionText}>
                          {copiedId === selectedEntry.id ? 'Copied' : 'Copy'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.detailActionBtn} onPress={() => setIsEditingEntry(true)}>
                        <Ionicons name="create-outline" size={16} color={brandColors.primary} />
                        <Text style={styles.detailActionText}>Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.detailActionBtn}
                        onPress={() => handleDeleteEntry(selectedEntry.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#C53030" />
                        <Text style={[styles.detailActionText, { color: '#C53030' }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ) : isLoadingEntries ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={brandColors.primary} />
                <Text style={styles.loadingText}>Opening your sanctuary...</Text>
              </View>
            ) : entries.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="journal-outline" size={36} color={brandColors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>Your Voice Journal is Empty</Text>
                <Text style={styles.emptySubtitle}>
                  Whenever feelings feel too tangled to write, speak them out. They will wait for you here.
                </Text>
                <TouchableOpacity style={styles.startSpeakingBtn} onPress={() => setActiveTab('record')}>
                  <Ionicons name="mic" size={18} color="#FFFFFF" />
                  <Text style={styles.startSpeakingBtnText}>Speak Your First Entry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Collection List */
              <View style={styles.collectionList}>
                {entries.map((entry) => (
                  <TouchableOpacity
                    key={entry.id}
                    style={styles.entryCard}
                    onPress={() => selectEntry(entry)}
                    activeOpacity={0.88}
                  >
                    <View style={styles.entryCardHeader}>
                      <Text style={styles.entryCardDate}>
                        {new Date(entry.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      <View style={styles.entryBadgeRow}>
                        {entry.duration_seconds > 0 && (
                          <View style={styles.durationPill}>
                            <Ionicons name="mic-outline" size={11} color={brandColors.textMuted} />
                            <Text style={styles.durationPillText}>{formatTimer(entry.duration_seconds)}</Text>
                          </View>
                        )}
                        {entry.mood_tag && (
                          <View style={styles.moodPill}>
                            <Text style={styles.moodPillText}>{entry.mood_tag}</Text>
                          </View>
                        )}
                        {entry.reflection && (
                          <View style={styles.reflectionPill}>
                            <Ionicons name="sparkles" size={10} color={brandColors.warmAccent} />
                          </View>
                        )}
                      </View>
                    </View>

                    <Text style={styles.entryCardTitle} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <Text style={styles.entryCardSnippet} numberOfLines={2}>
                      {entry.transcript}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: brandColors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: brandColors.warmBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: brandColors.warmAccent,
    letterSpacing: 0.6,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: theme.typography.weights.semibold,
    color: brandColors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: brandColors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: brandColors.surfaceMuted,
    borderRadius: 12,
    padding: 3,
    marginTop: 2,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: brandColors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    color: brandColors.textMuted,
  },
  tabBtnTextActive: {
    color: brandColors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7D7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#C53030',
    marginHorizontal: 8,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  privacyCard: {
    flexDirection: 'row',
    backgroundColor: brandColors.accentBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  privacyTextContainer: {
    flex: 1,
  },
  privacyCardTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: brandColors.primary,
    marginBottom: 2,
  },
  privacyCardDesc: {
    fontSize: 11,
    color: brandColors.textSecondary,
    lineHeight: 16,
  },
  recordingCard: {
    backgroundColor: brandColors.surface,
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: brandColors.border,
    shadowColor: '#30332F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  micRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#F0F4F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  micRingRecording: {
    backgroundColor: '#FDECEC',
  },
  micButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: brandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: brandColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  micButtonRecording: {
    backgroundColor: '#E05252',
    shadowColor: '#E05252',
  },
  timerText: {
    fontSize: 22,
    fontWeight: theme.typography.weights.bold,
    color: brandColors.text,
    letterSpacing: 0.5,
  },
  recordHint: {
    fontSize: 13,
    color: brandColors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 260,
  },
  cancelRecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: brandColors.surfaceMuted,
  },
  cancelRecText: {
    fontSize: 12,
    color: brandColors.textMuted,
  },
  textFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  textFallbackText: {
    fontSize: 12,
    color: brandColors.primary,
    fontWeight: theme.typography.weights.medium,
  },
  draftContainer: {
    backgroundColor: brandColors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  draftHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  draftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: brandColors.accentBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  draftBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: brandColors.primary,
    letterSpacing: 0.5,
  },
  draftDuration: {
    fontSize: 11,
    color: brandColors.textMuted,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: brandColors.textSecondary,
    marginBottom: 6,
  },
  titleInput: {
    backgroundColor: brandColors.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: brandColors.text,
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  moodRow: {
    gap: 8,
    paddingVertical: 2,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: brandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  moodChipSelected: {
    backgroundColor: brandColors.accentBg,
    borderColor: brandColors.primary,
  },
  moodChipText: {
    fontSize: 12,
    color: brandColors.textSecondary,
  },
  moodChipTextSelected: {
    color: brandColors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  transcriptLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCountText: {
    fontSize: 11,
    color: brandColors.textMuted,
  },
  transcriptInput: {
    backgroundColor: brandColors.surfaceMuted,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    lineHeight: 22,
    color: brandColors.text,
    borderWidth: 1,
    borderColor: brandColors.border,
    minHeight: 120,
  },
  editHintText: {
    fontSize: 11,
    color: brandColors.textMuted,
    marginTop: 4,
  },
  reflectionCard: {
    backgroundColor: brandColors.warmBg,
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#EFE2D3',
  },
  crisisCard: {
    backgroundColor: brandColors.crisisBg,
    borderColor: brandColors.crisisBorder,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  reflectionTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: brandColors.warmAccent,
    letterSpacing: 0.4,
  },
  crisisTitle: {
    color: '#C53030',
  },
  reflectionContent: {
    fontSize: 13,
    color: brandColors.text,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  reflectionPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: brandColors.warmBg,
    borderWidth: 1,
    borderColor: '#EAD9C8',
    marginVertical: 10,
  },
  reflectionPromptText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: brandColors.warmAccent,
  },
  draftActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  saveDraftBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: brandColors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: brandColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  saveDraftBtnText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semibold,
    color: '#FFFFFF',
  },
  discardDraftBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: brandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  discardDraftBtnText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    color: brandColors.textMuted,
  },
  detailContainer: {
    gap: 14,
  },
  backToListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backToListText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    color: brandColors.primary,
  },
  detailCard: {
    backgroundColor: brandColors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailDate: {
    fontSize: 12,
    color: brandColors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  durationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: brandColors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  durationTagText: {
    fontSize: 10,
    color: brandColors.textMuted,
  },
  moodTagBadge: {
    backgroundColor: brandColors.accentBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  moodTagBadgeText: {
    fontSize: 10,
    color: brandColors.primary,
    fontWeight: theme.typography.weights.medium,
    textTransform: 'capitalize',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.semibold,
    color: brandColors.text,
    marginBottom: 10,
  },
  detailTranscript: {
    fontSize: 14,
    lineHeight: 22,
    color: brandColors.text,
  },
  detailReflectionBox: {
    backgroundColor: brandColors.warmBg,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#EFE2D3',
  },
  detailReflectionText: {
    fontSize: 13,
    lineHeight: 19,
    color: brandColors.text,
    fontStyle: 'italic',
  },
  detailActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: brandColors.border,
  },
  detailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailActionText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: brandColors.primary,
  },
  editSection: {
    backgroundColor: brandColors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  editActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  saveEditBtn: {
    flex: 1,
    backgroundColor: brandColors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveEditBtnText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semibold,
    color: '#FFFFFF',
  },
  cancelEditBtn: {
    flex: 1,
    backgroundColor: brandColors.surfaceMuted,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  cancelEditBtnText: {
    fontSize: 13,
    color: brandColors.textMuted,
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: brandColors.textSecondary,
    marginTop: 10,
  },
  emptyContainer: {
    paddingVertical: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: brandColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: theme.typography.weights.semibold,
    color: brandColors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: brandColors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
    marginBottom: 20,
  },
  startSpeakingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: brandColors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  startSpeakingBtnText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semibold,
    color: '#FFFFFF',
  },
  collectionList: {
    gap: 12,
  },
  entryCard: {
    backgroundColor: brandColors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: brandColors.border,
    shadowColor: '#30332F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  entryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  entryCardDate: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: brandColors.textMuted,
  },
  entryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: brandColors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  durationPillText: {
    fontSize: 10,
    color: brandColors.textMuted,
  },
  moodPill: {
    backgroundColor: brandColors.accentBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  moodPillText: {
    fontSize: 10,
    color: brandColors.primary,
    fontWeight: theme.typography.weights.medium,
    textTransform: 'capitalize',
  },
  reflectionPill: {
    backgroundColor: brandColors.warmBg,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  entryCardTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semibold,
    color: brandColors.text,
    marginBottom: 4,
  },
  entryCardSnippet: {
    fontSize: 13,
    lineHeight: 18,
    color: brandColors.textSecondary,
  },
});

export default VoiceJournalModal;
