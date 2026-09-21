import React from 'react';
import { Alert, InteractionManager, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import Clipboard from '@react-native-clipboard/clipboard';
import { fetchAnnouncementText } from '../../utils/announcementWebText';
import { parseAnnouncement } from '../../utils/parseAnnouncement';
import { buildParsedEventDraft } from '../../utils/parsedEventDraft';
import EventCompose from '../../../app/events/compose';
import { BottomSheetAction, BottomSheetDialog } from '../BottomSheetDialog';
import { fetchImportedEvent } from '../../utils/ievent/importEvent';
import { setEventDraft } from '../../utils/eventDraftStore';

const mockDb = {
  artists: { findAll: jest.fn().mockResolvedValue([]), create: jest.fn() },
  userConfig: { getConfig: jest.fn().mockResolvedValue({ artist_confirmation_mode: 'all' }) },
};
jest.mock('../../context/DBContext', () => ({ useDB: () => mockDb }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn() } }));
jest.mock('@react-native-clipboard/clipboard', () => ({ __esModule: true, default: { getString: jest.fn() } }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: require('react-native').View }));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: require('react-native').View,
  BottomSheetTextInput: require('react-native').TextInput,
}));
jest.mock('../BottomSheetDialog', () => ({
  ...jest.requireActual('../BottomSheetDialog'),
  BottomSheetDialog: (props: { children: React.ReactNode; footer: React.ReactNode; headerAccessory?: React.ReactNode }) => (
    require('react').createElement('Sheet', props, props.children, props.footer, props.headerAccessory)
  ),
}));
jest.mock('../../theme/appTheme', () => ({ useAppTheme: () => ({ colors: new Proxy({}, { get: () => '#333333' }), isDark: false }) }));
jest.mock('../AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../../utils/weibo/cookieStore', () => ({ loadWeiboCookie: jest.fn().mockResolvedValue('') }));
jest.mock('../../utils/weibo/fetchPost', () => ({ fetchWeiboPost: jest.fn(), WEIBO_URL_RE: /weibo/ }));
jest.mock('../../utils/weibo/downloadFile', () => ({ downloadWeiboFile: jest.fn() }));
jest.mock('../../utils/ievent/importEvent', () => ({ fetchImportedEvent: jest.fn(), IEVENT_URL_RE: /ievent/ }));
jest.mock('../../utils/eventDraftStore', () => ({ setEventDraft: jest.fn() }));
jest.mock('../../utils/announcementWebText', () => ({
  ...jest.requireActual('../../utils/announcementWebText'),
  fetchAnnouncementText: jest.fn(),
}));
jest.mock('../../utils/parseAnnouncement', () => ({ parseAnnouncement: jest.fn(() => ({ title: '测试活动', artist_mentions: ['测试艺人'] })) }));
jest.mock('../../utils/parsedEventDraft', () => ({
  buildParsedEventDraft: jest.fn(() => ({
    fields: { title: '测试活动' }, matchedIds: [],
    candidates: [{ rawName: '测试艺人', editName: '测试艺人', resolution: 'create', suggestions: [] }],
  })),
}));
jest.mock('../../utils/importedEventDraft', () => ({ prepareImportedEventDraft: jest.fn(), applyImportedTimetableArtistResolutions: jest.fn() }));
jest.mock('../../utils/artistConfirmation', () => ({
  DEFAULT_ARTIST_CONFIRMATION_MODE: 'all',
  getArtistCandidatesForConfirmation: (candidates: unknown[]) => candidates,
  selectAllArtistCandidates: (candidates: unknown[]) => candidates,
}));

