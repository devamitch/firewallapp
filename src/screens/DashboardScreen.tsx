import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, FadeInDown, FadeInUp, FadeInRight,
} from 'react-native-reanimated';
import { BlurView } from '@react-native-community/blur';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { SecurityService, securityEmitter } from '../services/securityService';
import { llmService } from '../services/llmService';
import { useAIStore } from '../store/aiStore';
import { useSettingsStore } from '../store/settingsStore';

const { width, height } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface LogEntry {
  id: string;
  packageName: string;
  title: string;
  text: string;
  label: string;
  confidence: number;
  source: string;
  timestamp: number;
}

export default function DashboardScreen() {
  const nav = useNavigation<NavProp>();
  const aiState = useAIStore();
  const settings = useSettingsStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // ─── Liquid Glass Animations ───────────────────────────────────────
  const orb1X = useSharedValue(0);
  const orb1Y = useSharedValue(0);
  const orb2X = useSharedValue(width);
  const orb2Y = useSharedValue(height * 0.4);
  const orb3X = useSharedValue(width * 0.5);
  const orb3Y = useSharedValue(height);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    orb1X.value = withRepeat(withTiming(width * 0.7, { duration: 10000 }), -1, true);
    orb1Y.value = withRepeat(withTiming(height * 0.3, { duration: 8000 }), -1, true);
    orb2X.value = withRepeat(withTiming(width * 0.1, { duration: 12000 }), -1, true);
    orb2Y.value = withRepeat(withTiming(height * 0.1, { duration: 9000 }), -1, true);
    orb3X.value = withRepeat(withTiming(width * 0.9, { duration: 15000 }), -1, true);
    orb3Y.value = withRepeat(withTiming(height * 0.5, { duration: 11000 }), -1, true);
    pulseScale.value = withRepeat(
      withSequence(withTiming(1.1, { duration: 2500 }), withTiming(1, { duration: 2500 })),
      -1, false
    );
  }, []);

  const orb1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: orb1X.value }, { translateY: orb1Y.value }],
  }));
  const orb2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: orb2X.value }, { translateY: orb2Y.value }],
  }));
  const orb3Style = useAnimatedStyle(() => ({
    transform: [{ translateX: orb3X.value }, { translateY: orb3Y.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // ─── Boot Sequence: Init services + auto-load LLM ──────────────────
  useEffect(() => {
    const boot = async () => {
      try {
        // 1. Initialize security engine (hydrates MMKV stores, starts C++ engine)
        await SecurityService.initialize();
        SecurityService.getStats();

        // 2. Auto-initialize LLM if model already downloaded
        if (!llmService.isReady && settings.useLLM) {
          const modelPath = await llmService.getModelPath();
          if (modelPath) {
            console.log('[Dashboard] Auto-loading LLM from:', modelPath);
            await llmService.initialize(modelPath);
            console.log('[Dashboard] LLM auto-initialized ✅');
          }
        }
      } catch (e) {
        console.warn('[Dashboard] Boot error:', e);
      }
    };
    boot();
  }, []);

  // ─── Live notification listener ────────────────────────────────────
  useEffect(() => {
    if (!securityEmitter) return;

    const sub = securityEmitter.addListener('onNotificationReceived', async (event: any) => {
      try {
        const combined = `${event.title || ''} ${event.text || ''}`.trim();
        if (!combined) return;

        const classification = await SecurityService.classifyNotification(combined, event.packageName || 'unknown');
        setLogs(prev => [{
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          packageName: event.packageName || 'unknown',
          title: event.title || '',
          text: event.text || '',
          ...classification,
          timestamp: Date.now(),
        }, ...prev].slice(0, 50));

        SecurityService.getStats();
      } catch (e) {
        console.error('[Dashboard] Notification processing error:', e);
      }
    });

    return () => sub.remove();
  }, []);

  // ─── Computed threat level ─────────────────────────────────────────
  const threatLevel = aiState.blockedSpam > 20 ? 'CRITICAL' :
    aiState.blockedSpam > 5 ? 'WARNING' : 'SECURE';
  const threatColor = threatLevel === 'CRITICAL' ? '#FF3B5C' :
    threatLevel === 'WARNING' ? '#FFB800' : '#00E676';

  // ─── User feedback handler ─────────────────────────────────────────
  const handleFeedback = useCallback(async (entry: LogEntry, label: 'SPAM' | 'IMPORTANT' | 'PROMOTION') => {
    try {
      await SecurityService.submitFeedback(entry.text, label);
      setLogs(prev => prev.map(l =>
        l.id === entry.id ? { ...l, label, source: 'user_feedback' } : l
      ));
      SecurityService.getStats();
    } catch (e) {
      console.error('[Dashboard] Feedback error:', e);
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─── Animated Background Layer ───────────────────────────────── */}
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.orb, styles.orbCyan, orb1Style]} />
        <Animated.View style={[styles.orb, styles.orbViolet, orb2Style]} />
        <Animated.View style={[styles.orb, styles.orbPink, orb3Style]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Premium Header ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(800)} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.iconCircle}>
              <Text style={styles.shieldEmoji}>🛡️</Text>
            </View>
            <View>
              <Text style={styles.appName}>AI Shield</Text>
              <Text style={styles.subtitle}>NATIVE SECURITY ENGINE</Text>
            </View>
          </View>
          <View style={styles.navRow}>
            {['AI Status', 'History', 'Settings'].map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.navBtn}
                onPress={() => nav.navigate(item.replace(' ', '') as any)}
              >
                <BlurView blurType="thinMaterialDark" style={styles.navBlur}>
                  <Text style={styles.navBtnText}>{item}</Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* ─── Liquid Threat Indicator ─────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(200).duration(800)}>
          <BlurView blurType="dark" blurAmount={20} style={styles.glassCard}>
            <View style={styles.threatHeader}>
              <Animated.View style={[styles.statusDot, { backgroundColor: threatColor }, pulseStyle]} />
              <Text style={[styles.threatStatusText, { color: threatColor }]}>SYSTEM {threatLevel}</Text>
            </View>
            <View style={styles.mainStatsRow}>
              <View>
                <Text style={styles.mainStatValue}>{aiState.totalProcessed}</Text>
                <Text style={styles.mainStatLabel}>Events Monitored</Text>
              </View>
              <View style={styles.vLine} />
              <View>
                <Text style={[styles.mainStatValue, { color: '#FF3B5C' }]}>{aiState.blockedSpam}</Text>
                <Text style={styles.mainStatLabel}>Threats Neutralized</Text>
              </View>
            </View>
          </BlurView>
        </Animated.View>

        {/* ─── Stats Grid ─────────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <GlassStat label="Important" value={aiState.allowedImportant} color="#00E676" delay={400} />
          <GlassStat label="Calls Blocked" value={aiState.blockedCalls} color="#FFB800" delay={500} />
        </View>

        {/* ─── Engine Health ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(600).duration(800)}>
          <BlurView blurType="thinMaterialDark" style={styles.glassCard}>
            <Text style={styles.sectionTitle}>Engine Health</Text>
            <HealthRow label="C++ JSI Core" status={aiState.engineReady ? 'ACTIVE' : 'OFFLINE'} color={aiState.engineReady ? '#00E676' : '#FF3B5C'} />
            <HealthRow label="On-Device LLM" status={aiState.llmStatus} color={aiState.llmStatus === 'READY' ? '#00E676' : '#FFB800'} />
            <HealthRow label="Pattern Learner" status="ACTIVE" color="#00E676" />
            <View style={styles.hLine} />
            <View style={styles.infoGrid}>
              <View>
                <Text style={styles.infoValue}>{aiState.totalPatterns}</Text>
                <Text style={styles.infoLabel}>Learned Patterns</Text>
              </View>
              <View>
                <Text style={styles.infoValue}>{aiState.vectorCount}</Text>
                <Text style={styles.infoLabel}>Neural Vectors</Text>
              </View>
            </View>
          </BlurView>
        </Animated.View>

        {/* ─── Live Neural Stream ─────────────────────────────────────── */}
        {settings.showLiveFeed && logs.length > 0 && (
          <Animated.View entering={FadeInUp.delay(700).duration(800)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Neural Stream</Text>
              <Text style={styles.liveTag}>LIVE</Text>
            </View>
            {logs.slice(0, 5).map((entry, i) => (
              <Animated.View key={entry.id} entering={FadeInRight.delay(i * 100)}>
                <BlurView blurType="thinMaterialDark" style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logApp}>{entry.packageName.split('.').pop()}</Text>
                    <Text style={[styles.confidenceText, {
                      color: entry.label === 'SPAM' ? '#FF3B5C' :
                             entry.label === 'PROMOTION' ? '#FFB800' : '#00E676'
                    }]}>
                      {(entry.confidence * 100).toFixed(0)}%
                    </Text>
                  </View>
                  <Text style={styles.logText} numberOfLines={2}>{entry.text}</Text>
                  <View style={styles.logFooter}>
                    <View style={[styles.miniBadge, {
                      backgroundColor: entry.label === 'SPAM' ? '#FF3B5C' :
                                       entry.label === 'PROMOTION' ? '#FFB800' : '#00E676'
                    }]} />
                    <Text style={styles.logLabel}>{entry.label}</Text>
                    <Text style={styles.logSource}>{entry.source}</Text>
                  </View>
                  <View style={styles.feedbackRow}>
                    <TouchableOpacity onPress={() => handleFeedback(entry, 'SPAM')}>
                      <Text style={styles.fbIcon}>⛔</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleFeedback(entry, 'IMPORTANT')}>
                      <Text style={styles.fbIcon}>✅</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleFeedback(entry, 'PROMOTION')}>
                      <Text style={styles.fbIcon}>📢</Text>
                    </TouchableOpacity>
                  </View>
                </BlurView>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function GlassStat({ label, value, color, delay }: { label: string; value: number; color: string; delay: number }) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(800)} style={styles.statWrapper}>
      <BlurView blurType="thinMaterialDark" style={styles.statBlur}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </BlurView>
    </Animated.View>
  );
}

function HealthRow({ label, status, color }: { label: string; status: string; color: string }) {
  return (
    <View style={styles.healthRow}>
      <Text style={styles.healthLabel}>{label}</Text>
      <View style={styles.healthStatus}>
        <View style={[styles.statusDotMini, { backgroundColor: color }]} />
        <Text style={[styles.healthStatusText, { color }]}>{status}</Text>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020208' },
  orb: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.25 },
  orbCyan: { backgroundColor: '#00D4FF', top: -50, left: -50 },
  orbViolet: { backgroundColor: '#8B5CF6', top: height * 0.3, right: -100 },
  orbPink: { backgroundColor: '#FF00A0', bottom: -100, left: width * 0.2 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 80 },

  header: { marginBottom: 30 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,212,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)' },
  shieldEmoji: { fontSize: 24 },
  appName: { fontSize: 42, fontWeight: '900', color: '#FFF', letterSpacing: -1.5 },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 4, fontWeight: '700' },

  navRow: { flexDirection: 'row', marginTop: 4, gap: 10 },
  navBtn: { height: 40, borderRadius: 20, overflow: 'hidden' },
  navBlur: { paddingHorizontal: 16, height: '100%', justifyContent: 'center', alignItems: 'center' },
  navBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  glassCard: { borderRadius: 24, padding: 24, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  threatHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  threatStatusText: { fontSize: 14, fontWeight: '900', letterSpacing: 2 },

  mainStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mainStatValue: { fontSize: 36, fontWeight: '900', color: '#FFF' },
  mainStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: '600' },
  vLine: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },

  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statWrapper: { flex: 1, height: 100, borderRadius: 20, overflow: 'hidden' },
  statBlur: { flex: 1, padding: 16, justifyContent: 'center' },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: '600', textTransform: 'uppercase' },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 16 },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  healthLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  healthStatus: { flexDirection: 'row', alignItems: 'center' },
  statusDotMini: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  healthStatusText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  hLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 16 },

  infoGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  infoValue: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  infoLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontWeight: '700', textTransform: 'uppercase' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 10 },
  liveTag: { color: '#FF3B5C', fontWeight: '900', fontSize: 10, letterSpacing: 2, backgroundColor: 'rgba(255,59,92,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  logCard: { borderRadius: 16, padding: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  logApp: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '800', textTransform: 'uppercase' },
  confidenceText: { fontSize: 11, fontWeight: '700' },
  logText: { fontSize: 15, color: '#FFF', fontWeight: '500', lineHeight: 20 },
  logFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  miniBadge: { width: 6, height: 6, borderRadius: 3 },
  logLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  logSource: { fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: '600', marginLeft: 'auto' },
  feedbackRow: { position: 'absolute', right: 16, bottom: 16, flexDirection: 'row', gap: 12 },
  fbIcon: { fontSize: 18 },
  footerSpacer: { height: 80 },
});
