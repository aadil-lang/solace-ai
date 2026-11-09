import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { useMemoryStore } from '@/store/useMemoryStore';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ConnectionBadge } from '@/components/ConnectionBadge';
import { MemoryCategory } from '@/types';

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  ongoing_challenges: 'Ongoing Challenge',
  coping_strategies: 'Coping Strategy',
  goals: 'Wellness Goal',
  relationships: 'Relationship',
  preferences: 'Preference',
  important_context: 'Important Context',
};

const CATEGORY_COLORS: Record<MemoryCategory, { bg: string; text: string }> = {
  ongoing_challenges: { bg: '#F6ECEC', text: '#8F5D5D' },
  coping_strategies: { bg: '#E8F1EB', text: '#4E7A58' },
  goals: { bg: '#FBF3EB', text: '#B5835A' },
  relationships: { bg: '#FAF0E6', text: '#D48C46' },
  preferences: { bg: '#E8EFEF', text: '#52796F' },
  important_context: { bg: '#F0EAF8', text: '#6B5280' },
};

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, user, isGuest, signOut, exitGuestMode, updateProfile } = useAuthStore();
  const { connectionStatus, checkBackendHealth, apiUrl } = useAppStore();
  const {
    memories,
    isMemoryEnabled,
    isLoading: isMemoryLoading,
    fetchMemories,
    toggleMemoryActive,
    deleteMemory,
    toggleGlobalMemory,
    createMemory,
  } = useMemoryStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [preferredNameInput, setPreferredNameInput] = useState(
    profile?.preferred_name || profile?.display_name || ''
  );
  const [isSaving, setIsSaving] = useState(false);

  // Manual memory creation form state
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryCategory>('preferences');
  const [isCreatingMemory, setIsCreatingMemory] = useState(false);

  // Collapsible technical diagnostics state
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleSaveName = async () => {
    if (!preferredNameInput.trim()) return;
    setIsSaving(true);
    await updateProfile({ preferred_name: preferredNameInput.trim() });
    setIsSaving(false);
    setIsEditingName(false);
  };

  const handleCreateMemory = async () => {
    if (!newMemoryText.trim()) return;
    setIsCreatingMemory(true);
    const result = await createMemory(newMemoryText.trim(), newMemoryCategory);
    setIsCreatingMemory(false);
    if (result.success) {
      setNewMemoryText('');
      setIsAddingMemory(false);
    } else {
      Alert.alert('Error', result.error || 'Failed to save memory');
    }
  };

  const handleDeleteMemory = (id: string, text: string) => {
    Alert.alert(
      'Delete Memory?',
      `Are you sure you want Solace to forget:\n"${text}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: () => deleteMemory(id),
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      isGuest ? 'Leave Guest Mode?' : 'Sign Out?',
      isGuest
        ? 'Return to the login screen to sign in or create an account.'
        : 'Are you sure you want to sign out of Solace?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isGuest ? 'Leave' : 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            if (isGuest) {
              await exitGuestMode();
            } else {
              await signOut();
            }
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const displayName = profile?.preferred_name || profile?.display_name || (isGuest ? 'Guest Explorer' : 'User');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Sanctuary</Text>
          <Text style={styles.headerSubtitle}>Personal settings, consent, and emotional memories.</Text>
        </View>

        {/* User Card */}
        <Card style={styles.userCard}>
          <View style={styles.userHeaderRow}>
            <View style={styles.avatarLarge}>
              <Ionicons
                name={isGuest ? 'leaf' : 'person'}
                size={30}
                color={theme.colors.forest}
              />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.userEmail}>
                {isGuest ? 'Local guest mode (unlinked)' : user?.email || 'Authenticated user'}
              </Text>
              <View
                style={[
                  styles.accountPill,
                  isGuest ? styles.guestPill : styles.authPill,
                ]}
              >
                <Ionicons
                  name={isGuest ? 'sparkles-outline' : 'shield-checkmark-outline'}
                  size={12}
                  color={isGuest ? theme.colors.forest : theme.colors.statusConnected}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.accountPillText,
                    isGuest ? styles.guestPillText : styles.authPillText,
                  ]}
                >
                  {isGuest ? 'Guest Session' : 'Supabase Authenticated'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Preferred Name Configuration */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionTitle}>Preferred Greeting Name</Text>
            <TouchableOpacity onPress={() => setIsEditingName(!isEditingName)}>
              <Text style={styles.editToggleText}>{isEditingName ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          {isEditingName ? (
            <View style={styles.editNameRow}>
              <Input
                value={preferredNameInput}
                onChangeText={setPreferredNameInput}
                placeholder="Enter preferred name"
                style={{ flex: 1, marginBottom: 0 }}
              />
              <Button
                title="Save"
                onPress={handleSaveName}
                loading={isSaving}
                size="sm"
                style={styles.saveNameBtn}
              />
            </View>
          ) : (
            <Text style={styles.nameValueText}>
              Solace greets you as &ldquo;{profile?.preferred_name || displayName}&rdquo;.
            </Text>
          )}
        </Card>

        {/* User-Controlled Emotional Memory Management (Core Differentiator) */}
        <Card style={styles.memoryCard}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.memoryTitleRow}>
                <Ionicons name="sparkles" size={16} color={theme.colors.forest} style={{ marginRight: 6 }} />
                <Text style={styles.memorySectionTitle}>Emotional Memory</Text>
              </View>
              <Text style={styles.memorySectionSubtitle}>
                Context Solace remembers with your consent to personalize mindful care.
              </Text>
            </View>
            <Switch
              value={isMemoryEnabled}
              onValueChange={toggleGlobalMemory}
              trackColor={{ false: theme.colors.border, true: theme.colors.sage }}
              thumbColor={isMemoryEnabled ? theme.colors.forest : '#f4f3f4'}
            />
          </View>

          <View style={styles.memoryDivider} />

          {/* Action bar for adding manual memory */}
          <View style={styles.memoryActionRow}>
            <Text style={styles.memoryCountText}>
              {memories.length} {memories.length === 1 ? 'memory' : 'memories'} saved
            </Text>
            <TouchableOpacity
              onPress={() => setIsAddingMemory(!isAddingMemory)}
              style={styles.addMemoryButton}
            >
              <Ionicons
                name={isAddingMemory ? 'close-circle-outline' : 'add-circle-outline'}
                size={16}
                color={theme.colors.forest}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.addMemoryText}>{isAddingMemory ? 'Cancel' : 'Add Memory'}</Text>
            </TouchableOpacity>
          </View>

          {/* Add Memory Form */}
          {isAddingMemory && (
            <View style={styles.addMemoryForm}>
              <Text style={styles.formLabel}>What should Solace remember about you?</Text>
              <TextInput
                style={styles.memoryTextInput}
                placeholder="e.g. I practice meditation when I feel overwhelmed at work."
                placeholderTextColor={theme.colors.textMuted}
                value={newMemoryText}
                onChangeText={setNewMemoryText}
                multiline
                maxLength={240}
              />
              <Text style={styles.formLabel}>Category:</Text>
              <View style={styles.categorySelectRow}>
                {(['preferences', 'coping_strategies', 'goals', 'ongoing_challenges', 'relationships', 'important_context'] as MemoryCategory[]).map(
                  (cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setNewMemoryCategory(cat)}
                      style={[
                        styles.catOption,
                        newMemoryCategory === cat && styles.catOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catOptionText,
                          newMemoryCategory === cat && styles.catOptionTextSelected,
                        ]}
                      >
                        {CATEGORY_LABELS[cat]}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
              <Button
                title="Save into Emotional Memory"
                onPress={handleCreateMemory}
                loading={isCreatingMemory}
                size="sm"
                style={styles.saveMemoryBtn}
              />
            </View>
          )}

          {/* Memory List */}
          {isMemoryLoading ? (
            <ActivityIndicator size="small" color={theme.colors.forest} style={{ marginVertical: 12 }} />
          ) : memories.length === 0 ? (
            <View style={styles.emptyMemoryState}>
              <Ionicons name="shield-outline" size={24} color={theme.colors.textMuted} style={{ marginBottom: 4 }} />
              <Text style={styles.emptyMemoryTitle}>No memories stored yet</Text>
              <Text style={styles.emptyMemoryBody}>
                During conversations with Solace, you will be prompted before anything personal is committed to memory.
              </Text>
            </View>
          ) : (
            <View style={styles.memoryList}>
              {memories.map((mem) => {
                const colors = CATEGORY_COLORS[mem.category] || { bg: theme.colors.surfaceMuted, text: theme.colors.forest };
                return (
                  <View key={mem.id} style={[styles.memoryItem, !mem.is_active && styles.memoryItemInactive]}>
                    <View style={styles.memoryItemHeader}>
                      <View style={[styles.categoryBadge, { backgroundColor: colors.bg }]}>
                        <Text style={[styles.categoryBadgeText, { color: colors.text }]}>
                          {CATEGORY_LABELS[mem.category] || mem.category}
                        </Text>
                      </View>
                      <View style={styles.memoryControls}>
                        <Switch
                          value={mem.is_active}
                          onValueChange={(val) => toggleMemoryActive(mem.id, val)}
                          trackColor={{ false: theme.colors.border, true: theme.colors.sageLight }}
                          thumbColor={mem.is_active ? theme.colors.forest : '#c0c0c0'}
                          style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                        />
                        <TouchableOpacity
                          onPress={() => handleDeleteMemory(mem.id, mem.memory_text)}
                          style={styles.deleteMemoryBtn}
                        >
                          <Ionicons name="trash-outline" size={16} color={theme.colors.statusDisconnected} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.memoryContentText, !mem.is_active && styles.memoryContentInactive]}>
                      &ldquo;{mem.memory_text}&rdquo;
                    </Text>
                    <Text style={styles.memoryDateText}>
                      Added {new Date(mem.created_at).toLocaleDateString()} • {mem.source === 'conversation' ? 'From chat consent' : 'User created'}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {/* Selected Goals & Style */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionTitle}>Mindful Preferences</Text>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Interaction Tone:</Text>
            <Text style={styles.prefValue}>
              {profile?.interaction_style === 'practical'
                ? 'Mindful & Action-Oriented'
                : profile?.interaction_style === 'grounded'
                ? 'Grounded & Reflective'
                : 'Gentle & Empathetic'}
            </Text>
          </View>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Wellness Goals:</Text>
            <Text style={styles.prefValue}>
              {profile?.wellness_goals && profile.wellness_goals.length > 0
                ? profile.wellness_goals.join(', ')
                : 'Personal exploration'}
            </Text>
          </View>
        </Card>

        {/* System Health & Optional Technical Diagnostics */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.healthTitleRow}>
              <Ionicons
                name="pulse-outline"
                size={18}
                color={connectionStatus === 'connected' ? theme.colors.forest : theme.colors.textSecondary}
              />
              <Text style={styles.cardSectionTitle}>System Health</Text>
            </View>
            <ConnectionBadge status={connectionStatus} />
          </View>

          <TouchableOpacity
            style={styles.diagnosticsToggle}
            onPress={() => setShowDiagnostics(!showDiagnostics)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={showDiagnostics ? 'Hide technical diagnostics' : 'Show technical diagnostics'}
          >
            <Text style={styles.diagnosticsToggleText}>
              {showDiagnostics ? 'Hide Technical Diagnostics' : 'Developer Diagnostics'}
            </Text>
            <Ionicons
              name={showDiagnostics ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          {showDiagnostics && (
            <View style={styles.diagnosticsContainer}>
              <Text style={styles.telemetryUrl} numberOfLines={1} ellipsizeMode="middle">
                Endpoint: {apiUrl}
              </Text>
              <Button
                title="Test Backend Connection"
                variant="outline"
                size="sm"
                onPress={checkBackendHealth}
                style={styles.testBtn}
              />
            </View>
          )}
        </Card>

        {/* Sign Out Action */}
        <Button
          title={isGuest ? 'Exit Guest Mode' : 'Sign Out of Solace'}
          variant="outline"
          onPress={handleSignOut}
          style={styles.signOutButton}
          textStyle={{ color: theme.colors.statusDisconnected }}
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
  },
  userCard: {
    backgroundColor: theme.colors.surface,
  },
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
  },
  userEmail: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    marginBottom: 6,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  authPill: {
    backgroundColor: theme.colors.statusPillBgConnected,
  },
  guestPill: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  accountPillText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
  },
  authPillText: {
    color: theme.colors.statusConnected,
  },
  guestPillText: {
    color: theme.colors.textSecondary,
  },
  card: {
    backgroundColor: theme.colors.surface,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  cardSectionTitle: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  editToggleText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  saveNameBtn: {
    paddingHorizontal: 16,
    height: 48,
  },
  nameValueText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  memoryCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage,
    borderWidth: 1,
  },
  memoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memorySectionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
  },
  memorySectionSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
    paddingRight: theme.spacing.sm,
  },
  memoryDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  memoryActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  memoryCountText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  addMemoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addMemoryText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
  },
  addMemoryForm: {
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  memoryTextInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 50,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.sm,
  },
  categorySelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  catOption: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catOptionSelected: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  catOptionText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  catOptionTextSelected: {
    color: theme.colors.background,
    fontWeight: theme.typography.weights.semibold,
  },
  saveMemoryBtn: {
    backgroundColor: theme.colors.forest,
  },
  emptyMemoryState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  emptyMemoryTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: 2,
  },
  emptyMemoryBody: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: theme.spacing.md,
  },
  memoryList: {
    gap: theme.spacing.sm,
  },
  memoryItem: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  memoryItemInactive: {
    opacity: 0.55,
  },
  memoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    textTransform: 'uppercase',
  },
  memoryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteMemoryBtn: {
    padding: 4,
  },
  memoryContentText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    lineHeight: 18,
  },
  memoryContentInactive: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
  },
  memoryDateText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceMuted,
  },
  prefLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  prefValue: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.forest,
  },
  healthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagnosticsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 4,
  },
  diagnosticsToggleText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  diagnosticsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceMuted,
  },
  telemetryUrl: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  testBtn: {
    borderColor: theme.colors.border,
    alignSelf: 'flex-start',
  },
  signOutButton: {
    borderColor: '#F2C5C3',
    backgroundColor: '#FCF7F7',
    marginTop: theme.spacing.xs,
  },
});
