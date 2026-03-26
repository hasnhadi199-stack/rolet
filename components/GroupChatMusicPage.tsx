import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
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
  onBack: () => void;
  onSelect: (uri: string, filename?: string) => void;
};

let cachedSongs: SongItem[] = [];

function getFilename(asset: MediaLibrary.Asset): string {
  return asset.filename || asset.uri.split("/").pop() || "أغنية";
}

function isMp3(filename: string): boolean {
  return filename.toLowerCase().endsWith(".mp3");
}

export default function GroupChatMusicPage({ onBack, onSelect }: Props) {
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
        first: 1000,
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
      setError("فشل تحميل الأغاني من الجهاز");
      if (cachedSongs.length === 0) setSongs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cachedSongs.length > 0) {
      setSongs(cachedSongs);
      setLoading(false);
      loadSongs(true);
    } else {
      loadSongs(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = async (item: SongItem) => {
    try {
      const info = await FileSystem.getInfoAsync(item.uri, { size: true });
      const size = (info as { size?: number })?.size ?? 0;
      if (size > MAX_SIZE_BYTES) {
        Alert.alert("حجم كبير", `الحد الأقصى 128 ميجابايت. حجم الملف: ${(size / 1024 / 1024).toFixed(1)} ميجابايت`);
        return;
      }
      onSelect(item.uri, item.filename);
    } catch {
      onSelect(item.uri, item.filename);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.5}>
          <Ionicons name="chevron-back" size={22} color={TEXT_LIGHT} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>أغاني MP3 - 128 ميجابايت</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => loadSongs(false)}>
          <Ionicons name="refresh" size={20} color={ACCENT} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>جاري تحميل الأغاني...</Text>
        </View>
      ) : error && songs.length === 0 ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadSongs(false)}>
            <Ionicons name="refresh" size={20} color={BG} />
            <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.songRow}
              onPress={() => handleSelect(item)}
              activeOpacity={0.6}
              delayPressIn={0}
            >
              <Ionicons name="musical-notes" size={24} color={ACCENT} />
              <Text style={styles.songName} numberOfLines={1}>{item.filename}</Text>
              <Ionicons name="chevron-forward" size={20} color={TEXT_MUTED} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>لا توجد أغاني MP3 في الجهاز</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: Platform.OS === "ios" ? 12 : 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    fontSize: 15,
    color: TEXT_LIGHT,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
  refreshBtn: {
    padding: 4,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  errorWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 20,
  },
  errorText: {
    fontSize: 15,
    color: TEXT_MUTED,
    textAlign: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: "rgba(167,139,250,0.12)",
    borderRadius: 12,
    marginBottom: 10,
    gap: 14,
  },
  songName: {
    flex: 1,
    fontSize: 15,
    color: TEXT_LIGHT,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: BG,
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: TEXT_MUTED,
  },
});
