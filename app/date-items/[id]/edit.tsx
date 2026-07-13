import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { DateItemForm, DateItemFormHandle } from '../../../src/components/DateItemForm';
import { useDB } from '../../../src/context/DBContext';
import { HydratedDateItem } from '../../../src/repositories/DateItemRepository';
import { useAppTheme } from '../../../src/theme/appTheme';

export default function EditDateItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDB();
  const { colors } = useAppTheme();
  const formRef = useRef<DateItemFormHandle>(null);
  const [item, setItem] = useState<HydratedDateItem | null>(null);
  const [missing, setMissing] = useState(false);
  const [canSave, setCanSave] = useState(false);

  useEffect(() => {
    if (!id) return;
    db.dateItems.findById(id).then((result) => {
      if (result) {
        setItem(result);
      } else {
        setMissing(true);
      }
    }).catch(() => setMissing(true));
  }, [db, id]);

  if (missing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screen }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>找不到这个重要日期</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screen }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '编辑重要日期',
          headerTitleAlign: 'center',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>取消</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
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
      <DateItemForm
        ref={formRef}
        initial={item}
        hideSubmitButton
        onCanSaveChange={setCanSave}
        onSaved={() => {
          router.back();
        }}
      />
    </>
  );
}
