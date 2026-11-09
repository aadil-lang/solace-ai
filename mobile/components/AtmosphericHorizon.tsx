import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { CheckIn } from '@/types';
import { theme } from '@/constants/theme';
import { MOOD_METADATA } from '@/services/landscapeAnalytics';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Props {
  checkIns: CheckIn[];
  onToggleMeaningful: (id: string) => void;
  onDelete: (id: string) => void;
}

const MOOD_ICONS: Record<string, string> = {
  peaceful: 'leaf-outline',
  grateful: 'heart-outline',
  reflective: 'water-outline',
  anxious: 'cloud-outline',
  heavy: 'rainy-outline',
  hopeful: 'sparkles-outline',
};

export const AtmosphericHorizon: React.FC<Props> = ({
  checkIns,
  onToggleMeaningful,
  onDelete,
}) => {
  const confirmDelete = (item: CheckIn) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this check-in? This action cannot be undone.')) {
        onDelete(item.id);
      }
      return;
    }

    Alert.alert(
      'Delete Check-in',
      'Are you sure you want to delete this check-in? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(item.id),
        },
      ]
    );
  };

  const formatMomentDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const dateStr = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const timeStr = d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${dateStr} • ${timeStr}`;
    } catch {
      return isoStr;
    }
  };

  if (!checkIns.length) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="compass-outline" size={36} color={theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>Your Horizon is Still</Text>
        <Text style={styles.emptySubtitle}>
          Check in on your home screen to begin weaving the moments of your journey.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.timelineList}>
      {checkIns.map((item, index) => {
        const meta = MOOD_METADATA[item.mood] || { label: item.mood, color: theme.colors.forest };
        const icon = MOOD_ICONS[item.mood] || 'radio-button-on';

        return (
          <View key={item.id} style={styles.cardContainer}>
            {/* Timeline connector track */}
            {index < checkIns.length - 1 && <View style={styles.verticalTrack} />}

            <View style={styles.cardHeaderRow}>
              {/* Mood Badge */}
              <View style={[styles.moodBadge, { backgroundColor: meta.color }]}>
                <Ionicons name={icon as any} size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.moodBadgeText}>{meta.label}</Text>
              </View>

              {/* Intensity Stones (1 to 5) */}
              <View style={styles.intensityStones}>
                {[1, 2, 3, 4, 5].map((pip) => (
                  <View
                    key={pip}
                    style={[
                      styles.stonePip,
                      pip <= item.intensity
                        ? { backgroundColor: meta.color, opacity: 0.9 }
                        : styles.stonePipInactive,
                    ]}
                  />
                ))}
              </View>

              {/* Actions: Bookmark & Delete */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => onToggleMeaningful(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Toggle meaningful moment"
                >
                  <Ionicons
                    name={item.is_meaningful ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={item.is_meaningful ? '#D48C46' : theme.colors.textMuted}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => confirmDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Remove check-in"
                >
                  <Ionicons name="trash-outline" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Note text if provided */}
            {Boolean(item.note) && (
              <Text style={styles.noteText}>&ldquo;{item.note}&rdquo;</Text>
            )}

            {/* Card Footer: Local timestamp & Sync State */}
            <View style={styles.cardFooter}>
              <Text style={styles.dateText}>{formatMomentDate(item.created_at)}</Text>
              {item.sync_status === 'pending_sync' && (
                <View style={styles.syncBadge}>
                  <Ionicons name="cloud-upload-outline" size={12} color="#D48C46" />
                  <Text style={styles.syncTextPending}>Pending sync</Text>
                </View>
              )}
              {item.sync_status === 'local_only' && (
                <View style={styles.syncBadge}>
                  <Ionicons name="phone-portrait-outline" size={12} color={theme.colors.textMuted} />
                  <Text style={styles.syncTextLocal}>Saved on device</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  timelineList: {
    paddingVertical: theme.spacing.sm,
  },
  cardContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  verticalTrack: {
    position: 'absolute',
    left: 20,
    bottom: -16,
    width: 2,
    height: 16,
    backgroundColor: theme.colors.border,
    zIndex: -1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  moodBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
  },
  intensityStones: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 12,
  },
  stonePip: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  stonePipInactive: {
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 'auto',
  },
  actionBtn: {
    padding: 2,
  },
  noteText: {
    marginTop: theme.spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.text,
    fontStyle: 'italic',
  },
  cardFooter: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncTextPending: {
    fontSize: 10,
    color: '#D48C46',
    fontWeight: theme.typography.weights.medium,
  },
  syncTextLocal: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
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

