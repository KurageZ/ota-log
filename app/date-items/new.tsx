import { useRef, useState } from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { DateItemForm, DateItemFormHandle } from '../../src/components/DateItemForm';
import { NativeTextToolbar } from '../../src/components/native-text-toolbar';
import { useAppTheme } from '../../src/theme/appTheme';

export default function NewDateItemScreen() {
  const { colors } = useAppTheme();
  const formRef = useRef<DateItemFormHandle>(null);
  const [canSave, setCanSave] = useState(false);

  return (
    <>
      <Stack.Screen
        options={{
          title: '新建重要日期',
          headerTitleAlign: 'center',
          headerLeft: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>取消</Text>
            </TouchableOpacity>
          ),
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity
              onPress={() => formRef.current?.submit()}
              disabled={!canSave}
              style={{ paddingRight: 4, opacity: canSave ? 1 : 0.4 }}
            >
              <Text style={{ color: canSave ? colors.accent : colors.textMuted, fontSize: 16, fontWeight: '700' }}>保存</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <NativeTextToolbar
        left={{ label: '取消', onPress: () => router.back() }}
        right={{
          label: '保存',
          onPress: () => formRef.current?.submit(),
          disabled: !canSave,
          variant: 'done',
        }}
      />
      <DateItemForm
        ref={formRef}
        hideSubmitButton
        onCanSaveChange={setCanSave}
        onSaved={(id) => {
          router.replace(`/date-items/${id}`);
        }}
      />
    </>
  );
}
