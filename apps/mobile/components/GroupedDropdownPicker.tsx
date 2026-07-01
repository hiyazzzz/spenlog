import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { COLORS, RADIUS } from '@/constants/theme';

const GROUPED_PANEL_MAX = 300;

export type GroupedItem =
  | { type: 'header'; label: string }
  | { type: 'item'; label: string; value: string };

interface Props {
  value: string;
  items: GroupedItem[];
  onSelect: (v: string) => void;
  placeholder?: string;
  inline?: boolean;
}

export default function GroupedDropdownPicker({
  value, items, onSelect, placeholder = '선택하세요', inline = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const [panelMaxH, setPanelMaxH] = useState(GROUPED_PANEL_MAX);
  const btnRef = useRef<View>(null);

  function handleInlinePress() {
    if (open) { setOpen(false); return; }
    const screenH = Dimensions.get('window').height;
    btnRef.current?.measure((_x, _y, _w, h, _px, pageY) => {
      const spaceBelow = screenH - pageY - h - 12;
      const spaceAbove = pageY - 12;
      if (spaceBelow >= GROUPED_PANEL_MAX || spaceBelow >= spaceAbove) {
        setFlipUp(false);
        setPanelMaxH(Math.max(80, Math.min(spaceBelow, GROUPED_PANEL_MAX)));
      } else {
        setFlipUp(true);
        setPanelMaxH(Math.max(80, Math.min(spaceAbove, GROUPED_PANEL_MAX)));
      }
      setOpen(true);
    });
  }

  const listContent = items.map((item, idx) => {
    if (item.type === 'header') {
      return (
        <View key={`header-${idx}`} style={styles.headerRow}>
          <Text style={styles.headerText}>{item.label}</Text>
        </View>
      );
    }
    const active = value === item.value;
    return (
      <TouchableOpacity
        key={item.value}
        style={[styles.itemRow, active && styles.itemRowActive]}
        onPress={() => { onSelect(item.value); setOpen(false); }}
        activeOpacity={0.7}
      >
        <Text style={[styles.itemText, active && styles.itemTextActive]}>
          {item.label}
        </Text>
        {active && <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text>}
      </TouchableOpacity>
    );
  });

  if (inline) {
    const panelView = (
      <View style={[styles.inlinePanel, { maxHeight: panelMaxH }, flipUp ? { marginBottom: 2, marginTop: 0 } : { marginTop: 4, marginBottom: 0 }]}>
        <ScrollView bounces={false} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {listContent}
        </ScrollView>
      </View>
    );
    return (
      <View>
        {open && flipUp && panelView}
        <TouchableOpacity ref={btnRef} style={styles.btn} onPress={handleInlinePress} activeOpacity={0.7}>
          <Text style={value ? styles.value : styles.placeholder} numberOfLines={1}>
            {value || placeholder}
          </Text>
          <Text style={styles.arrow}>{open ? '▴' : '▾'}</Text>
        </TouchableOpacity>
        {open && !flipUp && panelView}
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={value ? styles.value : styles.placeholder} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={styles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView style={{ maxHeight: 360 }} bounces={false}>
              {listContent}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.gray100, borderRadius: RADIUS.md,
  },
  value: { fontSize: 14, fontWeight: '600', color: COLORS.gray800, flex: 1 },
  placeholder: { fontSize: 14, color: COLORS.gray400, flex: 1 },
  arrow: { fontSize: 10, color: COLORS.gray400, marginLeft: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 36,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 8,
  },
  // 그룹 헤더: 선택 불가, 회색 배경 + 작은 라벨
  headerRow: {
    paddingHorizontal: 20, paddingVertical: 7,
    backgroundColor: COLORS.gray50,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.gray200,
    marginTop: 2,
  },
  headerText: {
    fontSize: 11, fontWeight: '700', color: COLORS.gray500, letterSpacing: 0.6,
  },
  // 선택 가능 항목: 들여쓰기로 헤더와 구분
  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 28,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray100,
  },
  itemRowActive: { backgroundColor: COLORS.primary },
  itemText: { fontSize: 14, color: COLORS.gray700 },
  itemTextActive: { color: '#fff', fontWeight: '700' },
  inlinePanel: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: COLORS.gray200,
    marginTop: 4, overflow: 'hidden', elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6,
  },
});
