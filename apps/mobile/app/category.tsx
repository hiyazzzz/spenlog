import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { COLORS, RADIUS, formatCurrency } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import {
  ensureDefaultCategories, addCategory, renameCategory, hideCategory, restoreCategory,
  reorderCategories, getCategorySpending, type CategoryItem,
} from '@/lib/api/categories';

export default function CategoryScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const uid = await getCurrentUserId();
      if (!uid) {
        setError('로그인이 필요해요');
        return;
      }
      setUserId(uid);
      const [cats, spent] = await Promise.all([
        ensureDefaultCategories(uid),
        getCategorySpending(uid),
      ]);
      setCategories(cats);
      setSpentMap(spent);
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

  function startEdit(cat: CategoryItem) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  async function confirmEdit() {
    const name = editName.trim();
    if (!editingId || !name) return;
    setEditingId(null);
    await renameCategory(editingId, name);
    await load();
  }

  function handleDelete(cat: CategoryItem) {
    Alert.alert('카테고리 삭제', `'${cat.name}' 카테고리를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await hideCategory(cat.id);
          await load();
        },
      },
    ]);
  }

  async function handleRestore(id: string) {
    await restoreCategory(id);
    await load();
  }

  async function handleDragEnd({ data }: { data: CategoryItem[] }) {
    setCategories(prev => {
      const hidden = prev.filter(c => c.is_hidden);
      return [...data, ...hidden];
    });
    setReordering(true);
    try {
      const { error } = await reorderCategories(data.map((c, i) => ({ id: c.id, sort_order: i })));
      if (error) {
        Alert.alert('저장 실패', '순서를 저장하지 못했어요. 다시 시도해 주세요.');
        await load();
      }
    } finally {
      setReordering(false);
    }
  }

  const visible = categories.filter(c => !c.is_hidden);
  const hidden = categories.filter(c => c.is_hidden);

  const renderItem = ({ item, drag, isActive }: RenderItemParams<CategoryItem>) => {
    const isEditing = editingId === item.id;
    const spent = spentMap[item.name] ?? 0;

    return (
      <ScaleDecorator>
        <View style={[styles.row, isActive && styles.rowActive]}>
          <TouchableOpacity onPressIn={drag} hitSlop={8} style={styles.dragHandle}>
            <Ionicons name="reorder-three" size={22} color={COLORS.gray300} />
          </TouchableOpacity>

          <View style={styles.rowBody}>
            {isEditing ? (
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                maxLength={10}
                autoFocus
                onSubmitEditing={confirmEdit}
              />
            ) : (
              <>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowSpent}>이번달 {formatCurrency(spent)}</Text>
              </>
            )}
          </View>

          {isEditing ? (
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={confirmEdit} hitSlop={8}>
                <Ionicons name="checkmark" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setEditingId(null)} hitSlop={8}>
                <Ionicons name="close" size={18} color={COLORS.gray400} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => startEdit(item)} hitSlop={8}>
                <Ionicons name="pencil" size={16} color={COLORS.gray400} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={COLORS.red} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={reordering}>
          <Ionicons name="chevron-back" size={24} color={reordering ? COLORS.gray300 : COLORS.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>카테고리 관리</Text>
        {reordering
          ? <ActivityIndicator size="small" color={COLORS.primary} style={styles.backBtn} />
          : <View style={styles.backBtn} />
        }
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
        <DraggableFlatList
          data={visible}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          onDragEnd={handleDragEnd}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <Text style={styles.helperText}>드래그로 순서를 바꾸고, 연필을 눌러 이름을 수정할 수 있어요.</Text>
          }
          ListFooterComponent={
            <>
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
            </>
          }
        />
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

  helperText: { fontSize: 11, color: COLORS.gray400, marginBottom: 12 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  rowActive: { opacity: 0.6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  dragHandle: { padding: 4 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  rowSpent: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  editInput: {
    borderWidth: 1.5, borderColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: COLORS.gray800, backgroundColor: '#fff',
  },
  rowActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 30, height: 30, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: COLORS.gray400, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  hiddenChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: COLORS.gray100 },
  hiddenChipText: { fontSize: 11, color: COLORS.gray400 },

  addBtn: {
    marginTop: 4, paddingVertical: 10, borderRadius: 999, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.primaryLight, borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.primaryLight, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: COLORS.gray800, backgroundColor: '#fff',
  },
  confirmBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  confirmBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
  cancelBtnText: { fontSize: 12, color: COLORS.gray500 },
});
