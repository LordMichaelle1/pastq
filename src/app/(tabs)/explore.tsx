import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { countQuestions, createQuestion, listSubjects, type Subject } from '@/lib/queries';

export default function AddScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    const rows = await listSubjects(db);
    setSubjects(rows);

    // Keep the current pick if it still exists, otherwise fall back to the first.
    setActiveId((current) => {
      const stillThere = rows.some((s) => s.id === current);
      return stillThere ? current : (rows[0]?.id ?? null);
    });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const refreshCount = useCallback(
    async (subjectId: number) => setCount(await countQuestions(db, subjectId)),
    [db]
  );

  async function save() {
    if (activeId === null || !prompt.trim()) return;

    await createQuestion(db, { subjectId: activeId, prompt, answer });
    setPrompt('');
    setAnswer('');
    await refreshCount(activeId);
  }

  if (subjects.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.empty}>
          <ThemedText type="title">No subjects yet</ThemedText>
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            Add one on the Study tab first.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const canSave = activeId !== null && prompt.trim().length > 0;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <ThemedText type="title">Add a question</ThemedText>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {subjects.map((s) => {
                const active = s.id === activeId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      setActiveId(s.id);
                      void refreshCount(s.id);
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.backgroundSelected : colors.backgroundElement,
                      },
                    ]}>
                    <ThemedText type={active ? 'smallBold' : 'small'}>{s.name}</ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Question, as it appeared on the paper"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[
                styles.input,
                styles.promptInput,
                { color: colors.text, borderColor: colors.backgroundSelected },
              ]}
            />

            <TextInput
              value={answer}
              onChangeText={setAnswer}
              placeholder="Answer (optional — leave blank to self-grade)"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[
                styles.input,
                styles.answerInput,
                { color: colors.text, borderColor: colors.backgroundSelected },
              ]}
            />

            <Pressable
              onPress={save}
              disabled={!canSave}
              style={[
                styles.save,
                { backgroundColor: colors.backgroundElement, opacity: canSave ? 1 : 0.5 },
              ]}>
              <ThemedText type="smallBold">Save question</ThemedText>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push({ pathname: '/scan', params: { subjectId: String(activeId) } })
              }
              disabled={activeId === null}
              style={styles.scanLink}>
              <ThemedText type="link">Scan a paper instead</ThemedText>
            </Pressable>

            {count > 0 ? (
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                {count} saved in this subject
              </ThemedText>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  body: { padding: Spacing.four, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
  chips: { gap: Spacing.two, paddingVertical: Spacing.one },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.four },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    textAlignVertical: 'top',
  },
  promptInput: { minHeight: 110 },
  answerInput: { minHeight: 80 },
  save: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.three },
  scanLink: { alignItems: 'center', paddingVertical: Spacing.two },
});
