import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

interface Props {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  dismissOnBackdrop?: boolean;
}

export default function SlideUpModal({
  visible,
  onRequestClose,
  children,
  dismissOnBackdrop = true,
}: Props) {
  const [internalVisible, setInternalVisible] = useState(false);
  const translateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      translateY.setValue(300);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: 300,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setInternalVisible(false);
      });
    }
  }, [visible]);

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        {dismissOnBackdrop && (
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={onRequestClose}
          />
        )}
        <Animated.View style={{ transform: [{ translateY }] }}>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
});
