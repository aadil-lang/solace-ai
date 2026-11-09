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
import { usePoetryStore } from '@/store/usePoetryStore';
import { useAuthStore } from '@/store/useAuthStore';
import { PoetryFormat, PoetryTheme, SavedPoem } from '@/types';

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
};

interface PoetryModalProps {
  visible: boolean;
  onClose: () => void;
}

const FORMAT_OPTIONS: { id: PoetryFormat; label: string; sublabel: string; icon: string }[] = [
  { id: 'english', label: 'English', sublabel: 'Contemporary Lyric', icon: 'book-outline' },
  { id: 'urdu_nastaliq', label: 'اردو', sublabel: 'Urdu Script (Nastaliq)', icon: 'pencil-outline' },
  { id: 'bilingual', label: 'Bilingual', sublabel: 'Urdu + English', icon: 'swap-horizontal-outline' },
  { id: 'roman_urdu', label: 'Roman Urdu', sublabel: 'Phonetic Script', icon: 'text-outline' },
];

const THEME_OPTIONS: { id: PoetryTheme; label: string; icon: string }[] = [
  { id: 'moment_of_calm', label: 'Finding Calm (Sukoon)', icon: 'leaf-outline' },
  { id: 'resilience', label: 'Quiet Resilience', icon: 'shield-checkmark-outline' },
  { id: 'patience', label: 'Patience (Sabar)', icon: 'hourglass-outline' },
  { id: 'hope', label: 'Grounded Hope', icon: 'sunny-outline' },
  { id: 'self_reliance', label: 'Self-Reliance (Khudi)', icon: 'compass-outline' },
  { id: 'overwhelmed', label: 'Releasing Overwhelm', icon: 'cloud-outline' },
  { id: 'growth', label: 'Personal Growth', icon: 'trending-up-outline' },
  { id: 'understood', label: 'Feeling Understood', icon: 'heart-outline' },
];

