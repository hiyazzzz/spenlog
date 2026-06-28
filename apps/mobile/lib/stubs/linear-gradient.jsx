import React from 'react';
import { View } from 'react-native';

// Expo Go stub: expo-linear-gradient 네이티브 모듈 미지원 대체
// style 뒤에 backgroundColor를 적용해야 styles.row의 '#fff'에 덮이지 않음
// dev build 전환 시 metro.config.js resolveRequest 블록 제거
export function LinearGradient({ colors, style, children, ...props }) {
  const bgColor = colors && colors.length > 0 ? colors[0] : 'transparent';
  return (
    <View style={[style, { backgroundColor: bgColor }]} {...props}>
      {children}
    </View>
  );
}

export default LinearGradient;
