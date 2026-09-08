import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ocrSupported, scanPaper } from '@/lib/ocr';
import { createQuestion } from '@/lib/queries';

type Phase =
  | { name: 'idle' }
  | { name: 'scanning' }
  | { name: 'review'; drafts: string[] }
  | { name: 'nothing'; lines: number }
  | { name: 'error'; message: string };

export default function ScanScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const id = Number(subjectId);

  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [saving, setSaving] = useState(false);

  async function pick(from: 'library' | 'camera') {
    const permission =
      from === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setPhase({
        name: 'error',
        message:
          from === 'camera'
            ? 'pastq needs camera access to photograph a paper. You can grant it in Settings.'
            : 'pastq needs photo access to read a paper. You can grant it in Settings.',
      });
      return;
    }

    const result =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1 });

    if (result.canceled) return;

    const uri = result.assets[0]?.uri;
    if (!uri) return;

    setPhase({ name: 'scanning' });
    const outcome = await scanPaper(uri);

    switch (outcome.status) {
      case 'ok':
        setPhase({ name: 'review', drafts: outcome.questions });
        break;
      case 'empty':
        setPhase({ name: 'nothing', lines: outcome.lines.length });
        break;
      case 'unsupported':
        setPhase({ name: 'error', message: 'This device cannot read text from images.' });
        break;
      case 'failed':
        setPhase({ name: 'error', message: outcome.message });
        break;
    }
  }

  function editDraft(index: number, value: string) {
    setPhase((current) =>
      current.name === 'review'
        ? { ...current, drafts: current.drafts.map((d, i) => (i === index ? value : d)) }
        : current
    );
  }

  function removeDraft(index: number) {
    setPhase((current) =>
      current.name === 'review'
        ? { ...current, drafts: current.drafts.filter((_, i) => i !== index) }
        : current
    );
  }

  async function saveAll() {
    if (phase.name !== 'review') return;

    const keep = phase.drafts.map((d) => d.trim()).filter(Boolean);
    if (keep.length === 0) return;

    setSaving(true);
    for (const prompt of keep) {
      await createQuestion(db, { subjectId: id, prompt });
    }
    setSaving(false);
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {phase.name === 'idle' ? (
          <View style={styles.centred}>
            <ThemedText type="subtitle">Photograph a past paper</ThemedText>
            <ThemedText type="small" style={[styles.hint, { color: colors.textSecondary }]}>
              Numbered questions are pulled out automatically. You can fix anything the
              scan gets wrong before saving.
            </ThemedText>

            <Pressable
              onPress={() => pick('library')}
              style={[styles.button, { backgroundColor: colors.backgroundSelected }]}>
              <ThemedText type="smallBold">Choose a photo</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => pick('camera')}
              style={[styles.button, { backgroundColor: colors.backgroundElement }]}>
              <ThemedText type="smallBold">Take a photo</ThemedText>
            </Pressable>

            {!ocrSupported ? (
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                Text recognition is unavailable on this device.
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {phase.name === 'scanning' ? (
          <View style={styles.centred}>
            <ActivityIndicator />
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Reading the paper…
            </ThemedText>
          </View>
        ) : null}

        {phase.name === 'nothing' ? (
          <View style={styles.centred}>
            <ThemedText type="subtitle">No questions found</ThemedText>
            <ThemedText type="small" style={[styles.hint, { color: colors.textSecondary }]}>
              {phase.lines > 0
                ? `Read ${phase.lines} lines, but none of them were numbered like questions. A straighter, closer photo usually helps.`
                : 'Nothing legible came off that image. Try better light or a closer shot.'}
            </ThemedText>
            <Pressable
              onPress={() => setPhase({ name: 'idle' })}
              style={[styles.button, { backgroundColor: colors.backgroundSelected }]}>
              <ThemedText type="smallBold">Try another photo</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {phase.name === 'error' ? (
          <View style={styles.centred}>
            <ThemedText type="subtitle">That did not work</ThemedText>
            <ThemedText type="small" style={[styles.hint, { color: colors.textSecondary }]}>
              {phase.message}
            </ThemedText>
            <Pressable
              onPress={() => setPhase({ name: 'idle' })}
              style={[styles.button, { backgroundColor: colors.backgroundSelected }]}>
              <ThemedText type="smallBold">Try again</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {phase.name === 'review' ? (
          <View style={styles.review}>
            <ThemedText type="title">
              {phase.drafts.length} {phase.drafts.length === 1 ? 'question' : 'questions'}
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Edit anything the scan misread, then save.
            </ThemedText>

            {phase.drafts.map((draft, index) => (
              <View
                key={index}
                style={[styles.draft, { backgroundColor: colors.backgroundElement }]}>
                <TextInput
                  value={draft}
                  onChangeText={(value) => editDraft(index, value)}
                  multiline
                  style={[styles.draftInput, { color: colors.text }]}
                />
                <Pressable onPress={() => removeDraft(index)} style={styles.remove}>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>
                    Remove
                  </ThemedText>
                </Pressable>
              </View>
            ))}

            <Pressable
              onPress={saveAll}
              disabled={saving || phase.drafts.length === 0}
              style={[
                styles.button,
                {
                  backgroundColor: colors.backgroundSelected,
                  opacity: saving || phase.drafts.length === 0 ? 0.5 : 1,
                },
              ]}>
              <ThemedText type="smallBold">
                {saving ? 'Saving…' : `Save ${phase.drafts.length}`}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexGrow: 1,
  },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.three },
  hint: { textAlign: 'center', maxWidth: 320 },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.three,
    minWidth: 220,
  },
  review: { gap: Spacing.three },
  draft: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  draftInput: { fontSize: 15, lineHeight: 21, textAlignVertical: 'top' },
  remove: { alignSelf: 'flex-end' },
});
