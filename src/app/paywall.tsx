import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  billingStatus,
  currentOffering,
  purchasePro,
  restorePurchases,
} from '@/lib/entitlements';

export default function PaywallScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const offering = await currentOffering();
      setPkg(offering?.availablePackages[0] ?? null);
      setLoading(false);
    })();
  }, []);

  async function unlock() {
    setBusy(true);
    setMessage(null);

    const result = await purchasePro();
    setBusy(false);

    if (result.ok && result.pro) {
      router.back();
      return;
    }
    // A cancelled purchase is a normal thing to do, not an error to shout about.
    if (!result.ok && !result.cancelled) setMessage(result.message);
  }

  async function restore() {
    setBusy(true);
    const restored = await restorePurchases();
    setBusy(false);
    if (restored) router.back();
    else setMessage('No previous purchase found on this account.');
  }

  const status = billingStatus();
  const canBuy = status === 'ready' && pkg !== null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.copy}>
          <ThemedText type="title">Unlock every subject</ThemedText>
          <ThemedText style={{ color: colors.textSecondary }}>
            Keep as many subjects as you are sitting, drill them offline, and hold on to
            every past paper you have scanned.
          </ThemedText>
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : canBuy ? (
          <View style={styles.actions}>
            <Pressable
              onPress={unlock}
              disabled={busy}
              style={[styles.primary, { backgroundColor: colors.backgroundSelected }]}>
              <ThemedText type="smallBold">
                {busy ? 'Working…' : `Unlock — ${pkg.product.priceString}`}
              </ThemedText>
            </Pressable>

            <Pressable onPress={restore} disabled={busy} style={styles.textButton}>
              <ThemedText type="link">Restore purchase</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.actions}>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              {status === 'ready'
                ? 'No subscription is available right now.'
                : 'Purchases are not set up in this build.'}
            </ThemedText>
          </View>
        )}

        {message ? (
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            {message}
          </ThemedText>
        ) : null}

        <Pressable onPress={() => router.back()} style={styles.textButton}>
          <ThemedText type="link">Not now</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  copy: { gap: Spacing.two, alignItems: 'center' },
  actions: { alignItems: 'center', gap: Spacing.two, width: '100%' },
  primary: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  textButton: { padding: Spacing.two },
});
