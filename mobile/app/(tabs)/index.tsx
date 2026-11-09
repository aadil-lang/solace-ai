import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';
import { useCheckInStore } from '@/store/useCheckInStore';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { MoodType, MoodOption, WellnessActivity } from '@/types';
import { EmotionalLandscapeModal } from '@/components/EmotionalLandscapeModal';

const MOODS: MoodOption[] = [
  { id: 'peaceful', label: 'Peaceful', icon: 'sunny-outline', color: '#4E7A58', bgColor: '#E8F1EB' },
  { id: 'grateful', label: 'Grateful', icon: 'heart-outline', color: '#D48C46', bgColor: '#FAF0E6' },
  { id: 'reflective', label: 'Reflective', icon: 'water-outline', color: '#52796F', bgColor: '#E8EFEF' },
  { id: 'anxious', label: 'Anxious', icon: 'cloud-outline', color: '#8F5D5D', bgColor: '#F6ECEC' },
  { id: 'heavy', label: 'Heavy', icon: 'rainy-outline', color: '#68707A', bgColor: '#EEF0F2' },
  { id: 'hopeful', label: 'Hopeful', icon: 'sparkles-outline', color: '#B5835A', bgColor: '#FBF3EB' },
];

const INTENSITY_LABELS: Record<number, string> = {
  1: 'Very Mild',
  2: 'Mild',
  3: 'Moderate',
  4: 'Noticeable',
  5: 'Intense',
};

