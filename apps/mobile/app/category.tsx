import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import {
  getCategories, addCategory, hideCategory, restoreCategory,
  DEFAULT_CATEGORIES, type CategoryItem,
} from '@/lib/api/categories';

export default function CategoryScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const uid = await getCurrentUserId();
      if (!uid) {
        setError('로그인이 필요해요');
        return;
      }
      setUserId(uid);
      setCategories(await getCategories(uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleAdd() {
    const name = newName.trim();
    if (!name || !userId || saving) return;
    setSaving(true);
    try {
      const { error: err } = await addCategory(userId, name);
      if (err) {
        Alert.alert('추가 실패', err.message);
        return;
      }
      setNewName('');
      setAdding(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleHide(id: string) {
    await hideCategory(id);
    await load();
  }

  async function handleRestore(id: string) {
    await restoreCategory(id);
    await load();
  }

  const visible = categories.filter(c => !c.is_hidden);
  const hidden = categories.filter(c => c.is_hidden);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>카테고리 관리</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={[styles.center, { flex: 1 }]}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>기본 카테고리</Text>
          <View style={styles.chipRow}>
            {DEFAULT_CATEGORIES.map(cat => (
              <View key={cat} style={styles.defaultChip}>
                <Text style={styles.defaultChipText}>{cat}</Text>
              </View>
            ))}
          </View>

          {visible.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>커스텀 카테고리</Text>
              <View style={styles.chipRow}>
                {visible.map(cat => (
                  <View key={cat.id} style={styles.customChip}>
                    <Text style={styles.customChipText}>{cat.name}</Text>
                    <TouchableOpacity onPress={() => handleHide(cat.id)} hitSlop={8}>
                      <Ionicons name="close" size={14} color={COLORS.gray400} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}

          {adding ? (
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                placeholder="카테고리명"
                placeholderTextColor={COLORS.gray400}
                value={newName}
                onChangeText={setNewName}
                maxLength={10}
                autoFocus
                onSubmitEditing={handleAdd}
              />
              <TouchableOpacity style={styles.confirmBtn} onPress={handleAdd} disabled={saving || !newName.trim()}>
                <Text style={styles.confirmBtnText}>{saving ? '추가 중...' : '추가'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setAdding(false); setNewName(''); }}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)}>
              <Text style={styles.addBtnText}>+ 카테고리 추가</Text>
            </TouchableOpacity>
          )}

          {hidden.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>숨긴 카테고리</Text>
              <View style={styles.chipRow}>
                {hidden.map(cat => (
                  <TouchableOpacity key={cat.id} style={styles.hiddenChip} onPress={() => handleRestore(cat.id)}>
                    <Text style={styles.hiddenChipText}>{cat.name} 복원</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 8, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800 },
  content: { padding: 16, paddingBottom: 40 },
  emptyText: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', paddingVertical: 16 },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: COLORS.gray400, marginBottom: 8, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },

  defaultChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.primaryLight },
  defaultChipText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  customChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.gray100,
  },
  customChipText: { fontSize: 12, color: COLORS.gray700 },

  hiddenChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: COLORS.gray100 },
  hiddenChipText: { fontSize: 11, color: COLORS.gray400 },

  addBtn: {
    marginTop: 12, paddingVertical: 10, borderRadius: 999, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.primaryLight, borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12 },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.primaryLight, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: COLORS.gray800, backgroundColor: '#fff',
  },
  confirmBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  confirmBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
  cancelBtnText: { fontSize: 12, color: COLORS.gray500 },
});
