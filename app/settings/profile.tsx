import { useCallback, useState } from 'react';
import { Alert, Image, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from '../../src/components/AppIcon';
import { NativeTextToolbar } from '../../src/components/native-text-toolbar';
import { useDB } from '../../src/context/DBContext';
import { copyToDocuments } from '../../src/utils/copyToDocuments';
import { showOperationFailedAlert, showSaveFailedAlert } from '../../src/utils/failureAlert';
import { useAppTheme } from '../../src/theme/appTheme';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

export default function ProfileSettingsScreen() {
  const { colors } = useAppTheme();
  const db = useDB();

  const [name, setName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      db.userConfig.getConfig().then((config) => {
        setName(config.name);
        setAvatarUri(config.avatar_uri);
      });
    }, [db]),
  );

  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets[0]) {
        const permanentUri = await copyToDocuments(result.assets[0].uri);
        setAvatarUri(permanentUri);
      }
    } catch (error) {
      showOperationFailedAlert(
        '头像选择失败。',
        '请稍后再试一次；如果问题持续出现，再检查相册是否可用。',
        error,
      );
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) {
      Alert.alert('验证失败', '名称不能为空');
      return;
    }

    try {
      setSaving(true);
      await db.userConfig.updateConfig({
        name: name.trim(),
        avatar_uri: avatarUri,
      });
      router.back();
    } catch (error) {
      showSaveFailedAlert(error);
    } finally {
      setSaving(false);
    }
  };

  const inputBg = colors.input;
  const borderColor = colors.inputBorder;
  const textColor = colors.text;
  const helperColor = colors.textSecondary;
  const previewSize = 92;

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen
        options={{
          title: '个人资料',
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ paddingRight: 4, opacity: saving ? 0.5 : 1 }}>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>保存</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <NativeTextToolbar
        right={{
          label: saving ? '保存中' : '保存',
          onPress: handleSave,
          disabled: saving,
          variant: 'done',
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 20,
            padding: 20,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', color: textColor, marginBottom: 16 }}>头像预览</Text>

          <View
            style={{
              alignItems: 'center',
              paddingVertical: 12,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: previewSize,
                height: previewSize,
                borderRadius: previewSize / 2,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: previewSize, height: previewSize, borderRadius: previewSize / 2 }} />
              ) : (
                <AppIcon name="profile" size={42} color={colors.onAccent} />
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={handlePickAvatar}
              activeOpacity={0.7}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 11,
                borderRadius: 12,
                backgroundColor: colors.accent,
              }}
            >
              <AppIcon name="image" size={16} color={colors.onAccent} />
              <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 14 }}>选择照片</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setAvatarUri(null)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 14,
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: colors.inputBorder,
              }}
            >
              <Text style={{ color: textColor, fontWeight: '700', fontSize: 14 }}>清除</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: helperColor, marginBottom: 6 }}>名称</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="输入你的名称"
              placeholderTextColor={colors.placeholder}
              style={{
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 11,
                backgroundColor: inputBg,
                color: textColor,
                fontSize: 15,
                borderWidth: 1,
                borderColor,
              }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
