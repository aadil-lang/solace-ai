import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckIn } from '@/types';
import { theme } from '@/constants/theme';
import { MOOD_METADATA } from '@/services/landscapeAnalytics';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  moments: CheckIn[];
  onUnbookmark: (id: string) => void;
}

const MOOD_ICONS: Record<string, string> = {
  peaceful: 'leaf-outline',
  grateful: 'heart-outline',
  reflective: 'water-outline',
  anxious: 'cloud-outline',
  heavy: 'rainy-outline',
  hopeful: 'sparkles-outline',
};

export const MeaningfulMoments: React.FC<Props> = ({ moments, onUnbookmark }) => {
  const formatMomentDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  if (!moments.length) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bookmark-outline" size={36} color={theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>No Meaningful Moments Yet</Text>
        <Text style={styles.emptySubtitle}>
          When a check-in holds special meaning or gratitude for you, tap the bookmark icon in your
          Horizon to gently preserve it here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      <Text style={styles.headerCaption}>
        A sanctuary of moments you chose to hold close.
      </Text>

      {moments.map((item) => {
        const meta = MOOD_METADATA[item.mood] || { label: item.mood, color: theme.colors.forest };
        const icon = MOOD_ICONS[item.mood] || 'radio-button-on';

        return (
          <View key={item.id} style={styles.momentCard}>
            <View style={styles.topRow}>
              <View style={[styles.moodTag, { backgroundColor: meta.color }]}>
                <Ionicons name={icon as any} size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.moodTagText}>{meta.label}</Text>
              </View>

              <Text style={styles.dateLabel}>{formatMomentDate(item.created_at)}</Text>

              <TouchableOpacity
                onPress={() => onUnbookmark(item.id)}
                style={styles.unbookmarkBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Remove from meaningful moments"
              >
                <Ionicons name="bookmark" size={18} color="#D48C46" />
              </TouchableOpacity>
            </View>

            {Boolean(item.note) ? (
              <Text style={styles.noteBody}>&ldquo;{item.note}&rdquo;</Text>
            ) : (
              <Text style={styles.noNotePlaceholder}>
                Logged as {meta.label.toLowerCase()} with intensity level {item.intensity}/5.
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: theme.spacing.sm,
  },
  headerCaption: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    fontStyle: 'italic',
  },
  momentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#F0D8C9', // Subtle warm border accent
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moodTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  moodTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
  },
  dateLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: 8,
    marginRight: 'auto',
  },
  unbookmarkBtn: {
    padding: 2,
  },
  noteBody: {
    marginTop: theme.spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.text,
  },
  noNotePlaceholder: {
    marginTop: theme.spacing.sm,
    fontSize: 12,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});

