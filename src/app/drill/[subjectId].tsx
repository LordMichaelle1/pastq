import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { dueQuestions, gradeQuestion, type Question } from '@/lib/queries';
import type { Grade } from '@/lib/srs';

const GRADES: { grade: Grade; label: string }[] = [
  { grade: 0, label: 'Again' },
  { grade: 1, label: 'Hard' },
  { grade: 2, label: 'Good' },
  { grade: 3, label: 'Easy' },
];

export default function DrillScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const id = Number(subjectId);

  const [queue, setQueue] = useState<Question[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [loading, setLoading] = useState(true);

  const refill = useCallback(async () => {
    setQueue(await dueQuestions(db, id));
    setRevealed(false);
    setLoading(false);
  }, [db, id]);

  useEffect(() => {
    void refill();
  }, [refill]);

  async function grade(value: Grade) {
    const current = queue[0];
    if (!current) return;

    await gradeQuestion(db, current.id, value);
    setDone((n) => n + 1);
    setRevealed(false);

    const rest = queue.slice(1);
    // A missed card comes back this session rather than waiting for tomorrow.
    setQueue(value === 0 ? [...rest, current] : rest);

    if (rest.length === 0 && value !== 0) void refill();
  }

  const current = queue[0];

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText type="small">Loading…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!current) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText type="title">Done for now</ThemedText>
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            {done > 0 ? `${done} reviewed` : 'Nothing was due here'}
          </ThemedText>
          <Pressable onPress={() => router.back()} style={styles.textButton}>
            <ThemedText type="link">Back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.progress}>
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            {queue.length} left · {done} done
          </ThemedText>
        </View>

        <Pressable style={styles.cardArea} onPress={() => setRevealed(true)}>
          <ThemedText type="subtitle" style={styles.prompt}>
            {current.prompt}
          </ThemedText>

          {revealed ? (
            <ThemedText style={[styles.answer, { color: colors.textSecondary }]}>
              {current.answer || 'No answer saved — grade yourself on recall.'}
            </ThemedText>
          ) : (
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Tap to reveal
            </ThemedText>
          )}
        </Pressable>

        {revealed ? (
          <View style={styles.grades}>
            {GRADES.map(({ grade: value, label }) => (
              <Pressable
                key={label}
                onPress={() => grade(value)}
                style={[styles.gradeButton, { backgroundColor: colors.backgroundElement }]}>
                <ThemedText type="smallBold">{label}</ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  progress: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  cardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  prompt: { textAlign: 'center' },
  answer: { textAlign: 'center' },
  grades: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.four },
  gradeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  textButton: { padding: Spacing.three },
});
