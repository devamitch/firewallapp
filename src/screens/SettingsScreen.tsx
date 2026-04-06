import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, TextInput, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSettingsStore } from '../store/settingsStore';
import { SecurityService } from '../services/securityService';

export default function SettingsScreen() {
  const nav = useNavigation();
  const settings = useSettingsStore();
  const [newKeyword, setNewKeyword] = useState('');

  const SettingToggle = ({ label, value, onToggle }: { label: string; value: boolean; onToggle: (v: boolean) => void }) => (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(0,212,255,0.4)' }}
        thumbColor={value ? '#00D4FF' : '#666'}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
        </Animated.View>

        {/* Notification Control */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)}>
          <LinearGradient colors={['rgba(20,20,40,0.7)', 'rgba(10,10,30,0.9)']} style={styles.card}>
            <Text style={styles.sectionTitle}>🔔 Notifications</Text>
            <SettingToggle label="Auto-block spam" value={settings.autoBlockSpam} onToggle={(v) => settings.update({ autoBlockSpam: v })} />
            <SettingToggle label="Silence promotions" value={settings.silencePromotions} onToggle={(v) => settings.update({ silencePromotions: v })} />
            <SettingToggle label="Show spam warning" value={settings.showSpamWarning} onToggle={(v) => settings.update({ showSpamWarning: v })} />
          </LinearGradient>
        </Animated.View>

        {/* Call Control */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <LinearGradient colors={['rgba(20,20,40,0.7)', 'rgba(10,10,30,0.9)']} style={styles.card}>
            <Text style={styles.sectionTitle}>📞 Calls</Text>
            <SettingToggle label="Auto-reject spam calls" value={settings.autoRejectSpamCalls} onToggle={(v) => settings.update({ autoRejectSpamCalls: v })} />
            <SettingToggle label="Block short codes" value={settings.blockUnknownShortCodes} onToggle={(v) => settings.update({ blockUnknownShortCodes: v })} />
            <SettingToggle label="Block repeated unknown" value={settings.blockRepeatedUnknown} onToggle={(v) => settings.update({ blockRepeatedUnknown: v })} />
          </LinearGradient>
        </Animated.View>

        {/* AI Settings */}
        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <LinearGradient colors={['rgba(20,20,40,0.7)', 'rgba(10,10,30,0.9)']} style={styles.card}>
            <Text style={styles.sectionTitle}>🧠 AI Engine</Text>
            <SettingToggle label="Enable on-device LLM" value={settings.useLLM} onToggle={(v) => settings.update({ useLLM: v })} />
            <SettingToggle label="Auto-learn from decisions" value={settings.learningEnabled} onToggle={(v) => settings.update({ learningEnabled: v })} />
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Confidence threshold</Text>
              <Text style={styles.settingValue}>{(settings.confidenceThreshold * 100).toFixed(0)}%</Text>
            </View>
            <View style={styles.sliderRow}>
              {[0.5, 0.6, 0.7, 0.75, 0.8, 0.9].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.sliderBtn, settings.confidenceThreshold === v && styles.sliderBtnActive]}
                  onPress={() => settings.update({ confidenceThreshold: v })}
                >
                  <Text style={[styles.sliderText, settings.confidenceThreshold === v && styles.sliderTextActive]}>
                    {(v * 100).toFixed(0)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                const result = await SecurityService.autoFineTune();
                Alert.alert('Fine-Tune Complete', `Updated ${result.patternsUpdated} patterns\nAccuracy: ${(result.accuracy * 100).toFixed(1)}%`);
              }}
            >
              <Text style={styles.actionBtnText}>🔄 Auto Fine-Tune Now</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {/* Custom Keywords */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <LinearGradient colors={['rgba(20,20,40,0.7)', 'rgba(10,10,30,0.9)']} style={styles.card}>
            <Text style={styles.sectionTitle}>🏷️ Custom Keywords</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={newKeyword}
                onChangeText={setNewKeyword}
                placeholder="Add keyword..."
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <TouchableOpacity style={styles.addBtn} onPress={() => {
                if (newKeyword.trim()) { settings.addSpamKeyword(newKeyword.trim()); setNewKeyword(''); }
              }}>
                <Text style={styles.addBtnText}>+ Spam</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: 'rgba(0,230,118,0.2)' }]} onPress={() => {
                if (newKeyword.trim()) { settings.addSafeKeyword(newKeyword.trim()); setNewKeyword(''); }
              }}>
                <Text style={[styles.addBtnText, { color: '#00E676' }]}>+ Safe</Text>
              </TouchableOpacity>
            </View>

            {settings.customSpamKeywords.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.tagLabel}>Spam keywords:</Text>
                <View style={styles.tags}>
                  {settings.customSpamKeywords.map(kw => (
                    <TouchableOpacity key={kw} style={styles.tagSpam} onPress={() => settings.removeKeyword(kw)}>
                      <Text style={styles.tagText}>{kw} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {settings.customSafeKeywords.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.tagLabel}>Safe keywords:</Text>
                <View style={styles.tags}>
                  {settings.customSafeKeywords.map(kw => (
                    <TouchableOpacity key={kw} style={styles.tagSafe} onPress={() => settings.removeKeyword(kw)}>
                      <Text style={[styles.tagText, { color: '#00E676' }]}>{kw} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Privacy & UI */}
        <Animated.View entering={FadeInDown.delay(500).duration(600)}>
          <LinearGradient colors={['rgba(20,20,40,0.7)', 'rgba(10,10,30,0.9)']} style={styles.card}>
            <Text style={styles.sectionTitle}>🔒 Privacy & UI</Text>
            <SettingToggle label="Show live feed" value={settings.showLiveFeed} onToggle={(v) => settings.update({ showLiveFeed: v })} />
            <SettingToggle label="Haptic feedback" value={settings.hapticFeedback} onToggle={(v) => settings.update({ hapticFeedback: v })} />
            <SettingToggle label="Notification badge" value={settings.notificationBadge} onToggle={(v) => settings.update({ notificationBadge: v })} />
          </LinearGradient>
        </Animated.View>

        {/* Reset */}
        <Animated.View entering={FadeInDown.delay(600).duration(600)}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => Alert.alert('Reset?', 'This will reset all settings to defaults.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: () => settings.reset() },
            ])}
          >
            <Text style={styles.resetText}>Reset All Settings</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 60 },
  backBtn: { marginBottom: 8 },
  backText: { color: '#00D4FF', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '800', color: '#FFF', marginBottom: 20 },
  card: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 12 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  settingLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', flex: 1 },
  settingValue: { fontSize: 14, color: '#00D4FF', fontWeight: '700' },
  sliderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  sliderBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  sliderBtnActive: { backgroundColor: 'rgba(0,212,255,0.25)', borderWidth: 1, borderColor: '#00D4FF' },
  sliderText: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  sliderTextActive: { color: '#00D4FF', fontWeight: '700' },
  actionBtn: { marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: 'rgba(0,212,255,0.1)', borderWidth: 1, borderColor: 'rgba(0,212,255,0.3)', alignItems: 'center' },
  actionBtnText: { color: '#00D4FF', fontSize: 14, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: '#FFF', fontSize: 14 },
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,59,92,0.2)' },
  addBtnText: { color: '#FF3B5C', fontSize: 12, fontWeight: '700' },
  tagSection: { marginTop: 8 },
  tagLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagSpam: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,59,92,0.15)' },
  tagSafe: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(0,230,118,0.15)' },
  tagText: { fontSize: 12, color: '#FF3B5C', fontWeight: '600' },
  resetBtn: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,59,92,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.3)', alignItems: 'center', marginBottom: 16 },
  resetText: { color: '#FF3B5C', fontSize: 14, fontWeight: '700' },
});
