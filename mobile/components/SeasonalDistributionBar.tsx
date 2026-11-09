import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SeasonDistributionItem } from '@/types';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  distribution: SeasonDistributionItem[];
  totalMoments: number;
}

const MOOD_ICONS: Record<string, string> = {
  peaceful: 'leaf-outline',
  grateful: 'heart-outline',
  reflective: 'water-outline',
  anxious: 'cloud-outline',
  heavy: 'rainy-outline',
  hopeful: 'sparkles-outline',
};

export const SeasonalDistributionBar: React.FC<Props> = ({ distribution, totalMoments }) => {
  const activeItems = distribution.filter((d) => d.count > 0);

  return (
    <View style={styles.container}>
      {/* Proportion Bar */}
      <View style={styles.barContainer}>
        {totalMoments === 0 ? (
          <View style={styles.emptyBarSegment}>
            <Text style={styles.emptyBarText}>No check-ins in this period</Text>
          </View>
        ) : (
          activeItems.map((item, idx) => (
            <View
              key={item.mood}
              style={[
                styles.barSegment,
                {
                  backgroundColor: item.color,
                  flex: item.count,
                  borderTopLeftRadius: idx === 0 ? theme.radius.sm : 0,
                  borderBottomLeftRadius: idx === 0 ? theme.radius.sm : 0,
                  borderTopRightRadius: idx === activeItems.length - 1 ? theme.radius.sm : 0,
                  borderBottomRightRadius: idx === activeItems.length - 1 ? theme.radius.sm : 0,
                },
              ]}
            />
          ))
        )}
      </View>

      {/* Legend Grid */}
      <View style={styles.legendGrid}>
        {distribution.map((item) => {
          const icon = MOOD_ICONS[item.mood] || 'radio-button-on';
          const isPresent = item.count > 0;
          return (
            <View
              key={item.mood}
              style={[styles.legendItem, !isPresent && styles.legendItemMuted]}
            >
              <View style={[styles.dotCircle, { backgroundColor: item.color }]}>
                <Ionicons name={icon as any} size={11} color="#FFFFFF" />
              </View>
              <View style={styles.legendTextCol}>
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendMetrics}>
                  {item.percentage}% ({item.count})
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barContainer: {
    height: 18,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  barSegment: {
    height: '100%',
  },
  emptyBarSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  emptyBarText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.md,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '46%',
  },
  legendItemMuted: {
    opacity: 0.45,
  },
  dotCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  legendTextCol: {
    flex: 1,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  legendMetrics: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
});

