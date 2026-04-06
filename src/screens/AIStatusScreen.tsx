import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAIStore } from '../store/aiStore';
import { llmService } from '../services/llmService';
import { SecurityService } from '../services/securityService';

export default function AIStatusScreen() {
  const nav = useNavigation();
  const ai = useAIStore();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadModel = useCallback(async () => {
    setDownloading(true);
    try {
      const path = await llmService.downloadModel((p) => {
        ai.setLlmProgress(p);
      });
      await llmService.initialize(path);
      Alert.alert('✅ LLM Ready', 'On-device AI engine is now active.');
    } catch (e: any) {
      Alert.alert('Download Failed', e.message);
    } finally {
      setDownloading(false);
    }
  }, []);

  const handleFineTune = useCallback(async () => {
    const result = await SecurityService.autoFineTune();
    Alert.alert('Fine-Tune Complete', `Patterns updated: ${result.patternsUpdated}\nAccuracy: ${(result.accuracy * 100).toFixed(1)}%`);
    SecurityService.getStats();
  }, []);

  const StatusDot = ({ active }: { active: boolean }) => (
    <View style={[styles.dot, { backgroundColor: active ? '#00E676' : '#FF3B5C' }]} />
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>AI Engine Status</Text>
          <Text style={styles.subtitle}>On-device intelligence</Text>
        </Animated.View>

        {/* Engine Status */}
        <Animated.View entering={FadeInUp.delay(200).duration(600)}>
          <LinearGradient colors={['rgba(20,20,40,0.7)', 'rgba(10,10,30,0.9)']} style={styles.card}>
            <Text style={styles.sectionTitle}>⚡ Processing Engines</Text>

            <View style={styles.engineRow}>
              <StatusDot active={ai.engineReady} />
              <View style={styles.engineInfo}>
                <Text style={styles.engineName}>C++ TurboModule (JSI)</Text>
                <Text style={styles.engineDesc}>Sub-millisecond rule engine • Zero bridge overhead</Text>
              </View>
            </View>

            <View style={styles.engineRow}>
              <StatusDot active={ai.llmStatus === 'READY'} />
              <View style={styles.engineInfo}>
                <Text style={styles.engineName}>On-Device LLM (llama.cpp)</Text>
                <Text style={styles.engineDesc}>
                  {ai.llmStatus === 'READY' ? 'Deep analysis active' :
                   ai.llmStatus === 'DOWNLOADING' ? `Downloading... ${(ai.llmProgress * 100).toFixed(0)}%` :
                   ai.llmStatus === 'LOADING' ? 'Loading model into memory...' :
                   ai.llmStatus === 'ERROR' ? `Error: ${ai.llmError}` :
                   'Not initialized — download model below'}
                </Text>
              </View>
            </View>

            <View style={styles.engineRow}>
              <StatusDot active={true} />
              <View style={styles.engineInfo}>
                <Text style={styles.engineName}>Pattern Learner (MMKV)</Text>
                <Text style={styles.engineDesc}>{ai.totalPatterns} patterns • Self-learning active</Text>
              </View>
            </View>

            <View style={styles.engineRow}>
              <StatusDot active={ai.vectorCount > 0} />
              <View style={styles.engineInfo}>
                <Text style={styles.engineName}>Vector DB (ChromaDB-style)</Text>
                <Text style={styles.engineDesc}>{ai.vectorCount} vectors • Cosine similarity search</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Download Progress */}
        {ai.llmStatus === 'DOWNLOADING' && (
          <Animated.View entering={FadeInUp.duration(400)}>
            <LinearGradient colors={['rgba(0,212,255,0.15)', 'rgba(0,100,150,0.05)']} style={styles.card}>
              <Text style={styles.sectionTitle}>📥 Downloading Model</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${ai.llmProgress * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>{(ai.llmProgress * 100).toFixed(1)}%</Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Vector Store Stats */}
        <Animated.View entering={FadeInUp.delay(300).duration(600)}>
          <LinearGradient colors={['rgba(20,20,40,0.7)', 'rgba(10,10,30,0.9)']} style={styles.card}>
            <Text style={styles.sectionTitle}>🗄️ Vector Database</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#FF3B5C' }]}>{ai.vectorSpam}</Text>
                <Text style={styles.statName}>Spam</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#00E676' }]}>{ai.vectorImportant}</Text>
                <Text style={styles.statName}>Important</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#FFB800' }]}>{ai.vectorPromo}</Text>
                <Text style={styles.statName}>Promo</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#00D4FF' }]}>{ai.nativePatternCount}</Text>
                <Text style={styles.statName}>C++ Native</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInUp.delay(400).duration(600)}>
          <LinearGradient colors={['rgba(20,20,40,0.7)', 'rgba(10,10,30,0.9)']} style={styles.card}>
            <Text style={styles.sectionTitle}>🔧 Actions</Text>

            {ai.llmStatus !== 'READY' && (
              <TouchableOpacity
                style={[styles.actionBtn, downloading && styles.actionBtnDisabled]}
                onPress={handleDownloadModel}
                disabled={downloading}
              >
                <Text style={styles.actionText}>
                  {downloading ? '⏳ Downloading...' : '📥 Download & Activate LLM Model'}
                </Text>
                <Text style={styles.actionDesc}>~1.5 GB • gemma-2b-it Q4 • Free & Open Source</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionBtn} onPress={handleFineTune}>
              <Text style={styles.actionText}>🔄 Run Auto Fine-Tune</Text>
              <Text style={styles.actionDesc}>Batch-learn from history, prune stale patterns</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                SecurityService.getStats();
                Alert.alert('Stats Refreshed', 'All counters updated from native engine.');
              }}
            >
              <Text style={styles.actionText}>📊 Refresh Stats</Text>
              <Text style={styles.actionDesc}>Sync counters from C++ engine & MMKV</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {/* Architecture Info */}
        <Animated.View entering={FadeInUp.delay(500).duration(600)}>
          <LinearGradient colors={['rgba(20,20,40,0.7)', 'rgba(10,10,30,0.9)']} style={styles.card}>
            <Text style={styles.sectionTitle}>🏗️ Architecture</Text>
            <Text style={styles.archText}>
              {`React Native UI (Liquid Glass)
          ↓ hooks
Zustand + MMKV (Native C++ mmap)
          ↓ JSI
C++ TurboModule (AIEngine)
          ↓ native threads
Android Services (Kotlin)
  • NotificationListenerService
  • CallScreeningService
  • HeadlessJsTaskService
          ↓ system hooks
llama.rn → GGUF model inference`}
            </Text>
          </LinearGradient>
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
  title: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 },
  card: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 16 },
  engineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  engineInfo: { flex: 1 },
  engineName: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  engineDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: '100%', backgroundColor: '#00D4FF', borderRadius: 3 },
  progressText: { fontSize: 13, color: '#00D4FF', fontWeight: '700', marginTop: 6, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { alignItems: 'center', flex: 1 },
  statNum: { fontSize: 24, fontWeight: '800' },
  statName: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  actionBtn: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(0,212,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)', marginBottom: 10 },
  actionBtnDisabled: { opacity: 0.5 },
  actionText: { color: '#00D4FF', fontSize: 14, fontWeight: '700' },
  actionDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
  archText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', lineHeight: 18 },
});
