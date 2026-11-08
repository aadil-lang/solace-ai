import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { WellnessActivity } from '@/types';

const ACTIVITIES: WellnessActivity[] = [
  {
    id: 'box_breath',
    title: 'Box Breathing',
    category: 'breathing',
    duration: '3 min',
    description: 'Inhale for 4s, hold for 4s, exhale for 4s, hold for 4s. Regulates heart rate variability and clears adrenaline.',
    icon: 'leaf-outline',
  },
  {
    id: 'breath_478',
    title: '4-7-8 Restorative Breath',
    category: 'breathing',
    duration: '4 min',
    description: 'A proven natural tranquilizer for the nervous system, ideal before sleep or when feeling overwhelmed.',
    icon: 'moon-outline',
  },
  {
    id: 'thought_release',
    title: 'Mindful Thought Release',
    category: 'journaling',
    duration: '5 min',
    description: 'Write down looping worries without filtering. Acknowledge them, and let them rest on the page.',
    icon: 'book-outline',
  },
  {
    id: 'evening_gratitude',
    title: 'Three Quiet Moments',
    category: 'journaling',
    duration: '3 min',
    description: 'Identify three quiet things from your day you felt grateful for, no matter how small.',
    icon: 'heart-outline',
  },
  {
    id: 'grounding_54321',
    title: '5-4-3-2-1 Sensory Grounding',
    category: 'grounding',
    duration: '4 min',
    description: 'Notice 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste.',
    icon: 'earth-outline',
  },
  {
    id: 'body_scan',
    title: 'Physical Tension Scan',
    category: 'grounding',
    duration: '6 min',
    description: 'Gently move your awareness from the crown of your head to your toes, softening tight muscles.',
    icon: 'body-outline',
  },
];

type CategoryFilter = 'all' | 'breathing' | 'journaling' | 'grounding';

export default function DiscoverScreen() {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [activeActivity, setActiveActivity] = useState<WellnessActivity | null>(null);

  const filtered = filter === 'all'
    ? ACTIVITIES
    : ACTIVITIES.filter((a) => a.category === filter);

  const handleOpenActivity = async (act: WellnessActivity) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    setActiveActivity(act);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Discover Solace</Text>
          <Text style={styles.headerSubtitle}>
            Grounded practices for moments when you need balance.
          </Text>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {(['all', 'breathing', 'journaling', 'grounding'] as CategoryFilter[]).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                filter === cat && styles.filterChipActive,
              ]}
              onPress={() => setFilter(cat)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === cat && styles.filterChipTextActive,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Activity Cards */}
        <View style={styles.activityGrid}>
          {filtered.map((act) => (
            <TouchableOpacity
              key={act.id}
              style={styles.cardWrapper}
              onPress={() => handleOpenActivity(act)}
              activeOpacity={0.85}
            >
              <Card style={styles.activityCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    <Ionicons name={act.icon as any} size={22} color={theme.colors.forest} />
                  </View>
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationBadgeText}>{act.duration}</Text>
                  </View>
                </View>
                <Text style={styles.activityTitle}>{act.title}</Text>
                <Text style={styles.activityDescription}>{act.description}</Text>
                <View style={styles.startRow}>
                  <Text style={styles.startActionText}>Begin practice</Text>
                  <Ionicons name="arrow-forward" size={14} color={theme.colors.forest} />
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Practice Detail Modal */}
      {activeActivity && (
        <Modal
          animationType="slide"
          transparent
          visible={Boolean(activeActivity)}
          onRequestClose={() => setActiveActivity(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.iconCircle}>
                  <Ionicons name={activeActivity.icon as any} size={24} color={theme.colors.forest} />
                </View>
                <TouchableOpacity
                  onPress={() => setActiveActivity(null)}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalTitle}>{activeActivity.title}</Text>
              <Text style={styles.modalDuration}>Duration: {activeActivity.duration}</Text>
              <Text style={styles.modalBody}>{activeActivity.description}</Text>

              <View style={styles.modalInstructionBox}>
                <Text style={styles.instructionHeading}>Guidance</Text>
                <Text style={styles.instructionText}>
                  Find an unhurried posture. Lower your shoulders away from your ears. Close your eyes or soften your gaze, and proceed at your natural pace.
                </Text>
              </View>

              <Button
                title="Start Guided Session"
                onPress={() => setActiveActivity(null)}
                style={styles.modalActionButton}
              />
            </View>
          </View>
        </Modal>
      )}
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
  header: {
    marginTop: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  filterChipText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  filterChipTextActive: {
    color: theme.colors.background,
  },
  activityGrid: {
    gap: theme.spacing.md,
  },
  cardWrapper: {
    width: '100%',
  },
  activityCard: {
    backgroundColor: theme.colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.forest,
  },
  activityTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  startActionText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(48, 51, 47, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
  },
  modalDuration: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  modalBody: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: 22,
  },
  modalInstructionBox: {
    backgroundColor: theme.colors.peachLight,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginVertical: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.peach,
  },
  instructionHeading: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
    marginBottom: 4,
  },
  instructionText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    lineHeight: 18,
  },
  modalActionButton: {
    marginTop: theme.spacing.xs,
  },
});

