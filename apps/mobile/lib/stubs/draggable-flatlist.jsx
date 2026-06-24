// Expo Go stub for react-native-draggable-flatlist
// react-native-worklets (Reanimated 4) not available in Expo Go.
// Drag-to-reorder disabled in Expo Go dev mode.
import React from 'react';
import { FlatList, ScrollView } from 'react-native';

export default function DraggableFlatList(props) {
  return <FlatList {...props} renderItem={props.renderItem} />;
}

export function ScaleDecorator({ children }) {
  return children;
}

export function ShadowDecorator({ children }) {
  return children;
}

export function OpacityDecorator({ children }) {
  return children;
}

export function NestableDraggableFlatList(props) {
  return <FlatList {...props} renderItem={props.renderItem} />;
}

export function NestableScrollContainer({ children, ...rest }) {
  return <ScrollView {...rest}>{children}</ScrollView>;
}
