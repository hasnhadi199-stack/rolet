import { StyleSheet, Text, View, Image, TouchableOpacity, ScrollView } from "react-native";
import { useEffect, useState } from "react";
import { fetchInbox, type InboxItem } from "../../utils/messagesApi";
import type { UserSearchResult } from "../../utils/usersApi";

const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";

type Props = {
  onOpenChat: (user: UserSearchResult) => void;
};

export default function MessagesScreen({ onOpenChat }: Props) {
  const [items, setItems] = useState<InboxItem[]>([]);

  useEffect(() => {
    fetchInbox().then(setItems);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>رسائل</Text>
      {items.length === 0 ? (
        <Text style={styles.subtitle}>المحادثات تظهر هنا</Text>
      ) : (
        <ScrollView>
          {items.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.row}
              activeOpacity={0.8}
              onPress={() =>
                onOpenChat({
                  id: m.otherId,
                  name: m.otherName,
                  profileImage: m.otherProfileImage,
                  age: null,
                  country: "",
                  gender: "",
                })
              }
            >
              {m.otherProfileImage ? (
                <Image source={{ uri: m.otherProfileImage }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]} />
              )}
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {m.otherName}
                </Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {m.direction === "out" ? "أنا: " : ""}{m.text}
                </Text>
              </View>
              <Text style={styles.time}>
                {new Date(m.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15,23,42,0.9)",
  },
  avatarPlaceholder: {
    backgroundColor: "rgba(15,23,42,0.9)",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
  preview: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  time: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
});
