import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DB_NAME, migrate } from '@/lib/db';
import { initBilling } from '@/lib/entitlements';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // The app is fully usable without billing; it just cannot sell anything.
    void initBilling();
  }, []);

  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        {/* The tabs are one screen in the stack, so drill and paywall can sit
            above them instead of being unreachable siblings of the tab bar. */}
        <Stack>
          {/* The title is what the back button on pushed screens reads, so it has
              to be a real word rather than the route group name. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Study' }} />
          <Stack.Screen name="drill/[subjectId]" options={{ title: 'Drill' }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal', title: '' }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
