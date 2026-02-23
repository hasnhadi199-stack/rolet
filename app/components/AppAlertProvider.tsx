import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type AlertButtonStyle = "default" | "cancel" | "destructive";

export type AppAlertButton = {
  text: string;
  onPress?: () => void;
  style?: AlertButtonStyle;
};

export type AppAlertOptions = {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
  type?: "info" | "success" | "warning" | "error";
};

type AppAlertContextValue = {
  show: (options: AppAlertOptions) => void;
  hide: () => void;
};

const AppAlertContext = createContext<AppAlertContextValue | null>(null);

export function useAppAlert(): AppAlertContextValue {
  const ctx = useContext(AppAlertContext);
  if (!ctx) {
    throw new Error("useAppAlert must be used inside AppAlertProvider");
  }
  return ctx;
}

const BG = "rgba(15, 23, 42, 0.96)";
const CARD = "rgba(17, 24, 39, 0.98)";
const TEXT = "#f5f3ff";
const MUTED = "rgba(203, 213, 225, 0.8)";

function iconForType(type: AppAlertOptions["type"]) {
  switch (type) {
    case "success":
      return { name: "checkmark-circle-outline" as const, color: "#22c55e" };
    case "warning":
      return { name: "warning-outline" as const, color: "#f59e0b" };
    case "error":
      return { name: "alert-circle-outline" as const, color: "#f87171" };
    default:
      return { name: "information-circle-outline" as const, color: "#a78bfa" };
  }
}

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AppAlertOptions | null>(null);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  const show = useCallback((opts: AppAlertOptions) => {
    setOptions(opts);
    setVisible(true);
  }, []);

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  const buttons = (options?.buttons?.length ? options.buttons : [{ text: "حسناً", style: "default" }]) as AppAlertButton[];
  const icon = iconForType(options?.type);

  const onButtonPress = (btn: AppAlertButton) => {
    hide();
    setTimeout(() => btn.onPress?.(), 0);
  };

  return (
    <AppAlertContext.Provider value={value}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
        <Pressable style={styles.overlay} onPress={hide}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.headerRow}>
              <View style={[styles.iconWrap, { borderColor: icon.color }]}>
                <Ionicons name={icon.name} size={22} color={icon.color} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title} numberOfLines={2}>
                  {options?.title || ""}
                </Text>
                {!!options?.message && (
                  <Text style={styles.message}>
                    {options.message}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.buttonsRow}>
              {buttons.map((b, idx) => {
                const isDestructive = b.style === "destructive";
                const isCancel = b.style === "cancel";
                return (
                  <TouchableOpacity
                    key={`${b.text}_${idx}`}
                    onPress={() => onButtonPress(b)}
                    activeOpacity={0.85}
                    style={[
                      styles.btn,
                      isCancel && styles.btnCancel,
                      isDestructive && styles.btnDestructive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        isCancel && styles.btnTextCancel,
                        isDestructive && styles.btnTextDestructive,
                      ]}
                    >
                      {b.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AppAlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "flex-end",
    padding: 16,
  },
  sheet: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(129, 140, 248, 0.22)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderWidth: 1,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT,
  },
  message: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(129, 140, 248, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(129, 140, 248, 0.28)",
    minWidth: 90,
    alignItems: "center",
  },
  btnCancel: {
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    borderColor: "rgba(148, 163, 184, 0.18)",
  },
  btnDestructive: {
    backgroundColor: "rgba(248, 113, 113, 0.14)",
    borderColor: "rgba(248, 113, 113, 0.22)",
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT,
  },
  btnTextCancel: {
    color: "rgba(226, 232, 240, 0.95)",
  },
  btnTextDestructive: {
    color: "#fecaca",
  },
});

