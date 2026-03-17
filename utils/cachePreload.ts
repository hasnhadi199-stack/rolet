/**
 * تحميل مسبق للكاش عند فتح التطبيق — يجلب كل البيانات المخزنة محلياً دفعة واحدة
 */
import { getCachedInbox, getCachedGroupChatMessages } from "./messagesApi";
import { getCachedWallet } from "./walletApi";
import { getCachedMoments } from "./momentsApi";

let preloadStarted = false;

/** تشغيل التحميل المسبق مرة واحدة — يُستدعى عند دخول التطبيق الرئيسي */
export function preloadAppCache(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  void Promise.all([
    getCachedInbox(),
    getCachedWallet(),
    getCachedMoments(),
    getCachedGroupChatMessages(),
  ]);
}
