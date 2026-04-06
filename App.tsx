import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { useSettingsStore } from './src/store/settingsStore';
import { useAIStore } from './src/store/aiStore';

// ─── App Root ───────────────────────────────────────────────────────────────
// This is the shell. All logic lives in screens, services, and stores.
// The app boots, hydrates MMKV stores, and renders the navigator.

export default function App() {
  useEffect(() => {
    // Hydrate stores from MMKV on boot (synchronous, instant)
    useSettingsStore.getState().hydrate();
    useAIStore.getState().hydrate();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppNavigator />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
