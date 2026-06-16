import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, CARD_PALETTE, CARD_SHADOW, formatCurrency } from '@/constants/theme';
import { uploadHomeImage, updateHomeCustomization, CAT_IMG_FIELDS } from '@/lib/api/home';

interface RecentExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  payment_method: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  userId: string;
  displayName: string;
  totalSpent: number;
  savingGoal: number;
  actualSaving: number;
  categories: string[];
  catMap: Record<string, number>;
  budgetMap: Record<string, number>;
  currentCoverUrl: string | null;
  currentCategoryUrls: (string | null)[];
  recentExpenses: RecentExpense[];
}



export default function HomeEditModal({
  visible, onClose, onSaved, userId, displayName, totalSpent, savingGoal, actualSaving,
  categories, catMap, budgetMap, currentCoverUrl, currentCategoryUrls, recentExpenses,
}: Props) {
  const catKeys = categories.slice(0, 4);


  const [coverPreview, setCoverPreview] = useState<string | null>(currentCoverUrl);
  const [coverChanged, setCoverChanged] = useState<'none' | 'new' | 'removed'>('none');
  const [coverBase64, setCoverBase64] = useState<{ base64: string; mime: string } | null>(null);

  const [catPreviews, setCatPreviews] = useState<(string | null)[]>(currentCategoryUrls);
  const [catChanged, setCatChanged] = useState<('none' | 'new' | 'removed')[]>(catKeys.map(() => 'none'));
  const [catBase64, setCatBase64] = useState<({ base64: string; mime: string } | null)[]>(catKeys.map(() => null));

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCoverPreview(currentCoverUrl);
      setCoverChanged('none');
      setCoverBase64(null);
      setCatPreviews(currentCategoryUrls);
      setCatChanged(catKeys.map(() => 'none'));
      setCatBase64(catKeys.map(() => null));
    }
  }, [visible]);

  const dirty = coverChanged !== 'none' || catChanged.some(c => c !== 'none');

  function handleClose() {
    if (dirty) {
      Alert.alert('변경 사항이 저장되지 않아요', '나가시겠어요?', [
        { text: '취소', style: 'cancel' },
        { text: '나가기', style: 'destructive', onPress: onClose },
      ]);
      return;
    }
    onClose();
  }

  async function pickImage(): Promise<{ uri: string; base64: string; mime: string } | null> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요해요');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return null;
    const mime = asset.mimeType ?? (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg');
    return { uri: asset.uri, base64: asset.base64, mime };
  }

  async function handleCoverPick() {
    const picked = await pickImage();
    if (!picked) return;
    setCoverPreview(picked.uri);
    setCoverBase64({ base64: picked.base64, mime: picked.mime });
    setCoverChanged('new');
  }

  function handleCoverRemove() {
    setCoverPreview(null);
    setCoverBase64(null);
    setCoverChanged('removed');
  }

  async function handleCatPick(idx: number) {
    const picked = await pickImage();
    if (!picked) return;
    setCatPreviews(prev => prev.map((v, i) => (i === idx ? picked.uri : v)));
    setCatBase64(prev => prev.map((v, i) => (i === idx ? { base64: picked.base64, mime: picked.mime } : v)));
    setCatChanged(prev => prev.map((v, i) => (i === idx ? 'new' : v)));
  }

  function handleCatRemove(idx: number) {
    setCatPreviews(prev => prev.map((v, i) => (i === idx ? null : v)));
    setCatBase64(prev => prev.map((v, i) => (i === idx ? null : v)));
    setCatChanged(prev => prev.map((v, i) => (i === idx ? 'removed' : v)));
  }

  async function handleApply() {
    if (!dirty) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const updates: Record<string, string | null> = {};

      if (coverChanged === 'new' && coverBase64) {
        const { url, error: uploadErr } = await uploadHomeImage(userId, coverBase64.base64, coverBase64.mime, 'cover');
        if (uploadErr) {
          Alert.alert('이미지 업로드 실패', uploadErr);
          return;
        }
        if (url) updates['home_cover_url'] = url;
      } else if (coverChanged === 'removed') {
        updates['home_cover_url'] = null;
      }

      for (let i = 0; i < catKeys.length; i++) {
        if (catChanged[i] === 'new' && catBase64[i]) {
          const { url, error: uploadErr } = await uploadHomeImage(userId, catBase64[i]!.base64, catBase64[i]!.mime, `cat-slot-${i + 1}`);
          if (uploadErr) {
            Alert.alert('이미지 업로드 실패', uploadErr);
            return;
          }
          if (url) updates[CAT_IMG_FIELDS[i]] = url;
        } else if (catChanged[i] === 'removed') {
          updates[CAT_IMG_FIELDS[i]] = null;
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await updateHomeCustomization(userId, updates);
        if (error) {
          Alert.alert('저장 실패', error.message);
          return;
        }
      }
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.screen}>
        {/* 상단 편집 바 */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClose} disabled={saving}>
            <Text style={styles.topBarCancel}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>홈편집</Text>
          <TouchableOpacity onPress={handleApply} disabled={saving}>
            <Text style={[styles.topBarApply, saving && { color: COLORS.gray300 }]}>
              {saving ? '저장 중...' : '적용'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* 1. 커버 배너 */}
          <View style={styles.coverWrap}>
            {coverPreview ? (
              <ImageBackground source={{ uri: coverPreview }} style={styles.cover} imageStyle={{ borderRadius: RADIUS.lg }}>
                <View style={styles.coverDim} />
              </ImageBackground>
            ) : (
              <View style={[styles.cover, { backgroundColor: COLORS.primary }]} />
            )}
            <View style={styles.coverGreeting}>
              <Text style={styles.coverHello}>안녕하세요 👋</Text>
              <Text style={styles.coverName}>{displayName}님</Text>
            </View>
            <View style={styles.coverStatsBar}>
              <View>
                <Text style={styles.coverStatLabel}>이번 달 지출</Text>
                <Text style={styles.coverStatValue}>{formatCurrency(totalSpent)}</Text>
              </View>
              {savingGoal > 0 && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.coverStatLabel}>저축 달성</Text>
                  <Text style={styles.coverSavingValue}>{formatCurrency(actualSaving)} / {formatCurrency(savingGoal)}</Text>
                </View>
              )}
            </View>
            <View style={styles.coverBtnRow}>
              <TouchableOpacity style={styles.coverEditBtn} onPress={handleCoverPick}>
                <Text style={styles.coverEditBtnText}>이미지 변경</Text>
              </TouchableOpacity>
              {coverPreview && (
                <TouchableOpacity style={styles.coverEditBtn} onPress={handleCoverRemove}>
                  <Text style={styles.coverEditBtnText}>제거</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 2. 한 줄 기록 (딤 처리 - 홈화면과 동일한 UI) */}
          <View style={[styles.card, { position: 'relative', overflow: 'hidden' }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>한 줄 기록</Text>
              <View style={styles.addCircleBtn}>
                <Ionicons name="create-outline" size={16} color={COLORS.text} />
              </View>
            </View>
            <View style={styles.aiInputRow}>
              <TextInput
                style={styles.aiInput}
                placeholder="예) 스타벅스 육천원 카드"
                placeholderTextColor={COLORS.gray400}
                editable={false}
              />
              <View style={[styles.aiSubmitBtn, { backgroundColor: COLORS.gray300 }]}>
                <Ionicons name="arrow-up" size={18} color="#fff" />
              </View>
            </View>
            <View style={styles.dimOverlay} />
          </View>

          {/* 3. 카테고리 현황 */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>카테고리 현황</Text>
              <Text style={styles.linkText}>카테고리 관리 →</Text>
            </View>
            <View style={styles.grid}>
              {catKeys.map((cat, idx) => {
                const net = catMap[cat] ?? 0;
                const spent = Math.abs(net);
                const budget = budgetMap[cat] ?? 0;
                const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
                const over = budget > 0 && spent > budget;
                const barColor = over ? COLORS.red : pct >= 70 ? COLORS.amber : COLORS.primary;
                const cardBg = CARD_PALETTE[idx] ?? CARD_PALETTE[0];
                const imgUrl = catPreviews[idx];

                return (
                  <View key={cat} style={styles.gridItem}>
                    {imgUrl ? (
                      <ImageBackground source={{ uri: imgUrl }} style={styles.gridItemTop} imageStyle={{ borderRadius: 0 }}>
                        {over && (
                          <View style={styles.overBadge}>
                            <Text style={styles.overBadgeText}>초과 ⚠️</Text>
                          </View>
                        )}
                        <View style={styles.gridItemLabelWrap}>
                          <Text style={styles.gridItemLabel}>{cat}</Text>
                        </View>
                        <View style={styles.catEditOverlay}>
                          <TouchableOpacity style={styles.catEditBtn} onPress={() => handleCatPick(idx)}>
                            <Text style={styles.catEditBtnText}>변경</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.catEditBtn} onPress={() => handleCatRemove(idx)}>
                            <Text style={styles.catEditBtnText}>제거</Text>
                          </TouchableOpacity>
                        </View>
                      </ImageBackground>
                    ) : (
                      <View style={[styles.gridItemTop, { backgroundColor: cardBg }]}>
                        {over && (
                          <View style={styles.overBadge}>
                            <Text style={styles.overBadgeText}>초과 ⚠️</Text>
                          </View>
                        )}
                        <View style={styles.gridItemLabelWrap}>
                          <Text style={styles.gridItemLabel}>{cat}</Text>
                        </View>
                        <View style={styles.catEditOverlay}>
                          <TouchableOpacity onPress={() => handleCatPick(idx)}>
                            <Text style={styles.catEditTapText}>탭하여 변경</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    <View style={styles.gridItemBottom}>
                      <Text style={[styles.gridItemAmount, { color: net < 0 ? COLORS.primary : COLORS.gray300 }]}>
                        {net < 0 ? '-' : ''}{formatCurrency(spent)}
                      </Text>
                      {budget > 0 && (
                        <View style={{ marginTop: 4 }}>
                          <View style={styles.progressBg}>
                            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                          </View>
                          <Text style={styles.progressLabel}>예산 {pct}% 사용</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 4. 최근 지출 내역 (딤 처리) */}
          <View style={[styles.card, { position: 'relative', overflow: 'hidden', marginBottom: 24 }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>최근 지출 내역</Text>
              <Text style={styles.linkText}>전체 보기 →</Text>
            </View>
            {recentExpenses.length === 0 ? (
              <Text style={styles.emptyText}>아직 기록된 지출이 없어요</Text>
            ) : (
              recentExpenses.map((e, i) => (
                <View key={e.id} style={[styles.expenseRow, i === 0 && { paddingTop: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expenseName} numberOfLines={1}>{e.name}</Text>
                    <Text style={styles.expenseMeta}>
                      {e.date.slice(5).replace('-', '.')} · {e.category}
                      {e.payment_method ? ' · ' + e.payment_method : ''}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmount}>-{formatCurrency(e.amount)}</Text>
                </View>
              ))
            )}
            <View style={styles.dimOverlay} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.95)', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  topBarCancel: { fontSize: 14, fontWeight: '500', color: COLORS.gray500 },
  topBarTitle: { fontSize: 15, fontWeight: '700', color: COLORS.gray800 },
  topBarApply: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  content: { padding: 16, gap: 12 },

  coverWrap: { height: 200, borderRadius: RADIUS.lg, overflow: 'hidden', position: 'relative', justifyContent: 'space-between' },
  cover: { ...StyleSheet.absoluteFillObject },
  coverDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  coverGreeting: { padding: 18 },
  coverHello: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 4 },
  coverName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  coverStatsBar: {
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: 18, paddingVertical: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  coverStatLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, marginBottom: 2 },
  coverStatValue: { color: '#fff', fontSize: 15, fontWeight: '800' },
  coverSavingValue: { color: '#a7f3d0', fontSize: 13, fontWeight: '700' },
  coverBtnRow: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 8 },
  coverEditBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  coverEditBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: '#f3f4f6',
    padding: 20, minHeight: 100, ...CARD_SHADOW,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray800 },
  linkText: { fontSize: 12, color: COLORS.primaryMid },

  addCircleBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  aiInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.gray800,
    backgroundColor: '#fafafa',
  },
  aiSubmitBtn: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },

  dimOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(250,247,244,0.60)' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: {
    width: '48%', backgroundColor: '#fff', borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden', ...CARD_SHADOW,
  },
  gridItemTop: { height: 80, justifyContent: 'flex-end' },
  gridItemLabelWrap: { padding: 10, paddingBottom: 6 },
  gridItemLabel: { fontSize: 12, fontWeight: '700', color: '#fff' },
  overBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: COLORS.redBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  overBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.red },
  gridItemBottom: { padding: 10 },
  gridItemAmount: { fontSize: 14, fontWeight: '800' },
  progressBg: { backgroundColor: COLORS.gray100, borderRadius: 4, height: 3, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontSize: 10, color: COLORS.gray400, marginTop: 2 },

  catEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  catEditBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  catEditBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  catEditTapText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  expenseRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, bor