describe('announcement sheet flow', () => {
  let renderer: ReactTestRenderer;
  const sheet = (title: string) => renderer.root.findAllByType(BottomSheetDialog).find((node) => node.props.title === title)!;
  const action = (label: string) => renderer.root.findAllByType(BottomSheetAction).find((node) => node.props.label === label)!;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((callback: any) => {
      callback();
      return { then: jest.fn(), done: jest.fn(), cancel: jest.fn() };
    });
    await act(async () => { renderer = create(<EventCompose />); });
  });
  afterEach(() => {
    act(() => renderer.unmount());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('returning from performer confirmation keeps the announcement and has fixed actions', async () => {
    const input = () => renderer.root.findAllByType(TextInput).find((node) => node.props.placeholder === '粘贴演出公告文本，自动识别演出信息。')!;
    act(() => input().props.onChangeText('我的公告草稿'));
    await act(async () => action('解析并创建草稿').props.onPress());
    act(() => jest.advanceTimersByTime(300));
    expect(sheet('确认出演者').props.visible).toBe(true);
    expect(sheet('确认出演者').props.footer).toBeTruthy();
    act(() => action('返回解析').props.onPress());
    expect(sheet('解析公告').props.visible).toBe(true);
    expect(input().props.value).toBe('我的公告草稿');
    expect(mockDb.artists.create).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  test('pasted ordinary links fetch text and feed the shared parser', async () => {
    jest.mocked(Clipboard.getString).mockResolvedValue('https://example.com/event');
    jest.mocked(fetchAnnouncementText).mockResolvedValue('公开网页正文');
    await act(async () => action('粘贴并识别').props.onPress());
    expect(fetchAnnouncementText).toHaveBeenCalledWith('https://example.com/event');
    expect(parseAnnouncement).toHaveBeenCalledWith('公开网页正文');
    expect(buildParsedEventDraft).toHaveBeenCalledWith('公开网页正文', expect.anything(), [], { url: 'https://example.com/event' });
  });

  test('pasted text uses the same parser without fetching', async () => {
    jest.mocked(Clipboard.getString).mockResolvedValue('活动公告正文');
    await act(async () => action('粘贴并识别').props.onPress());
    expect(parseAnnouncement).toHaveBeenCalledWith('活动公告正文');
    expect(fetchAnnouncementText).not.toHaveBeenCalled();
  });

  test('explicit text takes priority over a filled link and retains the source URL', async () => {
    const inputs = renderer.root.findAllByType(TextInput);
    act(() => {
      inputs.find((node) => node.props.placeholder === 'https://...')!.props.onChangeText('https://example.com/event');
      inputs.find((node) => node.props.multiline)!.props.onChangeText('手动粘贴正文');
    });
    await act(async () => action('解析并创建草稿').props.onPress());
    expect(fetchAnnouncementText).not.toHaveBeenCalled();
    expect(parseAnnouncement).toHaveBeenCalledWith('手动粘贴正文');
    expect(buildParsedEventDraft).toHaveBeenCalledWith('手动粘贴正文', expect.anything(), [], { url: 'https://example.com/event' });
  });

  test('failed ordinary links retain input and allow a retry', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const input = () => renderer.root.findAllByType(TextInput).find((node) => node.props.placeholder === 'https://...')!;
    act(() => input().props.onChangeText('https://example.com/event'));
    jest.mocked(fetchAnnouncementText).mockRejectedValueOnce(new Error('HTTP 403')).mockResolvedValueOnce('重试正文');
    await act(async () => action('解析并创建草稿').props.onPress());
    expect(alert).toHaveBeenCalled();
    expect(input().props.value).toBe('https://example.com/event');
    expect(action('解析并创建草稿').props.loading).toBe(false);
    expect(parseAnnouncement).not.toHaveBeenCalled();
    await act(async () => action('解析并创建草稿').props.onPress());
    expect(parseAnnouncement).toHaveBeenCalledWith('重试正文');
  });

  test('closing during an ordinary fetch ignores its result', async () => {
    let finish!: (text: string) => void;
    jest.mocked(fetchAnnouncementText).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const input = renderer.root.findAllByType(TextInput).find((node) => node.props.placeholder === 'https://...')!;
    act(() => input.props.onChangeText('https://example.com/event'));
    act(() => action('解析并创建草稿').props.onPress());
    act(() => sheet('解析公告').props.onClose());
    await act(async () => { finish('延迟正文'); });
    expect(parseAnnouncement).not.toHaveBeenCalled();
    expect(setEventDraft).not.toHaveBeenCalled();
  });

  test('closing during a request ignores the late result and never navigates to creation', async () => {
    let resolveRequest!: (value: Awaited<ReturnType<typeof fetchImportedEvent>>) => void;
    jest.mocked(fetchImportedEvent).mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }) as ReturnType<typeof fetchImportedEvent>);
    const input = renderer.root.findAllByType(TextInput).find((node) => node.props.placeholder === 'https://...')!;
    act(() => input.props.onChangeText('https://ievent.test/event'));
    act(() => action('解析并创建草稿').props.onPress());
    expect(action('解析并创建草稿').props.loading).toBe(true);
    act(() => sheet('解析公告').props.onClose());
    await act(async () => { resolveRequest({ ok: true, event: {} } as Awaited<ReturnType<typeof fetchImportedEvent>>); });
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
    expect(setEventDraft).not.toHaveBeenCalled();
    expect(sheet('确认出演者').props.visible).toBe(false);
  });
});
