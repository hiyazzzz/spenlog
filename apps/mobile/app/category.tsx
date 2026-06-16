import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
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
                {spent > 0 && <Text style={styles.rowSpent}>이번달 {formatCurrency(spent)}</Text>}
              </>
            )}
          </View>

          {isEditing ? (
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.textBtn} onPress={confirmEdit} hitSlop={8}>
                <Text style={styles.textBtnLabel}>완료</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.textBtnCancel} onPress={() => setEditingId(null)} hitSlop={8}>
                <Text style={styles.textBtnCancelLabel}>취소</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.textBtn} onPress={() => startEdit(item)} hitSlop={8}>
                <Text style={styles.textBtnLabel}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.textBtnDelete} onPress={() => handleDelete(item)} hitSlop={8}>
                <Text style={styles.textBtnDeleteLabel}>삭제</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
            <Text style={styles.helperText}>드래그로 순서를 바꾸고, 탭해서 이름을 수정할 수 있어요.{'\n'}기본 카테고리도 수정·삭제 가능해요.</Text>
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
                    <Te