const QUICK_ACTIVITIES: WellnessActivity[] = [
  {
    id: 'box_breathing',
    title: 'Box Breathing',
    category: 'breathing',
    duration: '3 min',
    description: '4-4-4-4 rhythm to center your nervous system',
    icon: 'fitness-outline',
  },
  {
    id: 'thought_release',
    title: 'Thought Release',
    category: 'journaling',
    duration: '5 min',
    description: 'Empty your thoughts onto private pages',
    icon: 'book-outline',
  },
  {
    id: 'sensory_grounding',
    title: '5-4-3-2-1 Grounding',
    category: 'grounding',
    duration: '4 min',
    description: 'Reconnect with your physical surroundings',
    icon: 'earth-outline',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { profile, isGuest, exitGuestMode } = useAuthStore();
  const { checkIns, todayCheckIn, isLoading: isCheckInLoading, fetchHistory, recordCheckIn } = useCheckInStore();

  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [intensity, setIntensity] = useState<number>(3);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [checkInSaved, setCheckInSaved] = useState<boolean>(false);
  const [isLandscapeModalOpen, setIsLandscapeModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Sync today's checkin if already available and not locally editing
  useEffect(() => {
    if (todayCheckIn && !selectedMood && !checkInSaved) {
      setSelectedMood(todayCheckIn.mood);
      setIntensity(todayCheckIn.intensity);
      if (todayCheckIn.note) setNote(todayCheckIn.note);
      setCheckInSaved(true);
    }
  }, [todayCheckIn, selectedMood, checkInSaved]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = profile?.preferred_name || profile?.display_name || (isGuest ? 'Explorer' : 'Friend');

  const handleSelectMood = async (mood: MoodType) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    setSelectedMood(mood);
    setCheckInSaved(false);
  };

  const handleSaveCheckIn = async () => {
    if (!selectedMood) return;
    setIsSubmitting(true);
    const result = await recordCheckIn(selectedMood, intensity, note.trim() || null);
    setIsSubmitting(false);
    if (result.success) {
      setCheckInSaved(true);
    }
  };

  const selectedMoodMeta = MOODS.find((m) => m.id === selectedMood);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* A. Personalized Greeting */}
        <View style={styles.greetingSection}>
          {isGuest && (
            <TouchableOpacity
              style={styles.guestBadge}
              onPress={async () => {
                await exitGuestMode();
                router.replace('/(auth)/login');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="leaf-outline" size={12} color={theme.colors.forest} style={{ marginRight: 4 }} />
              <Text style={styles.guestBadgeText}>Guest Session • Tap to Sign In</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.greetingTitle}>
            {getGreeting()}, {displayName}.
          </Text>
          <Text style={styles.supportingText}>
            Whatever today feels like, there&apos;s room for it here.
          </Text>
        </View>

        {/* B. Mood Check-in with Intensity & Note */}
        <Card style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>How are you feeling right now?</Text>
              <Text style={styles.sectionSubtitle}>
                {checkInSaved && todayCheckIn
                  ? `Logged today as ${todayCheckIn.mood} (${INTENSITY_LABELS[todayCheckIn.intensity]})`
                  : 'Take a brief pause to notice and record your state.'}
              </Text>
            </View>
            {isCheckInLoading && <ActivityIndicator size="small" color={theme.colors.forest} />}
          </View>

          <View style={styles.moodGrid}>
            {MOODS.map((m) => {
              const isSelected = selectedMood === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.moodItem,
                    { backgroundColor: isSelected ? m.bgColor : theme.colors.surfaceMuted },
                    isSelected && { borderColor: m.color, borderWidth: 1.5 },
                  ]}
                  onPress={() => handleSelectMood(m.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.moodIconCircle, { backgroundColor: m.bgColor }]}>
                    <Ionicons name={m.icon as any} size={22} color={m.color} />
                  </View>
                  <Text
                    style={[
                      styles.moodLabel,
                      isSelected && { color: m.color, fontWeight: theme.typography.weights.semibold },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Intensity & Note Drawer when Mood is selected */}
          {selectedMood && (
            <View style={styles.checkInDetailsSection}>
              <View style={styles.intensityHeaderRow}>
                <Text style={styles.intensityLabel}>Intensity Level:</Text>
                <Text style={styles.intensityValue}>
                  {intensity} / 5 — {INTENSITY_LABELS[intensity]}
                </Text>
              </View>

              <View style={styles.intensityDotsRow}>
                {[1, 2, 3, 4, 5].map((level) => {
                  const isActive = level <= intensity;
                  return (
                    <TouchableOpacity
                      key={level}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          try {
                            Haptics.selectionAsync();
                          } catch {}
                        }
                        setIntensity(level);
                        setCheckInSaved(false);
                      }}
                      style={[
                        styles.intensityDot,
                        isActive && { backgroundColor: selectedMoodMeta?.color || theme.colors.forest },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.intensityDotText,
                          isActive && { color: theme.colors.background },
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.noteInputLabel}>Personal reflection note (optional):</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="What's contributing to this feeling?"
                placeholderTextColor={theme.colors.textMuted}
                value={note}
                onChangeText={(text) => {
                  setNote(text);
                  setCheckInSaved(false);
                }}
                multiline
                maxLength={280}
              />

              <View style={styles.saveActionRow}>
                <Button
                  title={checkInSaved ? '✓ Saved for Today' : 'Save Check-in'}
                  onPress={handleSaveCheckIn}
                  loading={isSubmitting}
                  disabled={checkInSaved}
                  variant={checkInSaved ? 'outline' : 'primary'}
                  style={checkInSaved ? styles.savedCheckInBtn : styles.saveCheckInBtn}
                  textStyle={checkInSaved ? { color: theme.colors.forest } : undefined}
                />
                {checkInSaved && (
                  <TouchableOpacity
                    onPress={() => setCheckInSaved(false)}
                    style={styles.reEditLink}
                  >
                    <Text style={styles.reEditText}>Update</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </Card>

        {/* C. AI Companion Entry Point */}
        <Card style={styles.companionCard}>
          <View style={styles.companionGlow} />
          <View style={styles.companionContent}>
            <View style={styles.companionHeaderRow}>
              <View style={styles.companionAvatar}>
                <Ionicons name="sparkles" size={20} color={theme.colors.forest} />
              </View>
              <View style={styles.companionHeaderText}>
                <Text style={styles.companionTitle}>Solace Companion</Text>
                <Text style={styles.companionTag}>Consent-Based Emotional Memory</Text>
              </View>
            </View>

            <Text style={styles.companionQuote}>
              &ldquo;I&apos;m here whenever you need a moment.&rdquo;
            </Text>
            <Text style={styles.companionDescription}>
              Whether you want to unpack a thought, work through tension, or reflect on your feelings with mindful care.
            </Text>

            <Button
              title="Start Mindful Conversation"
              onPress={() => router.push('/(tabs)/companion')}
              icon={<Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.background} />}
              style={styles.companionButton}
            />
          </View>
        </Card>

        {/* D. Daily Reflection */}
        <Card style={styles.reflectionCard}>
          <View style={styles.reflectionHeader}>
            <Ionicons name="flower-outline" size={18} color={theme.colors.forest} style={{ marginRight: 6 }} />
            <Text style={styles.reflectionLabel}>DAILY REFLECTION</Text>
          </View>
          <Text style={styles.reflectionText}>
            &ldquo;You do not have to carry everything all at once. Even pausing for one mindful breath creates space for renewal.&rdquo;
          </Text>
          <Text style={styles.reflectionSubtext}>Pause • Notice • Release</Text>
        </Card>

        {/* E. Wellness Activities */}
        <View style={styles.activitiesSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Mindful Practices</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/discover')}>
              <Text style={styles.seeAllText}>Explore all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityList}>
            {QUICK_ACTIVITIES.map((act) => (
              <TouchableOpacity
                key={act.id}
                style={styles.activityCard}
                onPress={() => router.push('/(tabs)/discover')}
                activeOpacity={0.82}
              >
                <View style={styles.activityIconCircle}>
                  <Ionicons name={act.icon as any} size={20} color={theme.colors.forest} />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>{act.title}</Text>
                  <Text style={styles.activityDesc} numberOfLines={1}>
                    {act.description}
                  </Text>
                </View>
                <View style={styles.durationPill}>
                  <Text style={styles.durationText}>{act.duration}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* F. Genuine User Progress (Real Data Only — No Fabrications) */}
        <Card style={styles.progressCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Your Reflection History</Text>
            <TouchableOpacity
              onPress={() => setIsLandscapeModalOpen(true)}
              style={styles.exploreLandscapeBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.exploreLandscapeText}>Explore Landscape</Text>
              <Ionicons name="chevron-forward" size={13} color={theme.colors.forest} />
            </TouchableOpacity>
          </View>

          {checkIns.length > 0 ? (
            <View style={styles.historyContainer}>
              <View style={styles.progressActiveContent}>
                <View style={styles.progressMetric}>
                  <Text style={styles.progressMetricValue}>{checkIns.length}</Text>
                  <Text style={styles.progressMetricLabel}>Total Check-ins</Text>
                </View>
                <View style={styles.progressDivider} />
                <View style={styles.progressDetail}>
                  <Text style={styles.progressDetailTitle}>Latest Mood</Text>
                  <Text style={styles.progressDetailBody}>
                    Feeling {checkIns[0].mood} (Intensity: {checkIns[0].intensity}/5)
                    {checkIns[0].note ? ` — "${checkIns[0].note}"` : ''}
                  </Text>
                </View>
              </View>

              {/* Recent check-in chips */}
              <View style={styles.recentChipsContainer}>
                <Text style={styles.recentTitle}>Recent entries:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {checkIns.slice(0, 5).map((item) => {
                    const moodMeta = MOODS.find((m) => m.id === item.mood);
                    const dateStr = new Date(item.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    });
                    return (
                      <View key={item.id} style={[styles.historyChip, { backgroundColor: moodMeta?.bgColor || theme.colors.surfaceMuted }]}>
                        <Ionicons name={(moodMeta?.icon || 'sunny-outline') as any} size={14} color={moodMeta?.color || theme.colors.forest} style={{ marginRight: 4 }} />
                        <Text style={[styles.historyChipText, { color: moodMeta?.color || theme.colors.forest }]}>
                          {item.mood} ({item.intensity}/5) • {dateStr}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          ) : (
            <View style={styles.progressEmptyState}>
              <Ionicons name="calendar-outline" size={28} color={theme.colors.textMuted} style={{ marginBottom: 6 }} />
              <Text style={styles.progressEmptyTitle}>No check-ins logged yet</Text>
              <Text style={styles.progressEmptyBody}>
                Logging your state using the mood check-in above will begin your personal reflection history.
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Emotional Landscape Sanctuary Modal */}
      <EmotionalLandscapeModal
        visible={isLandscapeModalOpen}
        onClose={() => setIsLandscapeModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.lg,
  },
  greetingSection: {
    marginTop: theme.spacing.xs,
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.sageLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.xs,
  },
  guestBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.forest,
  },
  greetingTitle: {
    fontSize: theme.typography.sizes.display - 4,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
    letterSpacing: -0.5,
  },
  supportingText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 22,
  },
  card: {
    backgroundColor: theme.colors.surface,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.md + 1,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  sectionSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  seeAllText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  moodItem: {
    width: '30.8%',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  moodIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  moodLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    textAlign: 'center',
    fontWeight: theme.typography.weights.medium,
  },
  checkInDetailsSection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  intensityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  intensityLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  intensityValue: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
  },
  intensityDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  intensityDot: {
    flex: 1,
    height: 38,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  intensityDotText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
  },
  noteInputLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  noteInput: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.md,
  },
  saveActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  saveCheckInBtn: {
    flex: 1,
  },
  savedCheckInBtn: {
    flex: 1,
    borderColor: theme.colors.forest,
    backgroundColor: '#E8F1EB',
  },
  reEditLink: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  reEditText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.forest,
    fontWeight: theme.typography.weights.medium,
  },
  companionCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  companionGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.sageLight,
    opacity: 0.6,
  },
  companionContent: {
    zIndex: 1,
  },
  companionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  companionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  companionHeaderText: {
    flex: 1,
  },
  companionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
  },
  companionTag: {
    fontSize: 11,
    color: theme.colors.forest,
    fontWeight: theme.typography.weights.medium,
  },
  companionQuote: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
    fontStyle: 'italic',
    marginVertical: theme.spacing.xs,
  },
  companionDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  companionButton: {
    backgroundColor: theme.colors.forest,
  },
  reflectionCard: {
    backgroundColor: theme.colors.peachLight,
    borderWidth: 1,
    borderColor: theme.colors.peach,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  reflectionLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
    letterSpacing: 0.8,
  },
  reflectionText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
    fontStyle: 'italic',
    lineHeight: 24,
    marginVertical: theme.spacing.xs,
  },
  reflectionSubtext: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  activitiesSection: {
    gap: theme.spacing.sm,
  },
  activityList: {
    gap: theme.spacing.sm,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    ...theme.shadows.soft,
  },
  activityIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  activityDesc: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  durationPill: {
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  durationText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  progressCard: {
    backgroundColor: theme.colors.surface,
  },
  exploreLandscapeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.sageLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  exploreLandscapeText: {
    fontSize: 11,
    color: theme.colors.forest,
    fontWeight: theme.typography.weights.semibold,
  },
  historyContainer: {
    gap: theme.spacing.md,
  },
  progressActiveContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressMetric: {
    alignItems: 'center',
    paddingRight: theme.spacing.md,
  },
  progressMetricValue: {
    fontSize: 32,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
  },
  progressMetricLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  progressDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.border,
    marginRight: theme.spacing.md,
  },
  progressDetail: {
    flex: 1,
  },
  progressDetailTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
    marginBottom: 2,
  },
  progressDetailBody: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  recentChipsContainer: {
    paddingTop: theme.spacing.xs,
  },
  recentTitle: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  chipScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  historyChipText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
  },
  progressEmptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  progressEmptyTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: 2,
  },
  progressEmptyBody: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: theme.spacing.md,
  },
});
