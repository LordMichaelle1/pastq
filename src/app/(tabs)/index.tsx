import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { FREE_SUBJECT_LIMIT, isPro } from '@/lib/entitlements';
import {
  countSubjects,
  createSubject,
  listSubjects,
  subjectStats,
  type Subject,
  type SubjectStats,
} from '@/lib/queries';

type SubjectRow = Subject & { stats: SubjectStats };

export default function StudyScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [rows, setRows] = useState<SubjectRow[]>([]);
  const [draft, setDraft] = useState('');
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    const subjects = await listSubjects(db);
    const withStats = await Promise.all(
      subjects.map(async (s) => ({ ...s, stats: await subjectStats(db, s.id) }))
    );
    setRows(withStats);
    setLocked(!(await isPro()) && withStats.length >= FREE_SUBJECT_LIMIT);
  }, [db]);

  // Stats go stale while a drill runs, so refresh whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function addSubject() {
    const name = draft.trim();
    if (!name) return;

    if (!(await isPro()) && (await countSubjects(db)) >= FREE_SUBJECT_LIMIT) {
      setLocked(true);
      return;
    }

    await createSubject(db, name);
    setDraft('');
    await load();
  }

  const totalDue = rows.reduce((sum, r) => sum + r.stats.due, 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title">
            {totalDue > 0 ? `${totalDue} to review` : 'Nothing due'}
          </ThemedText>
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            {rows.length === 0
              ? 'Add a subject to start'
              : totalDue > 0
                ? 'Tap a subject to drill'
                : 'Come back later, or add more questions'}
          </ThemedText>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/drill/[subjectId]',
                  params: { subjectId: String(item.id) },
                })
              }
              style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
              <View style={styles.cardMain}>
                <ThemedText type="subtitle">{item.name}</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  {item.stats.total === 0
                    ? 'No questions yet'
                    : `${item.stats.learned} of ${item.stats.total} learned`}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{item.stats.due > 0 ? item.stats.due : ''}</ThemedText>
            </Pressable>
          )}
          ListFooterComponent={
            locked ? (
              <Pressable
                onPress={() => router.push('/paywall')}
                style={[styles.card, { backgroundColor: colors.backgroundSelected }]}>
                <View style={styles.cardMain}>
                  <ThemedText type="subtitle">Add another subject</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>
                    Free accounts keep {FREE_SUBJECT_LIMIT}. Unlock the rest.
                  </ThemedText>
                </View>
              </Pressable>
            ) : (
              <View style={styles.addRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Subject name"
                  placeholderTextColor={colors.textSecondary}
                  onSubmitEditing={addSubject}
                  returnKeyType="done"
                  style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                />
                <Pressable onPress={addSubject} style={styles.addButton}>
                  <ThemedText type="link">Add</ThemedText>
                </Pressable>
              </View>
            )
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, gap: Spacing.one },
  list: { padding: Spacing.four, gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.four },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  cardMain: { flex: 1, gap: Spacing.half },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  addButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
