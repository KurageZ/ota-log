import { addEventToSystemCalendar } from '../systemCalendar';

describe('addEventToSystemCalendar', () => {
  test('requests calendar permission before creating an event', async () => {
    const requestCalendarPermissionsAsync = jest.fn().mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    const createEventInCalendarAsync = jest.fn().mockResolvedValue({ action: 'done' });
    const payload = { title: '演出', startDate: new Date(), endDate: new Date() };

    await addEventToSystemCalendar(payload, {
      requestCalendarPermissionsAsync,
      createEventInCalendarAsync,
    });

    expect(requestCalendarPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(createEventInCalendarAsync).toHaveBeenCalledWith(payload);
    expect(requestCalendarPermissionsAsync.mock.invocationCallOrder[0])
      .toBeLessThan(createEventInCalendarAsync.mock.invocationCallOrder[0]);
  });

  test('does not create an event when permission is denied', async () => {
    const requestCalendarPermissionsAsync = jest.fn().mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });
    const createEventInCalendarAsync = jest.fn();

    await expect(addEventToSystemCalendar(
      { title: '演出' },
      { requestCalendarPermissionsAsync, createEventInCalendarAsync },
    )).rejects.toThrow('未获得系统日历权限');

    expect(createEventInCalendarAsync).not.toHaveBeenCalled();
  });
});
