import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

const WELLNESS_GOALS = [
  { id: 'calm_anxiety', label: 'Calm everyday anxiety', icon: 'leaf-outline' as const },
  { id: 'better_sleep', label: 'Sleep peacefully', icon: 'moon-outline' as const },
  { id: 'daily_gratitude', label: 'Cultivate gratitude', icon: 'heart-outline' as const },
  { id: 'mindful_focus', label: 'Find mental clarity', icon: 'sparkles-outline' as const },
  { id: 'process_feelings', label: 'Process heavy emotions', icon: 'water-outline' as const },
];

const INTERACTION_STYLES = [
  {
    id: 'gentle',
    title: 'Gentle & Empathetic',
    description: 'Soft, validating responses focused on holding space.',
  },
  {
    id: 'grounded',
    title: 'Grounded & Reflective',
    description: 'Thoughtful inquiries helping you unpack thoughts.',
  },
  {
    id: 'practical',
    title: 'Mindful & Action-Oriented',
    description: 'Breathing cues and practical micro-steps.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { profile, user, completeOnboarding, isLoading } = useAuthStore();

  const [preferredName, setPreferredName] = useState(
    profile?.preferred_name || profile?.display_name || ''
  );
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string>('gentle');

  const toggleGoal = async (goalId: string) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    setSelectedGoals((prev) =>
      prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId]
    );
  };

  const handleSelectStyle = async (styleId: string) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    setSelectedStyle(styleId);
  };

  const handleComplete = async (skipped = false) => {
    const finalName = skipped
      ? preferredName || 'Friend'
      : preferredName.trim() || 'Friend';
    const finalGoals = skipped ? [] : selectedGoals;
    const finalStyle = skipped ? 'gentle' : selectedStyle;

    await completeOnboarding(finalName, finalGoals, finalStyle);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Skip Bar */}
        <View style={styles.topBar}>
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
          </View>
          <TouchableOpacity onPress={() => handleComplete(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>

        {/* Section 1: Greeting & Name */}
        <View style={styles.header}>
          <Text style={styles.title}>Setting Your Space</Text>
          <Text style={styles.subtitle}>
            A few small questions to help Solace understand how to speak to you.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>What should Solace call you?</Text>
          <Input
            placeholder="Your preferred name or nickname"
            value={preferredName}
            onChangeText={setPreferredName}
            leftIcon="person-outline"
            style={{ marginBottom: 0 }}
          />
        </Card>

        {/* Section 2: Wellness Goals */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>What brings you here today?</Text>
          <Text style={styles.cardHelp}>Select any that resonate with you (optional):</Text>
          <View style={styles.goalsContainer}>
            {WELLNESS_GOALS.map((goal) => {
              const isSelected = selectedGoals.includes(goal.id);
              return (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.goalChip, isSelected && styles.goalChipSelected]}
                  onPress={() => toggleGoal(goal.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={goal.icon}
                    size={18}
                    color={isSelected ? theme.colors.forest : theme.colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.goalChipText,
                      isSelected && styles.goalChipTextSelected,
                    ]}
                  >
                    {goal.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Section 3: Companion Interaction Style */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>How would you like Solace to respond?</Text>
          <Text style={styles.cardHelp}>You can change this tone anytime in settings:</Text>
          <View style={styles.stylesContainer}>
            {INTERACTION_STYLES.map((style) => {
              const isSelected = selectedStyle === style.id;
              return (
                <TouchableOpacity
                  key={style.id}
                  style={[styles.styleOption, isSelected && styles.styleOptionSelected]}
                  onPress={() => handleSelectStyle(style.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.styleRadioRow}>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[styles.styleTitle, isSelected && styles.styleTitleActive]}>
                      {style.title}
                    </Text>
                  </View>
                  <Text style={styles.styleDescription}>{style.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Privacy Assurance */}
        <View style={styles.privacyBox}>
          <Ionicons
            name="lock-closed"
            size={16}
            color={theme.colors.forest}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.privacyText}>
            Your emotional journey is yours alone. All responses are encrypted with row-level security and never shared with third parties.
          </Text>
        </View>

        {/* Complete Action */}
        <Button
          title="Enter Solace"
          onPress={() => handleComplete(false)}
          loading={isLoading}
          size="lg"
          style={styles.completeButton}
        />
      </ScrollView>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 6,
  },
  stepDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
  },
  stepDotActive: {
    backgroundColor: theme.colors.sage,
  },
  skipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  header: {
    marginTop: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 22,
  },
  card: {
    backgroundColor: theme.colors.surface,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: 6,
  },
  cardHelp: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  goalsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  goalChipSelected: {
    borderColor: theme.colors.forest,
    backgroundColor: theme.colors.sageLight,
  },
  goalChipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  goalChipTextSelected: {
    color: theme.colors.forest,
    fontWeight: theme.typography.weights.semibold,
  },
  stylesContainer: {
    gap: theme.spacing.sm,
  },
  styleOption: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  styleOptionSelected: {
    borderColor: theme.colors.forest,
    backgroundColor: theme.colors.peachLight,
  },
  styleRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioCircleActive: {
    borderColor: theme.colors.forest,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.forest,
  },
  styleTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  styleTitleActive: {
    color: theme.colors.forest,
  },
  styleDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginLeft: 28,
    lineHeight: 18,
  },
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.lavenderLight,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  privacyText: {
    flex: 1,
    fontSize: 11,
    color: theme.colors.text,
    lineHeight: 16,
  },
  completeButton: {
    marginTop: theme.spacing.xs,
  },
});

