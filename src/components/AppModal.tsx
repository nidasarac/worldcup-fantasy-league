import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";

import { AppStyles } from "../styles";
import { ThemePalette } from "../theme";

export function AppModal({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = "Vazgec",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
  styles,
  theme,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  styles: AppStyles;
  theme: ThemePalette;
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.appModalBackdrop}>
        <Pressable style={styles.appModalOverlay} onPress={onClose} />

        <View style={styles.appModalCard}>
          <View style={styles.appModalIconWrap}>
            <MaterialCommunityIcons
              name={danger ? "alert-circle-outline" : "information-outline"}
              size={26}
              color={danger ? theme.danger : theme.accent}
            />
          </View>

          <Text style={styles.appModalTitle}>{title}</Text>
          <Text style={styles.appModalBody}>{body}</Text>

          <View style={styles.appModalActions}>
            <Pressable onPress={onClose} style={styles.appModalSecondaryButton}>
              <Text style={styles.appModalSecondaryButtonText}>
                {cancelLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={[
                styles.appModalPrimaryButton,
                danger && styles.appModalDangerButton,
              ]}
            >
              <Text style={styles.appModalPrimaryButtonText}>
                {loading ? "Bekleyin..." : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
