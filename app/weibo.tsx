import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { AppIcon } from '../src/components/AppIcon';
import {
  clearWeiboCookieFile,
  loadWeiboCookie,
  saveWeiboCookie,
} from '../src/utils/weibo/cookieStore';
import { clearWeiboCookies, mirrorWebViewToFetch } from '../src/utils/weibo/cookieBridge';
import { useAppTheme } from '../src/theme/appTheme';

export default function WeiboScreen() {
  const { colors } = useAppTheme();
  const [cookie, setCookie] = useState('');
  const [webViewUrl, setWebViewUrl] = useState('');
  const [webViewNav, setWebViewNav] = useState('');
  const [saving, setSaving] = useState(false);
  const hasCookie = cookie.trim().length > 0;

  useEffect(() => {
    loadWeiboCookie().then((storedCookie) => {
      if (storedCookie) {
        setCookie(storedCookie);
      }
    });
  }, []);

  const handleLogin = useCallback(async () => {
    try {
      await clearWeiboCookies();
    } catch {
      // best-effort cleanup; keep going so login is not blocked
    }

    setWebViewUrl('https://m.weibo.cn');
    setWebViewNav('');
  }, []);

  const handleLoginDone = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const freshCookie = await mirrorWebViewToFetch();
      if (!freshCookie) {
        Alert.alert('未检测到登录状态', '请完成登录后再试。');
        return;
      }

      setCookie(freshCookie);
      await saveWeiboCookie(freshCookie);
      setWebViewUrl('');
      setWebViewNav('');
      Alert.alert('登录状态已保存', '解析微博内容时会自动使用。失效时重新登录即可。');
    } catch {
      Alert.alert('保存失败', '未能读取登录信息，请重试。');
    } finally {
      setSaving(false);
    }
  }, [saving]);

  const handleLoginCancel = useCallback(() => {
    setWebViewUrl('');
    setWebViewNav('');
  }, []);

  const handleClearCookie = useCallback(() => {
    Alert.alert('清除登录状态？', '清除后需重新登录才能解析微博内容。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearWeiboCookies();
            await clearWeiboCookieFile();
            setCookie('');
            Alert.alert('已清除登录状态');
          } catch {
            Alert.alert('清除失败', '请重试。');
          }
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.screen }} edges={['bottom']}>
      <Stack.Screen options={{ title: '微博登录', headerTitleAlign: 'center' }} />
      <View style={{ flex: 1, padding: 16 }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 16,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
            微博登录
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
            登录微博后，可解析公告、艺人资料和关注列表。Cookie 仅保存在本机。
          </Text>

          <View
            style={{
              marginTop: 16,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: hasCookie ? colors.success : colors.inputBorder,
              backgroundColor: hasCookie ? colors.successSoft : colors.cardAlt,
              padding: 14,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: hasCookie ? colors.success : colors.input,
                  marginRight: 10,
                }}
              >
                <AppIcon
                  name={hasCookie ? 'statusCompleted' : 'info'}
                  size={16}
                  color={hasCookie ? colors.white : colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: hasCookie ? colors.success : colors.text,
                  }}
                >
                  {hasCookie ? '已保存登录状态' : '未保存登录状态'}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                  {hasCookie
                    ? '解析微博内容时会自动使用。'
                    : '完成登录后即可开始使用。'}
                </Text>
              </View>
            </View>
            {hasCookie ? (
              <Text
                style={{
                  marginTop: 10,
                  fontSize: 11.5,
                  lineHeight: 17,
                  color: colors.textSecondary,
                }}
              >
                解析失败时，重新登录即可。
              </Text>
            ) : null}
          </View>

          <View style={{ marginTop: 14, gap: 4 }}>
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textSecondary }}>
              1. 轻点「去登录微博」
            </Text>
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textSecondary }}>
              2. 在打开的页面完成登录
            </Text>
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textSecondary }}>
              3. 轻点右上角「完成」保存
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            activeOpacity={0.72}
            style={{
              marginTop: 12,
              minHeight: 48,
              borderRadius: 14,
              backgroundColor: colors.accent,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <AppIcon name={hasCookie ? 'refresh' : 'login'} size={18} color={colors.onAccent} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.onAccent }}>
              {hasCookie ? '重新登录微博' : '去登录微博'}
            </Text>
          </TouchableOpacity>

          {hasCookie ? (
            <TouchableOpacity
              onPress={handleClearCookie}
              activeOpacity={0.6}
              style={{
                marginTop: 8,
                minHeight: 36,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <AppIcon name="trash" size={15} color={colors.danger} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.danger }}>
                清除登录状态
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Modal
        visible={!!webViewUrl}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleLoginCancel}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.screen }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.inputBorder,
              backgroundColor: colors.card,
            }}
          >
            <TouchableOpacity onPress={handleLoginCancel} activeOpacity={0.6}>
              <Text style={{ color: colors.textSecondary, fontSize: 15 }}>取消</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>微博登录</Text>
              <Text
                numberOfLines={1}
                style={{ color: colors.textMuted, fontSize: 11, marginTop: 2, maxWidth: 220 }}
              >
                {webViewNav || webViewUrl}
              </Text>
            </View>
            <TouchableOpacity onPress={handleLoginDone} activeOpacity={0.6} disabled={saving}>
              <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>
                {saving ? '读取中…' : '完成'}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              backgroundColor: colors.cardAlt,
              borderBottomWidth: 1,
              borderBottomColor: colors.inputBorder,
            }}
          >
            <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
              1. 在页面中完成登录
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
              2. 轻点右上角「完成」保存
            </Text>
          </View>

          {webViewUrl ? (
            <WebView
              source={{ uri: webViewUrl }}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              // iOS: 保留默认持久化 WKWebsiteDataStore，CookieManager.get(url, true)
              // 才能读到 WebView 登录后写入的 Cookie（cacheEnabled={false} 会让
              // react-native-webview 切换到非持久 store，导致 iOS 读不到 Cookie）。
              // Android 继续沿用原来的关闭缓存行为。
              cacheEnabled={Platform.OS === 'android' ? false : undefined}
              onNavigationStateChange={(nav: WebViewNavigation) => setWebViewNav(nav.url)}
              userAgent={
                'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
              }
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