export const PoetryModal: React.FC<PoetryModalProps> = ({ visible, onClose }) => {
  const { isGuest } = useAuthStore();
  const {
    selectedFormat,
    selectedTheme,
    userContext,
    activePoem,
    savedPoems,
    isGenerating,
    isSaving,
    isLoadingSaved,
    isCurrentPoemSaved,
    error,
    setFormat,
    setTheme,
    setUserContext,
    generatePoem,
    regeneratePoem,
    saveCurrentPoem,
    fetchSavedPoems,
    deletePoem,
    clearActivePoem,
    clearError,
  } = usePoetryStore();

  const [activeTab, setActiveTab] = useState<'compose' | 'saved'>('compose');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [expandedPoemId, setExpandedPoemId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && activeTab === 'saved') {
      fetchSavedPoems();
    }
  }, [visible, activeTab, fetchSavedPoems]);

  const handleSelectFormat = async (fmt: PoetryFormat) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    setFormat(fmt);
  };

  const handleSelectTheme = async (thm: PoetryTheme) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    setTheme(thm);
  };

  const handleGenerate = async () => {
    clearError();
    await generatePoem();
  };

  const handleCopy = async (textToCopy: string) => {
    const success = await Clipboard.setStringAsync(textToCopy);
    if (success === false) {
      Alert.alert(
        'Clipboard Notice',
        'System clipboard copying is not available in this preview environment.'
      );
      return;
    }
    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  const handleSave = async () => {
    const success = await saveCurrentPoem();
    if (success) {
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
    }
  };

  const handleDeleteSaved = (id: string, title: string) => {
    Alert.alert(
      'Remove Poem',
      `Are you sure you want to remove "${title}" from your saved words?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deletePoem(id);
          },
        },
      ]
    );
  };

  const getFullPoemText = (p: { title: string; lines: string[]; secondary_lines?: string[] | null; reflection: string }) => {
    let result = `${p.title}\n\n`;
    if (p.secondary_lines && p.secondary_lines.length > 0) {
      p.lines.forEach((l, idx) => {
        result += `${l}\n`;
        if (p.secondary_lines && p.secondary_lines[idx]) {
          result += `${p.secondary_lines[idx]}\n`;
        }
        result += '\n';
      });
    } else {
      result += p.lines.join('\n') + '\n\n';
    }
    result += `Reflection: ${p.reflection}`;
    return result;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="sparkles" size={16} color={theme.colors.forest} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Words of Solace</Text>
              <Text style={styles.headerSubtitle}>Contemplative poetry for quiet moments</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close poetry sanctuary">
            <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'compose' && styles.tabButtonActive]}
            onPress={() => setActiveTab('compose')}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={activeTab === 'compose' ? brandColors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'compose' && styles.tabTextActive]}>Compose</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'saved' && styles.tabButtonActive]}
            onPress={() => {
              setActiveTab('saved');
              fetchSavedPoems();
            }}
          >
            <Ionicons
              name="bookmark-outline"
              size={16}
              color={activeTab === 'saved' ? brandColors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>Saved Words</Text>
            {savedPoems.length > 0 && (
              <View style={styles.savedCountBadge}>
                <Text style={styles.savedCountText}>{savedPoems.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'compose' ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Active Poem Display (if generated) */}
            {activePoem ? (
              <View style={styles.poemCard}>
                <View style={styles.poemCardHeader}>
                  <View style={styles.poemFormatTag}>
                    <Text style={styles.poemFormatTagText}>
                      {selectedFormat === 'urdu_nastaliq'
                        ? 'اردو رسم الخط'
                        : selectedFormat === 'bilingual'
                        ? 'Bilingual (اردو + EN)'
                        : selectedFormat === 'roman_urdu'
                        ? 'Roman Urdu'
                        : 'English Lyric'}
                    </Text>
                  </View>
                  <View style={styles.poemActionsRow}>
                    <TouchableOpacity
                      style={styles.iconAction}
                      onPress={() => handleCopy(getFullPoemText(activePoem))}
                      accessibilityLabel="Copy poem"
                    >
                      <Ionicons
                        name={copiedNotice ? 'checkmark-circle' : 'copy-outline'}
                        size={18}
                        color={copiedNotice ? '#2E7D32' : theme.colors.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveActionButton, isCurrentPoemSaved && styles.saveActionButtonSaved]}
                      onPress={handleSave}
                      disabled={isSaving || isCurrentPoemSaved}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons
                            name={isCurrentPoemSaved ? 'bookmark' : 'bookmark-outline'}
                            size={14}
                            color={isCurrentPoemSaved ? '#FFFFFF' : brandColors.primary}
                          />
                          <Text
                            style={[
                              styles.saveActionText,
                              isCurrentPoemSaved && styles.saveActionTextSaved,
                            ]}
                          >
                            {isCurrentPoemSaved ? 'Saved' : 'Save'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Poem Title */}
                <Text
                  style={[
                    styles.poemTitle,
                    selectedFormat === 'urdu_nastaliq' && styles.urduRtlText,
                  ]}
                >
                  {activePoem.title}
                </Text>

                <View style={styles.titleDivider} />

                {/* Lines */}
                <View style={styles.poemLinesContainer}>
                  {activePoem.lines.map((line, idx) => {
                    const isUrdu = selectedFormat === 'urdu_nastaliq' || selectedFormat === 'bilingual';
                    const secondary = activePoem.secondary_lines ? activePoem.secondary_lines[idx] : null;

                    return (
                      <View key={idx} style={styles.linePairContainer}>
                        <Text
                          style={[
                            styles.primaryPoemLine,
                            isUrdu && styles.urduScriptLine,
                            selectedFormat === 'urdu_nastaliq' && styles.urduRtlText,
                          ]}
                        >
                          {line}
                        </Text>
                        {secondary && (
                          <Text style={styles.secondaryPoemLine}>{secondary}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Mindful Reflection */}
                <View style={styles.reflectionBox}>
                  <Ionicons name="leaf" size={14} color={brandColors.primary} style={styles.reflectionIcon} />
                  <Text style={styles.reflectionText}>{activePoem.reflection}</Text>
                </View>

                {/* Bottom Actions */}
                <View style={styles.poemBottomActions}>
                  <TouchableOpacity
                    style={styles.regenerateButton}
                    onPress={regeneratePoem}
                    disabled={isGenerating}
                  >
                    <Ionicons name="refresh-outline" size={16} color={brandColors.primary} />
                    <Text style={styles.regenerateButtonText}>Compose New Stanza</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearPoemButton} onPress={clearActivePoem}>
                    <Text style={styles.clearPoemButtonText}>Change Settings</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Composer Form */
              <View style={styles.composerForm}>
                {/* Format Section */}
                <Text style={styles.sectionLabel}>Select Language & Script</Text>
                <View style={styles.formatGrid}>
                  {FORMAT_OPTIONS.map((f) => {
                    const isSelected = selectedFormat === f.id;
                    return (
                      <TouchableOpacity
                        key={f.id}
                        style={[styles.formatChip, isSelected && styles.formatChipSelected]}
                        onPress={() => handleSelectFormat(f.id)}
                      >
                        <Ionicons
                          name={f.icon as any}
                          size={18}
                          color={isSelected ? brandColors.primary : theme.colors.textSecondary}
                        />
                        <View style={styles.formatChipTextWrap}>
                          <Text style={[styles.formatChipTitle, isSelected && styles.formatChipTitleSelected]}>
                            {f.label}
                          </Text>
                          <Text style={styles.formatChipSubtitle}>{f.sublabel}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Theme Section */}
                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Select Emotional Theme</Text>
                <View style={styles.themeChipsWrap}>
                  {THEME_OPTIONS.map((t) => {
                    const isSelected = selectedTheme === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.themeChip, isSelected && styles.themeChipSelected]}
                        onPress={() => handleSelectTheme(t.id)}
                      >
                        <Ionicons
                          name={t.icon as any}
                          size={14}
                          color={isSelected ? '#FFFFFF' : brandColors.text}
                        />
                        <Text style={[styles.themeChipText, isSelected && styles.themeChipTextSelected]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Context Input */}
                <View style={styles.contextHeaderRow}>
                  <Text style={[styles.sectionLabel, { marginTop: 20, marginBottom: 0 }]}>
                    Your Personal Context (Optional)
                  </Text>
                  <Text style={styles.charCountText}>{userContext.length}/300</Text>
                </View>
                <Text style={styles.contextHint}>
                  Mention a feeling, circumstance, or quiet thought you wish to see transformed into words.
                </Text>
                <TextInput
                  style={styles.contextInput}
                  placeholder="e.g. Feeling exhausted by expectations and needing a gentle reminder to slow down..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={userContext}
                  onChangeText={setUserContext}
                  maxLength={300}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {/* Error Banner */}
                {error && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle-outline" size={16} color="#D32F2F" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Generate Button */}
                <TouchableOpacity
                  style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
                  onPress={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <View style={styles.generatingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.generateButtonText}>Composing Words of Solace...</Text>
                    </View>
                  ) : (
                    <View style={styles.generatingRow}>
                      <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                      <Text style={styles.generateButtonText}>Compose Words of Solace</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {isGuest && (
                  <Text style={styles.guestDisclaimer}>
                    Guest Explorer: You can compose freely. Saved poems will rest privately in your local device memory.
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        ) : (
          /* Saved Sanctuary Tab */
          <ScrollView contentContainerStyle={styles.savedScrollContent} showsVerticalScrollIndicator={false}>
            {isLoadingSaved ? (
              <View style={styles.loadingSavedContainer}>
                <ActivityIndicator size="large" color={brandColors.primary} />
                <Text style={styles.loadingSavedText}>Gathering your quiet words...</Text>
              </View>
            ) : savedPoems.length === 0 ? (
              <View style={styles.emptySavedContainer}>
                <Ionicons name="book-outline" size={48} color={theme.colors.border} />
                <Text style={styles.emptySavedTitle}>No Saved Poems Yet</Text>
                <Text style={styles.emptySavedSubtitle}>
                  Compose personalized words in the Compose tab and tap "Save" to build your private sanctuary of verses.
                </Text>
                <TouchableOpacity style={styles.emptyGoComposeButton} onPress={() => setActiveTab('compose')}>
                  <Text style={styles.emptyGoComposeText}>Compose a Poem</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.savedList}>
                {savedPoems.map((p) => {
                  const isExpanded = expandedPoemId === p.id;
                  const isUrdu = p.format === 'urdu_nastaliq' || p.format === 'bilingual';

                  return (
                    <View key={p.id} style={styles.savedPoemCard}>
                      <TouchableOpacity
                        style={styles.savedPoemHeader}
                        onPress={() => setExpandedPoemId(isExpanded ? null : p.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.savedPoemTitle, isUrdu && styles.urduRtlText]}>{p.title}</Text>
                          <Text style={styles.savedPoemDate}>
                            {new Date(p.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            • {p.format.replace('_', ' ')}
                          </Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={theme.colors.textSecondary}
                        />
                      </TouchableOpacity>

                      {isExpanded ? (
                        <View style={styles.savedPoemBody}>
                          <Text style={[styles.savedPoemContent, isUrdu && styles.urduRtlText, isUrdu && styles.urduScriptLine]}>
                            {p.content}
                          </Text>
                          {p.secondary_content && (
                            <Text style={styles.savedPoemSecondary}>{p.secondary_content}</Text>
                          )}
                          {p.reflection && (
                            <View style={styles.savedReflectionBox}>
                              <Ionicons name="leaf-outline" size={12} color={brandColors.primary} />
                              <Text style={styles.savedReflectionText}>{p.reflection}</Text>
                            </View>
                          )}
                          <View style={styles.savedCardActionsRow}>
                            <TouchableOpacity
                              style={styles.savedActionPill}
                              onPress={() =>
                                handleCopy(
                                  `${p.title}\n\n${p.content}${p.secondary_content ? `\n\n${p.secondary_content}` : ''}\n\nReflection: ${p.reflection || ''}`
                                )
                              }
                            >
                              <Ionicons name="copy-outline" size={14} color={brandColors.primary} />
                              <Text style={styles.savedActionPillText}>Copy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.savedActionPill, styles.savedActionDeletePill]}
                              onPress={() => handleDeleteSaved(p.id, p.title)}
                            >
                              <Ionicons name="trash-outline" size={14} color="#D32F2F" />
                              <Text style={[styles.savedActionPillText, { color: '#D32F2F' }]}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <Text numberOfLines={2} style={[styles.savedPoemPreview, isUrdu && styles.urduRtlText]}>
                          {p.content.split('\n')[0]}
                        </Text>
                      )}
                    </View>
                  );
                })}
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
    backgroundColor: '#FAF8F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE8E0',
    backgroundColor: '#FAF8F5',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: brandColors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#EFEAE2',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FAF8F5',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE8E0',
    gap: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#EDE8E0',
  },
  tabButtonActive: {
    backgroundColor: '#E8F1EB',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: brandColors.primary,
  },
  savedCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: brandColors.primary,
    marginLeft: 2,
  },
  savedCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  composerForm: {
    backgroundColor: 'transparent',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  formatChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2DBD0',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  formatChipSelected: {
    borderColor: brandColors.primary,
    backgroundColor: '#F2F7F4',
  },
  formatChipTextWrap: {
    flex: 1,
  },
  formatChipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: brandColors.text,
  },
  formatChipTitleSelected: {
    color: brandColors.primary,
  },
  formatChipSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  themeChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2DBD0',
  },
  themeChipSelected: {
    backgroundColor: brandColors.primary,
    borderColor: brandColors.primary,
  },
  themeChipText: {
    fontSize: 13,
    color: brandColors.text,
    fontWeight: '500',
  },
  themeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contextHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  charCountText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  contextHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: 8,
  },
  contextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2DBD0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: brandColors.text,
    minHeight: 76,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDEDED',
    padding: 12,
    borderRadius: 8,
    marginTop: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#D32F2F',
  },
  generateButton: {
    backgroundColor: brandColors.primary,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    elevation: 2,
    shadowColor: brandColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  guestDisclaimer: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  poemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#EAE4DC',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  poemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  poemFormatTag: {
    backgroundColor: '#E8F1EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  poemFormatTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: brandColors.primary,
  },
  poemActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconAction: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F5F0E8',
  },
  saveActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brandColors.primary,
    backgroundColor: '#FFFFFF',
  },
  saveActionButtonSaved: {
    backgroundColor: brandColors.primary,
  },
  saveActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: brandColors.primary,
  },
  saveActionTextSaved: {
    color: '#FFFFFF',
  },
  poemTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: brandColors.text,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  titleDivider: {
    width: 40,
    height: 2,
    backgroundColor: brandColors.primary,
    alignSelf: 'center',
    marginVertical: 14,
    borderRadius: 1,
  },
  poemLinesContainer: {
    paddingVertical: 8,
    gap: 10,
  },
  linePairContainer: {
    marginVertical: 4,
  },
  primaryPoemLine: {
    fontSize: 16,
    color: brandColors.text,
    lineHeight: 28,
    textAlign: 'center',
  },
  secondaryPoemLine: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 20,
  },
  urduScriptLine: {
    fontSize: 20,
    lineHeight: 36,
    fontFamily: Platform.OS === 'android' ? 'serif' : undefined,
  },
  urduRtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  reflectionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F7F5',
    padding: 12,
    borderRadius: 10,
    marginTop: 18,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: brandColors.primary,
  },
  reflectionIcon: {
    marginTop: 2,
  },
  reflectionText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  poemBottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE4',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  regenerateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.primary,
  },
  clearPoemButton: {
    padding: 4,
  },
  clearPoemButtonText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  savedScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingSavedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingSavedText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptySavedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptySavedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: brandColors.text,
  },
  emptySavedSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyGoComposeButton: {
    marginTop: 10,
    backgroundColor: brandColors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyGoComposeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  savedList: {
    gap: 12,
  },
  savedPoemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAE4DC',
    padding: 16,
  },
  savedPoemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedPoemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: brandColors.text,
  },
  savedPoemDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  savedPoemPreview: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  savedPoemBody: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE4',
  },
  savedPoemContent: {
    fontSize: 15,
    color: brandColors.text,
    lineHeight: 26,
  },
  savedPoemSecondary: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 20,
  },
  savedReflectionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F7F5',
    padding: 8,
    borderRadius: 6,
    marginTop: 12,
  },
  savedReflectionText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  savedCardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  savedActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F2F7F4',
  },
  savedActionDeletePill: {
    backgroundColor: '#FDEDED',
  },
  savedActionPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: brandColors.primary,
  },
});
