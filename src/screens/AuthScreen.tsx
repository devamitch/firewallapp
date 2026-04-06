import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, 
  Dimensions, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, FadeIn,
} from 'react-native-reanimated';
import { BlurView } from '@react-native-community/blur';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Liquid background
  const orb1X = useSharedValue(0);
  const orb1Y = useSharedValue(0);
  const orb2X = useSharedValue(width);
  const orb2Y = useSharedValue(height);

  useEffect(() => {
    orb1X.value = withRepeat(withTiming(width, { duration: 15000 }), -1, true);
    orb1Y.value = withRepeat(withTiming(height, { duration: 12000 }), -1, true);
    orb2X.value = withRepeat(withTiming(0, { duration: 18000 }), -1, true);
    orb2Y.value = withRepeat(withTiming(0, { duration: 14000 }), -1, true);
  }, []);

  const orb1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: orb1X.value }, { translateY: orb1Y.value }],
  }));
  const orb2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: orb2X.value }, { translateY: orb2Y.value }],
  }));

  const handlePinPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        // Mock authentication success
        if (newPin === '1234') {
          navigation.replace('Dashboard' as any);
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 500);
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Liquid Background */}
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.orb, styles.orb1, orb1Style]} />
        <Animated.View style={[styles.orb, styles.orb2, orb2Style]} />
      </View>

      <BlurView blurType="dark" style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.content}
      >
        <Animated.View entering={FadeIn.duration(1000)} style={styles.header}>
          <View style={styles.iconCircle}>
             <Text style={styles.shieldEmoji}>🛡️</Text>
          </View>
          <Text style={styles.title}>Secure Access</Text>
          <Text style={styles.subtitle}>Enter your PIN to manage AI Shield</Text>
        </Animated.View>

        <View style={styles.pinContainer}>
          {[0, 1, 2, 3].map((i) => (
            <View 
              key={i} 
              style={[
                styles.pinDot, 
                pin.length > i && styles.pinDotFilled,
                error && styles.pinDotError
              ]} 
            />
          ))}
        </View>

        <View style={styles.keypad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '←'].map((key, i) => (
            <TouchableOpacity 
              key={i} 
              style={styles.key}
              onPress={() => {
                if (key === '←') setPin(pin.slice(0, -1));
                else if (key !== '') handlePinPress(key.toString());
              }}
              disabled={key === ''}
            >
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020208' },
  orb: { position: 'absolute', width: 400, height: 400, borderRadius: 200, opacity: 0.3 },
  orb1: { backgroundColor: '#00D4FF', top: -100, left: -100 },
  orb2: { backgroundColor: '#8B5CF6', bottom: -100, right: -100 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: { alignItems: 'center', marginBottom: 60 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,212,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)' },
  shieldEmoji: { fontSize: 40 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8, fontWeight: '600' },
  pinContainer: { flexDirection: 'row', gap: 20, marginBottom: 60 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  pinDotFilled: { backgroundColor: '#00D4FF', borderColor: '#00D4FF' },
  pinDotError: { backgroundColor: '#FF3B5C', borderColor: '#FF3B5C' },
  keypad: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20 },
  key: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  keyText: { fontSize: 24, color: '#FFF', fontWeight: '700' },
});
