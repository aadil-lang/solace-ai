import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';

export type BreathPhase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

interface PhaseConfig {
  label: string;
  instruction: string;
  durationSec: number;
  scaleTarget: number;
}

const PHASES: Record<BreathPhase, PhaseConfig> = {
  inhale: {
    label: 'Breathe In',
    instruction: 'Expand your lungs gently through the nose',
    durationSec: 4,
    scaleTarget: 1.55,
  },
  hold1: {
    label: 'Hold Gently',
    instruction: 'Keep a calm, soft stillness in your chest',
    durationSec: 4,
    scaleTarget: 1.55,
  },
  exhale: {
    label: 'Breathe Out',
    instruction: 'Release all tension slowly through the mouth',
    durationSec: 4,
    scaleTarget: 1.0,
  },
  hold2: {
    label: 'Rest & Pause',
    instruction: 'Rest at empty lungs, feeling natural calm',
    durationSec: 4,
    scaleTarget: 1.0,
  },
};

const PHASE_SEQUENCE: BreathPhase[] = ['inhale', 'hold1', 'exhale', 'hold2'];

interface BoxBreathingVisualizerProps {
  onFinish?: () => void;
  onClose: () => void;
}

export const BoxBreathingVisualizer: React.FC<BoxBreathingVisualizerProps> = ({
  onClose,
}) => {
  const [phaseIndex, setPhaseIndex] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(4);
  const [cycleCount, setCycleCount] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  // Animated values
  const scale = useSharedValue(1.0);
  const ringScale = useSharedValue(1.0);
  const ringOpacity = useSharedValue(0.4);

  const activePhaseKey = PHASE_SEQUENCE[phaseIndex];
  const activePhase = PHASES[activePhaseKey];

  // Check reduced motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setPrefersReducedMotion(enabled);
    });
  }, []);

  // Sync animations whenever phase changes
  useEffect(() => {
    if (isPaused) return;

    if (prefersReducedMotion) {
      scale.value = activePhase.scaleTarget;
      return;
    }

    const durationMs = activePhase.durationSec * 1000;

    if (activePhaseKey === 'inhale') {
      scale.value = withTiming(activePhase.scaleTarget, {
        duration: durationMs,
        easing: Easing.inOut(Easing.ease),
      });
      ringScale.value = withTiming(1.8, { duration: durationMs, easing: Easing.out(Easing.ease) });
      ringOpacity.value = withTiming(0.1, { duration: durationMs });
    } else if (activePhaseKey === 'hold1') {
      scale.value = activePhase.scaleTarget;
      ringOpacity.value = withTiming(0.35, { duration: 1000 });
    } else if (activePhaseKey === 'exhale') {
      scale.value = withTiming(activePhase.scaleTarget, {
        duration: durationMs,
        easing: Easing.inOut(Easing.ease),
      });
      ringScale.value = withTiming(1.0, { duration: durationMs, easing: Easing.inOut(Easing.ease) });
      ringOpacity.value = withTiming(0.4, { duration: durationMs });
    } else if (activePhaseKey === 'hold2') {
      scale.value = activePhase.scaleTarget;
      ringOpacity.value = withTiming(0.2, { duration: 1000 });
    }

    // Trigger subtle tactile feedback
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  }, [phaseIndex, isPaused, prefersReducedMotion]);

  // Synchronized countdown timer
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Advance to next phase
          setPhaseIndex((currIdx) => {
            const nextIdx = (currIdx + 1) % PHASE_SEQUENCE.length;
            if (nextIdx === 0) {
              setCycleCount((c) => c + 1);
            }
            return nextIdx;
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(scale);
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
    };
  }, []);

  const togglePause = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
    setIsPaused((p) => !p);
  };

  const handleEnd = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    cancelAnimation(scale);
    cancelAnimation(ringScale);
    cancelAnimation(ringOpacity);
    onClose();
  };

  const animatedCircleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const animatedRingStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: ringScale.value }],
      opacity: ringOpacity.value,
    };
  });

  return (
    <View style={styles.container}>
      {/* Top Header Controls */}
      <View style={styles.header}>
        <View style={styles.cycleBadge}>
          <Text style={styles.cycleBadgeText}>Cycle {cycleCount}</Text>
        </View>

        <TouchableOpacity onPress={handleEnd} style={styles.closeBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={theme.colors.forest} />
        </TouchableOpacity>
      </View>

      {/* Main Visualizer Area */}
      <View style={styles.visualizerWrap}>
        {/* Soft background glow ring */}
        <Animated.View style={[styles.glowRing, animatedRingStyle]} />

        {/* Outer breathing aura */}
        <Animated.View style={[styles.outerCircle, animatedCircleStyle]}>
          <View style={styles.innerCoreCircle}>
            <Ionicons name="leaf-outline" size={32} color={theme.colors.forest} />
          </View>
        </Animated.View>
      </View>

      {/* Current Phase Labels & Countdown */}
      <View style={styles.instructionSection}>
        <Text style={styles.phaseLabel}>{activePhase.label}</Text>
        <Text style={styles.countdownText}>{secondsRemaining}</Text>
        <Text style={styles.instructionSub}>{activePhase.instruction}</Text>
      </View>

      {/* Bottom Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          onPress={togglePause}
          style={[styles.controlBtn, isPaused ? styles.controlBtnActive : null]}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isPaused ? 'play' : 'pause'}
            size={20}
            color={isPaused ? '#FFFFFF' : theme.colors.forest}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.controlBtnText, isPaused ? styles.controlBtnTextActive : null]}>
            {isPaused ? 'Resume Session' : 'Pause'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleEnd} style={styles.endBtn} activeOpacity={0.8}>
          <Text style={styles.endBtnText}>End Session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F1',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 12 : 0,
  },
  cycleBadge: {
    backgroundColor: theme.colors.sageLight,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.sage,
  },
  cycleBadgeText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualizerWrap: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.md,
  },
  glowRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(122, 154, 134, 0.25)',
  },
  outerCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: theme.colors.sageLight,
    borderWidth: 2,
    borderColor: theme.colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.forest,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  innerCoreCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  instructionSection: {
    alignItems: 'center',
    gap: 8,
  },
  phaseLabel: {
    fontSize: 26,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
    letterSpacing: -0.5,
  },
  countdownText: {
    fontSize: 48,
    fontWeight: '800',
    color: theme.colors.forest,
    fontVariant: ['tabular-nums'],
    marginVertical: 4,
  },
  instructionSub: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
    paddingBottom: Platform.OS === 'android' ? 24 : theme.spacing.md,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  controlBtnActive: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  controlBtnText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
  },
  controlBtnTextActive: {
    color: '#FFFFFF',
  },
  endBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  endBtnText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
});

export default BoxBreathingVisualizer;
