import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { AppIcon } from '../src/components/AppIcon';
import { loadWeiboCookie, saveWeiboCookie } from '../src/utils/weibo/cookieStore';
import { clearWeiboCookies, mirrorWebViewToFetch } from '../src/utils/weibo/cookieBridge';
import { useAppTheme } from '../src/theme/appTheme';

export default function WeiboScreen() {
  const { colors } = useAppTheme();
  const [cookie, setCookie] = useState('');
  const [webViewUrl, setWebViewUrl] = useState('');
  const [webViewNav, setWebViewNav] = useState('');
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
    try {
      const freshCookie = await mirrorWebViewToFetch();
      if (!freshCookie) {
        Alert.alert('未检测到登录状态', '请先在微博页面完成登录，再点右上角完成。');
        return;
      }

      setCookie(freshCookie);
      await saveWeiboCookie(freshCookie);
      setWebViewUrl('');
      setWebViewNav('');
      Alert.alert('登录信息已保存', '后续解析微博内容时会自动使用当前登录状态；如果失效，回到这里重新登录即可。');
    } catch {
      Alert.alert('保存失败', '未能读取微博登录信息，请重试。');
    }
  }, []);

  const handleLoginCancel = useCallback(() => {
    setWebViewUrl('');
    setWebViewNav('');
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
            这里仅保存你的微博登录信息，Cookie 只会保存在本机，用于后续需要微博登录态的功能。
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
                  {hasCookie ? '已保存微博登录状态' : '尚未保存微博登录状态'}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                  {hasCookie
                    ? '后续解析微博公告和艺人资料时会自动使用当前登录信息。'
                    : '先完成一次微博登录，后续抓取功能才能直接读取受限内容。'}
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
                如果后续解析失败，通常是登录态过期，重新登录一次即可刷新。
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            activeOpacity={0.72}
            style={{
              marginTop: 16,
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
            <TouchableOpacity onPress={handleLoginDone} activeOpacity={0.6}>
              <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>完成</Text>
            </TouchableOpacity>
          </View>

          {webViewUrl ? (
            <WebView
              source={{ uri: webViewUrl }}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              cacheEnabled={false}
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
