import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { theme } from '@/constants/theme';
import { useCheckInStore } from '@/store/useCheckInStore';
import { useAuthStore } from '@/store/useAuthStore';
import { SeasonalDistributionBar } from '@/components/SeasonalDistributionBar';
import { AtmosphericHorizon } from '@/components/AtmosphericHorizon';
import { MeaningfulMoments } from '@/components/MeaningfulMoments';
import { MOOD_METADATA } from '@/services/landscapeAnalytics';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'seasons' | 'horizon' | 'meaningful';
type Timeframe = '7d' | '30d' | 'all';

export const EmotionalLandscapeModal: React.FC<Props> = ({ visible, onClose }) => {
  const { isGuest } = useAuthStore();
  const {
    checkIns,
    isLoading,
    isReflecting,
    activeReflection,
    savedReflections,
    isLoadingReflections,
    fetchHistory,
    toggleMeaningful,
    removeCheckIn,
    generateReflection,
    saveActiveReflection,
    clearActiveReflection,
    fetchSavedReflections,
    deleteSavedReflection,
    getSummary,
  } = useCheckInStore();

  const [activeTab, setActiveTab] = useState<TabType>('seasons');
  const [timeframe, setTimeframe] = useState<Timeframe>('7d');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copiedReflection, setCopiedReflection] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      fetchHistory();
      fetchSavedReflections();
    }
  }, [visible, fetchHistory, fetchSavedReflections]);

  const summary = getSummary(timeframe);
  const meaningfulMoments = checkIns.filter((c) => c.is_meaningful);

  const handleTabChange = async (tab: TabType) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    setActiveTab(tab);
  };

  const handleTimeframeChange = async (tf: Timeframe) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    setTimeframe(tf);
    clearActiveReflection();
    setSaveSuccessMsg(null);
  };

  const handleRequestReflection = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setSaveSuccessMsg(null);
    await generateReflection(timeframe);
  };

  const handleSaveReflection = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    const saved = await saveActiveReflection(timeframe);
    if (saved) {
      setSaveSuccessMsg('Reflection preserved in your sanctuary.');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    }
  };

  const handleCopyReflection = async (text: string) => {
    await Clipboard.setStringAsync(text);
    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    setCopiedReflection(true);
    setTimeout(() => setCopiedReflection(false), 2000);
  };

  const dominantMeta = summary.dominant_season
    ? MOOD_METADATA[summary.dominant_season]
    : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safeArea}>
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close Emotional Landscape"
          >
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>Emotional Landscape</Text>
            <Text style={styles.topBarSubtitle}>Notice your journey, one moment at a time</Text>
          </View>

          <View style={styles.topBarRight} />
        </View>

        {/* Tab Selector */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'seasons' && styles.tabItemActive]}
            onPress={() => handleTabChange('seasons')}
          >
            <Ionicons
              name={activeTab === 'seasons' ? 'partly-sunny' : 'partly-sunny-outline'}
              size={15}
              color={activeTab === 'seasons' ? theme.colors.forest : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'seasons' && styles.tabTextActive,
              ]}
            >
              Seasons
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'horizon' && styles.tabItemActive]}
            onPress={() => handleTabChange('horizon')}
          >
            <Ionicons
              name={activeTab === 'horizon' ? 'compass' : 'compass-outline'}
              size={15}
              color={activeTab === 'horizon' ? theme.colors.forest : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'horizon' && styles.tabTextActive,
              ]}
            >
              Horizon ({checkIns.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'meaningful' && styles.tabItemActive]}
            onPress={() => handleTabChange('meaningful')}
          >
            <Ionicons
              name={activeTab === 'meaningful' ? 'bookmark' : 'bookmark-outline'}
              size={15}
              color={activeTab === 'meaningful' ? '#D48C46' : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'meaningful' && styles.tabTextMeaningfulActive,
              ]}
            >
              Meaningful ({meaningfulMoments.length})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: SEASONS (DISTRIBUTION & REFLECTION) */}
          {activeTab === 'seasons' && (
            <View style={styles.tabContent}>
              {/* Timeframe Selector */}
              <View style={styles.timeframeRow}>
                {(['7d', '30d', 'all'] as Timeframe[]).map((tf) => {
                  const label = tf === '7d' ? 'Past 7 Days' : tf === '30d' ? 'Past 30 Days' : 'All Time';
                  const isSelected = timeframe === tf;
                  return (
                    <TouchableOpacity
                      key={tf}
                      style={[styles.tfPill, isSelected && styles.tfPillActive]}
                      onPress={() => handleTimeframeChange(tf)}
                    >
                      <Text style={[styles.tfPillText, isSelected && styles.tfPillTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Dominant Season Atmosphere Card */}
              {summary.total_moments > 0 && dominantMeta ? (
                <View style={[styles.dominantCard, { borderLeftColor: dominantMeta.color }]}>
                  <View style={styles.dominantHeader}>
                    <Ionicons name="sparkles" size={15} color={dominantMeta.color} />
                    <Text style={[styles.dominantTag, { color: dominantMeta.color }]}>
                      PREVAILING SEASON
                    </Text>
                  </View>
                  <Text style={styles.dominantTitle}>Moving through {dominantMeta.label} waters</Text>
                  <Text style={styles.dominantDesc}>
                    Over this period, {dominantMeta.label.toLowerCase()} moments have formed the center of
                    gravity in your days.
                  </Text>
                </View>
              ) : (
                <View style={styles.welcomeCard}>
                  <Ionicons name="leaf-outline" size={28} color={theme.colors.forest} style={{ marginBottom: 6 }} />
                  <Text style={styles.welcomeTitle}>
                    {checkIns.length === 0 ? 'Your Landscape Awaits' : 'A Beginning in Motion'}
                  </Text>
                  <Text style={styles.welcomeDesc}>
                    {checkIns.length === 0
                      ? 'Whenever you are ready, check in on your home screen to begin sketching the contours of your inner landscape.'
                      : 'Every season begins with a single moment. Continue checking in at your own pace.'}
                  </Text>
                </View>
              )}

              {/* Seasonal Distribution Bar Card */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Atmospheric Distribution</Text>
                  <Text style={styles.sectionCountText}>
                    {summary.total_moments} {summary.total_moments === 1 ? 'moment' : 'moments'}
                  </Text>
                </View>

                <SeasonalDistributionBar
                  distribution={summary.season_distribution}
                  totalMoments={summary.total_moments}
                />
              </View>

              {/* Non-Clinical Journey Metrics */}
              {summary.total_moments > 0 && (
                <View style={styles.metricsGrid}>
                  <View style={styles.metricTile}>
                    <Text style={styles.metricVal}>
                      {summary.average_intensity !== null ? `${summary.average_intensity}/5` : '—'}
                    </Text>
                    <Text style={styles.metricLbl}>Avg. Intensity</Text>
                  </View>

                  <View style={styles.metricTile}>
                    <Text style={styles.metricVal}>
                      {summary.busiest_time_of_day
                        ? summary.busiest_time_of_day.charAt(0).toUpperCase() + summary.busiest_time_of_day.slice(1)
                        : '—'}
                    </Text>
                    <Text style={styles.metricLbl}>Common Time</Text>
                  </View>

                  <View style={styles.metricTile}>
                    <Text style={styles.metricVal}>{summary.meaningful_moments_count}</Text>
                    <Text style={styles.metricLbl}>Meaningful</Text>
                  </View>
                </View>
              )}

              {/* Contemplative AI Reflection Section */}
              <View style={styles.reflectionSection}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.reflectionTitleRow}>
                    <Ionicons name="flower-outline" size={17} color={theme.colors.forest} style={{ marginRight: 6 }} />
                    <Text style={styles.sectionTitle}>Contemplative Reflection</Text>
                  </View>
                </View>

                <Text style={styles.reflectionPromptIntro}>
                  Invite Solace to offer a gentle, non-clinical reflection on your {timeframe === '7d' ? 'past week' : timeframe === '30d' ? 'past month' : 'overall season'}.
                </Text>

                <TouchableOpacity
                  style={[styles.reflectBtn, isReflecting && styles.btnDisabled]}
                  onPress={handleRequestReflection}
                  disabled={isReflecting || summary.total_moments === 0}
                  activeOpacity={0.85}
                >
                  {isReflecting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.reflectBtnText}>Reflect on this season</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Active Generated Reflection (Not saved until user explicitly confirms) */}
                {activeReflection && (
                  <View
                    style={[
                      styles.activeReflectionCard,
                      activeReflection.is_crisis_override && styles.crisisCard,
                    ]}
                  >
                    <View style={styles.reflectionCardHeader}>
                      <Ionicons
                        name={activeReflection.is_crisis_override ? 'warning-outline' : 'sparkles'}
                        size={15}
                        color={activeReflection.is_crisis_override ? '#B5534B' : theme.colors.forest}
                      />
                      <Text
                        style={[
                          styles.reflectionCardTag,
                          activeReflection.is_crisis_override && { color: '#B5534B' },
                        ]}
                      >
                        {activeReflection.is_crisis_override ? 'SAFETY SUPPORT' : 'CONTEMPLATIVE MIRROR'}
                      </Text>

                      <TouchableOpacity
                        onPress={() => handleCopyReflection(activeReflection.reflection)}
                        style={styles.copyBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={copiedReflection ? 'checkmark' : 'copy-outline'}
                          size={15}
                          color={theme.colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.activeReflectionText}>
                      &ldquo;{activeReflection.reflection}&rdquo;
                    </Text>

                    {/* Separate Explicit Save Action */}
                    {!activeReflection.is_crisis_override && (
                      <View style={styles.saveActionRow}>
                        <TouchableOpacity
                          style={styles.saveReflectionBtn}
                          onPress={handleSaveReflection}
                          activeOpacity={0.82}
                        >
                          <Ionicons name="bookmark-outline" size={14} color={theme.colors.forest} style={{ marginRight: 5 }} />
                          <Text style={styles.saveReflectionBtnText}>Save to sanctuary</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.dismissReflectionBtn}
                          onPress={clearActiveReflection}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dismissReflectionText}>Dismiss</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {saveSuccessMsg && (
                      <View style={styles.saveSuccessBanner}>
                        <Ionicons name="checkmark-circle" size={14} color="#3F724D" style={{ marginRight: 5 }} />
                        <Text style={styles.saveSuccessText}>{saveSuccessMsg}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Saved Reflections Archive */}
                {savedReflections.length > 0 && (
                  <View style={styles.savedReflectionsArchive}>
                    <Text style={styles.archiveTitle}>Saved Reflections ({savedReflections.length})</Text>
                    {savedReflections.map((r) => (
                      <View key={r.id} style={styles.savedReflectionCard}>
                        <View style={styles.savedRefTopRow}>
                          <Text style={styles.savedRefTimeframe}>
                            {r.timeframe === '7d' ? '7-Day Reflection' : r.timeframe === '30d' ? '30-Day Reflection' : 'Reflection'}
                          </Text>
                          <TouchableOpacity
                            onPress={() => deleteSavedReflection(r.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={14} color={theme.colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.savedRefBody}>&ldquo;{r.reflection}&rdquo;</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* TAB 2: HORIZON (CHRONOLOGICAL RIVER) */}
          {activeTab === 'horizon' && (
            <View style={styles.tabContent}>
              <AtmosphericHorizon
                checkIns={checkIns}
                onToggleMeaningful={toggleMeaningful}
                onDelete={removeCheckIn}
              />
            </View>
          )}

          {/* TAB 3: MEANINGFUL MOMENTS */}
          {activeTab === 'meaningful' && (
            <View style={styles.tabContent}>
              <MeaningfulMoments
                moments={meaningfulMoments}
                onUnbookmark={toggleMeaningful}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  topBarSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  topBarRight: {
    width: 32,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabItemActive: {
    borderBottomColor: theme.colors.forest,
  },
  tabText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: theme.colors.forest,
    fontWeight: theme.typography.weights.semibold,
  },
  tabTextMeaningfulActive: {
    color: '#D48C46',
    fontWeight: theme.typography.weights.semibold,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  tabContent: {
    width: '100%',
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  tfPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tfPillActive: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  tfPillText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  tfPillTextActive: {
    color: '#FFFFFF',
    fontWeight: theme.typography.weights.semibold,
  },
  dominantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dominantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dominantTag: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: 0.5,
  },
  dominantTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  dominantDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  welcomeTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  welcomeDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  sectionCountText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: theme.spacing.md,
  },
  metricTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
  },
  metricLbl: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  reflectionSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reflectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reflectionPromptIntro: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  reflectBtn: {
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  reflectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
  },
  activeReflectionCard: {
    marginTop: theme.spacing.md,
    backgroundColor: '#F7F9F6',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#D4E2D2',
  },
  crisisCard: {
    backgroundColor: '#FDF2F2',
    borderColor: '#E07A7A',
  },
  reflectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reflectionCardTag: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  copyBtn: {
    marginLeft: 'auto',
  },
  activeReflectionText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.text,
    fontStyle: 'italic',
  },
  saveActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8E0',
  },
  saveReflectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveReflectionBtnText: {
    fontSize: 12,
    color: theme.colors.forest,
    fontWeight: theme.typography.weights.medium,
  },
  dismissReflectionBtn: {
    padding: 4,
  },
  dismissReflectionText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  saveSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#E5F1E8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  saveSuccessText: {
    fontSize: 11,
    color: '#3F724D',
    fontWeight: theme.typography.weights.medium,
  },
  savedReflectionsArchive: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  archiveTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  savedReflectionCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    padding: 10,
    marginBottom: 8,
  },
  savedRefTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  savedRefTimeframe: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  savedRefBody: {
    fontSize: 12,
    color: theme.colors.text,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

