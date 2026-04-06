import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { patternLearner } from '../services/patternLearner';
import { SecurityService } from '../services/securityService';

export default function HistoryScreen() {
  const nav = useNavigation();
  const [filter, setFilter] = useState<'ALL' | 'SPAM' | 'IMPORTANT' | 'PROMOTION'>('ALL');
  const [search, setSearch] = useState('');

  const history = useMemo(() => {
    let items = patternLearner.getHistory();
    if (filter !== 'ALL') items = items.filter(i => i.predictedLabel === filter);
    if (search) items = items.filter(i => i.text.toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [filter, search]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Classification History</Text>
        <Text style={styles.count}>{history.length} entries</Text>
      </Animated.View>

      {/* Search */}
      <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search notifications..."
          placeholderTextColor="rgba(255,255,255,0.3)"
        />
      </Animated.View>

      {/* Filters */}
      <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.filterRow}>
        {(['ALL', 'SPAM', 'IMPORTANT', 'PROMOTION'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'ALL' ? '📊 All' : f === 'SPAM' ? '⛔ Spam' : f === 'IMPORTANT' ? '✅ Safe' : '📢 Promo'}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* List */}
      <FlatList
        data={history}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index * 50, 500)).duration(400)}>
            <LinearGradient colors={['rgba(20,20,40,0.7)', 'rgba(10,10,30,0.9)']} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardApp}>{item.packageName.split('.').pop()}</Text>
                <Text style={styles.cardTime}>{formatTime(item.timestamp)}</Text>
              </View>
              <Text style={styles.cardText} numberOfLines={3}>{item.text}</Text>
              <View style={styles.cardFooter}>
                <View style={[styles.badge, {
                  backgroundColor: item.predictedLabel === 'SPAM' ? 'rgba(255,59,92,0.2)' :
                    item.predictedLabel === 'IMPORTANT' ? 'rgba(0,230,118,0.2)' : 'rgba(255,184,0,0.2)'
                }]}>
                  <Text style={[styles.badgeText, {
                    color: item.predictedLabel === 'SPAM' ? '#FF3B5C' :
                      item.predictedLabel === 'IMPORTANT' ? '#00E676' : '#FFB800'
                  }]}>
                    {item.predictedLabel} {(item.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
                {/* Override buttons */}
                <View style={styles.overrideRow}>
                  <TouchableOpacity style={styles.overrideBtn} onPress={() => SecurityService.submitFeedback(item.text, 'SPAM')}>
                    <Text style={styles.overrideText}>⛔</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.overrideBtn} onPress={() => SecurityService.submitFeedback(item.text, 'IMPORTANT')}>
                    <Text style={styles.overrideText}>✅</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.overrideBtn} onPress={() => SecurityService.submitFeedback(item.text, 'PROMOTION')}>
                    <Text style={styles.overrideText}>📢</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No history yet. Notifications will appear here as they're processed.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  header: { paddingHorizontal: 20, paddingTop: 60 },
  backBtn: { marginBottom: 8 },
  backText: { color: '#00D4FF', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  count: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  searchRow: { paddingHorizontal: 20, marginTop: 16 },
  searchInput: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, color: '#FFF', fontSize: 14, backgroundColor: 'rgba(20,20,40,0.5)' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 12, gap: 8 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' },
  filterBtnActive: { backgroundColor: 'rgba(0,212,255,0.2)', borderWidth: 1, borderColor: '#00D4FF' },
  filterText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  filterTextActive: { color: '#00D4FF' },
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardApp: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  cardTime: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  cardText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  overrideRow: { flexDirection: 'row', gap: 6 },
  overrideBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  overrideText: { fontSize: 14 },
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, textAlign: 'center' },
});
