import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { COLORS, RADIUS, useThemeColors } from '@/constants/theme';

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
  const { themeColors } = useThemeColors();
  const [open, setOpen] = useState(false);
  const [panelMaxH, setPanelMaxH] = useState(GROUPED_PANEL_MAX);
  const [panelPos, setPanelPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });
  const btnRef = useRef<any>(null);

  function handleInlinePress() {
    if (open) { setOpen(false); return; }
    const screenH = Dimensions.get('window').height;
    btnRef.current?.measure((_x: number, _y: number, w: number, h: number, px: number, py: number) => {
      const spaceBelow = screenH - py - h - 12;
      const spaceAbove = py - 12;
      const maxH = Math.max(80, Math.min(Math.max(spaceBelow, spaceAbove), GROUPED_PANEL_MAX));
      setPanelMaxH(maxH);
      if (spaceBelow >= GROUPED_PANEL_MAX || spaceBelow >= spaceAbove) {
        setPanelPos({ top: py + h + 2, left: px, width: w });
      } else {
        setPanelPos({ bottom: screenH - py + 2, left: px, width: w });
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
        style={[styles.itemRow, active && styles.itemRowActive, active && { backgroundColor: themeColors.primary }]}
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
    return (
      <>
        <TouchableOpacity ref={btnRef} style={styles.btn} onPress={handleInlinePress} activeOpacity={0.7}>
          <Text style={value ? styles.value : styles.placeholder} numberOfLines={1}>
            {value || placeholder}
          </Text>
          <Text style={styles.arrow}>{open ? '▴' : '▾'}</Text>
        </TouchableOpacity>
        <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
            <View style={[styles.overlayPanel, {
              position: 'absolute',
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: panelMaxH,
              ...(panelPos.top !== undefined ? { top: panelPos.top } : { bottom: panelPos.bottom }),
            }]}>
              <ScrollView bounces={false} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {listContent}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </>
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
  headerRow: {
    paddingHorizontal: 20, paddingVertical: 7,
    backgroundColor: COLORS.gray50,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.gray200,
    marginTop: 2,
  },
  headerText: {
    fontSize: 11, fontWeight: '700', color: COLORS.gray500, letterSpacing: 0.6,
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 28,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray100,
  },
  itemRowActive: { backgroundColor: COLORS.primary },
  itemText: { fontSize: 14, color: COLORS.gray700 },
  itemTextActive: { color: '#fff', fontWeight: '700' },
  overlayPanel: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: COLORS.gray200,
    overflow: 'hidden', elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
});
