import React, { useState, useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";

const BG = "#1a1625";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const ACCENT = "#a78bfa";
const MAX_SIZE_MB = 128;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

type SongItem = { id: string; uri: string; filename: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (uri: string, filename?: string) => void;
};

let cachedSongs: SongItem[] = [];

function getFilename(asset: MediaLibrary.Asset): string {
  return asset.filename || asset.uri.split("/").pop() || "أغنية";
}

function isMp3(filename: string): boolean {
  return filename.toLowerCase().endsWith(".mp3");
}

export default function MusicPickerModal({ visible, onClose, onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState<SongItem[]>(() => cachedSongs);
  const [error, setError] = useState<string | null>(null);

  const loadSongs = useCallback(async (silent = false) => {
    setError(null);
    if (cachedSongs.length > 0) {
      setSongs(cachedSongs);
      if (silent) setLoading(false);
    }
    if (!silent) setLoading(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ["audio"]);
      if (status !== "granted") {
        setError("يُرجى منح إذن الوصول للموسيقى");
        setLoading(false);
        return;
      }

      const mediaType = (MediaLibrary.MediaType as { audio?: string })?.audio ?? "audio";
      const { assets, totalCount } = await MediaLibrary.getAssetsAsync({
        mediaType: mediaType as MediaLibrary.MediaType,
        first: 500,
      });

      const mp3Only: SongItem[] = [];
      for (const asset of assets) {
        const filename = getFilename(asset);
        if (!isMp3(filename)) continue;
        mp3Only.push({ id: asset.id, uri: asset.uri, filename });
      }

      cachedSongs = mp3Only;
      setSongs(mp3Only);
      if (mp3Only.length === 0 && totalCount > 0) {
        setError("لم تُعثر على أغاني MP3");
      } else if (mp3Only.length === 0) {
        setError("لا توجد أغاني MP3 في الجهاز");
      }
    } catch (err) {
      setError("فشل تحميل الأغاني. جرّب اختيار من الملفات.");
      if (cachedSongs.length === 0) setSongs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      if (cachedSongs.length > 0) {
        setSongs(cachedSongs);
        setLoading(false);
        loadSongs(true);
      } else {
        loadSongs(false);
      }
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickFromFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const DocumentPicker = await import("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/mpeg",
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        setLoading(false);
        return;
      }
      const file = result.assets[0];
      const filename = file.name || "song.mp3";
      if (!isMp3(filename)) {
        Alert.alert("غير مدعوم", "يُرجى اختيار ملف MP3 فقط");
        setLoading(false);
        return;
      }
      const info = await FileSystem.getInfoAsync(file.uri, { size: true });
      const size = (info as { size?: number })?.size ?? 0;
      if (size > MAX_SIZE_BYTES) {
        Alert.alert("حجم كبير", `الحد الأقصى 128 ميجابايت. حجم الملف: ${(size / 1024 / 1024).toFixed(1)} ميجابايت`);
        setLoading(false);
        return;
      }
      onSelect(file.uri, filename);
      onClose();
    } catch (err) {
      console.warn("MusicPickerModal pickFromFiles error:", err);
      Alert.alert("خطأ", "فشل اختيار الملف");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (item: SongItem) => {
    try {
      const info = await FileSystem.getInfoAsync(item.uri, { size: true });
      const size = (info as { size?: number })?.size ?? 0;
      if (size > MAX_SIZE_BYTES) {
        Alert.alert("حجم كبير", `الحد الأقصى 128 ميجابايت. حجم الملف: ${(size / 1024 / 1024).toFixed(1)} ميجابايت`);
        return;
      }
      onSelect(item.uri, item.filename);
      onClose();
    } catch {
      onSelect(item.uri, item.filename);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.content} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>اختر أغنية MP3 (حد أقصى 128 ميجابايت)</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={pickFromFiles}>
            <Ionicons name="folder-open" size={22} color={BG} />
            <Text style={styles.primaryBtnText}>تصفح الملفات</Text>
          </TouchableOpacity>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={styles.loadingText}>جاري تحميل الأغاني...</Text>
            </View>
          ) : error && songs.length === 0 ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.fallbackBtn} onPress={pickFromFiles}>
                <Ionicons name="folder-open" size={20} color={BG} />
                <Text style={styles.fallbackBtnText}>اختيار من الملفات</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>أو من المكتبة</Text>
              <FlatList
                data={songs}
                keyExtractor={(item) => item.id}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.songRow}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.5}
                  >
                    <Ionicons name="musical-notes" size={22} color={ACCENT} />
                    <Text style={styles.songName} numberOfLines={1}>{item.filename}</Text>
                    <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <TouchableOpacity style={styles.fallbackBtn} onPress={pickFromFiles}>
                    <Ionicons name="folder-open" size={20} color={BG} />
                    <Text style={styles.fallbackBtnText}>تصفح الملفات</Text>
                  </TouchableOpacity>
                }
              />
            </>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    backgroundColor: BG,
    borderRadius: 16,
    padding: 24,
    width: "90%",
    maxWidth: 360,
    maxHeight: "70%",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_LIGHT,
    marginBottom: 16,
    textAlign: "center",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: BG,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  errorWrap: {
    paddingVertical: 16,
    alignItems: "center",
    gap: 16,
  },
  errorText: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: "center",
  },
  list: {
    maxHeight: 280,
  },
  listContent: {
    paddingBottom: 12,
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(167,139,250,0.1)",
    borderRadius: 10,
    marginBottom: 8,
    gap: 12,
  },
  songName: {
    flex: 1,
    fontSize: 14,
    color: TEXT_LIGHT,
  },
  fallbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  fallbackBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: BG,
  },
  sectionLabel: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginBottom: 8,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
});
