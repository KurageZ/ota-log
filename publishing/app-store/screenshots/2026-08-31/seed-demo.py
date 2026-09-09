"""Seed ONLY this task's empty simulator. Never accepts a user's device path.

This is external marketing tooling, not shipped app code. UUIDs are v4.
Run after launching the app once (migrations) and terminating it.
"""
from pathlib import Path
import json
import shutil
import sqlite3
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parent
DEVICES = {
    'iphone': 'FBCFC373-EA6B-4FD7-99DD-494DB3150D8A',
    'ipad': '2EE10247-D2F9-4A62-BD89-33F147EB93F1',
}
STAMP = '2026-08-31T09:41:00+08:00'

def uid():
    return str(uuid.uuid4())

def main():
    device = sys.argv[1]
    udid = DEVICES[device]
    devices = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', '--json']))
    actual = next(d for group in devices['devices'].values() for d in group if d['udid'] == udid)
    if not actual['name'].startswith('ota-log Store '):
        raise SystemExit('Refusing a device that is not the isolated marketing simulator')
    container = Path(subprocess.check_output(['xcrun', 'simctl', 'get_app_container', udid, 'com.otalog.app', 'data'], text=True).strip())
    dbpath = container / 'Documents/SQLite/ota.db'
    if not dbpath.exists():
        raise SystemExit('Launch the app once to create its database, then terminate it')
    db = sqlite3.connect(dbpath)
    db.execute('PRAGMA foreign_keys=ON')
    if db.execute('PRAGMA user_version').fetchone()[0] not in (22, 23):
        raise SystemExit('Expected inspected app schema v22 or v23')
    for table in ('artists', 'events', 'cheki_records', 'photos', 'expenses', 'important_dates'):
        if db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]:
            raise SystemExit(f'Refusing non-empty database: {table}')
    backup = ROOT / 'qa' / f'{device}-empty.sqlite'
    with sqlite3.connect(backup) as dest:
        db.backup(dest)
    media = container / 'Documents/store-demo'
    media.mkdir(exist_ok=True)
    for name in ('haru', 'mio', 'rin', 'haru2', 'mio2', 'rin2', 'cheki-haru', 'cheki-mio', 'cheki-rin'):
        shutil.copy2(ROOT / 'assets' / f'{name}.png', media / f'{name}.png')
    def uri(name):
        return (media / f'{name}.png').as_uri()
    def put(table, **values):
        columns = ', '.join(values)
        slots = ', '.join('?' for _ in values)
        db.execute(f'INSERT INTO {table} ({columns}) VALUES ({slots})', tuple(values.values()))
    people = [uid() for _ in range(3)]
    group = uid()
    with db:
        put('artists', id=group, name='星屑通信', short_name='星屑', artist_type='group', background_color='#EEBEA8', created_at=STAMP, is_favorite=1)
        for i, (name, short, asset, color) in enumerate([('春野晴', 'HARU', 'haru', '#EAA99D'), ('水野澪', 'MIO', 'mio', '#A9B9E6'), ('橘凛', 'RIN', 'rin', '#E9C985')]):
            put('artists', id=people[i], name=name, short_name=short, artist_type='person', avatar_uri=uri(asset), background_uri=uri(asset+'2'), background_color=color, is_favorite=1, created_at=STAMP)
            put('artist_group_memberships', id=uid(), person_artist_id=people[i], group_artist_id=group, start_date='2026-01-01', created_at=STAMP, updated_at=STAMP)
        db.execute("INSERT OR REPLACE INTO user_config (id,name,avatar_emoji,oshi_artist_id,updated_at) VALUES ('default', '小夏', '🎧', ?, ?)", (people[0], STAMP))
        events = []
        plans = [
            ('2026-07-11', '夏日序曲', '上海', '月光剧场'),
            ('2026-07-18', '星屑通信 · 周末公演', '杭州', '回声空间'),
            ('2026-07-25', '微光相遇 LIVE', '上海', '月光剧场'),
            ('2026-08-01', '八月的第一封信', '上海', '月光剧场'),
            ('2026-08-02', 'SUMMER SIGNAL', '上海', '星河现场'),
            ('2026-08-08', '星屑通信 · 夏日公演', '杭州', '回声空间'),
            ('2026-08-09', '与你相见的周末', '杭州', '回声空间'),
            ('2026-08-15', '心动频率 VOL.03', '上海', '月光剧场'),
            ('2026-08-16', '橘凛 · 生日特别公演', '上海', '星河现场'),
            ('2026-08-22', '星光游园会', '南京', '白日梦剧场'),
            ('2026-08-23', '把夏天唱给你听', '上海', '月光剧场'),
            ('2026-08-29', '星屑通信 · 夏末公演', '上海', '月光剧场'),
            ('2026-08-30', '夏天的最后一封信', '上海', '星河现场'),
            ('2026-09-05', '星屑通信 · 秋日序曲', '上海', '月光剧场'),
            ('2026-09-12', '周末见面计划', '杭州', '回声空间'),
            ('2026-09-19', '晚风与你 LIVE', '上海', '星河现场'),
        ]
        for i,(date,title,city,venue) in enumerate(plans):
            eid, sid = uid(), uid()
            completed = date < '2026-08-31'
            put('events', id=eid, title=title, event_type='livehouse', status='completed' if completed else 'planned', review_score=(5 if i % 3 else 4) if completed else None, actual_expense=[100,120,150][i%3], notes='把这一晚的歌声和笑容，认真收藏。' if completed else '记得提前到场，带上应援物。', setlist_text='01. 星の便り\n02. 夏色メロディー\n03. また会おう', created_at=STAMP, updated_at=STAMP)
            put('event_sessions', id=sid, event_id=eid, session_date=date, open_time='17:30', start_time='18:00', end_time='20:30', city=city, venue=venue, sort_order=0, created_at=STAMP, updated_at=STAMP)
            put('event_artists', event_id=eid, artist_id=group, sort_order=0)
            for order,(title2,start,end) in enumerate([('入场', '17:30','18:00'),('星屑通信 LIVE','18:00','19:00'),('特典会','19:15','20:30')]):
                put('event_timetable_entries', id=uid(), session_id=sid, title=title2, artist_id=group if order else None, start_time=start, end_time=end, sort_order=order, created_at=STAMP, updated_at=STAMP)
            events.append(eid)
            if completed:
                for j in range(3 if i>=10 else 2):
                    person = j if i>=10 else (i+j)%3
                    record, item = uid(), uid()
                    at = f'{date}T20:{10+j:02d}:00+08:00'
                    put('cheki_records', id=record, event_id=eid, artist_id=people[person], date=date, quantity=1, notes=['今天也很开心！','下次现场见。','收藏一个闪闪发光的瞬间。'][j], created_at=at, updated_at=at)
                    put('cheki_items', id=item, record_id=record, sort_order=0, unit_price=60, spec='three_inch_portrait', is_favorite=int(i>=10), created_at=at, updated_at=at)
                    asset=['cheki-haru','cheki-mio','cheki-rin'][person]
                    put('cheki_item_images', id=uid(), item_id=item, side='front', photo_uri=uri(asset), created_at=at, updated_at=at)
        put('important_dates', id=uid(), title='第一次见面的日子', date='2026-07-11', source_kind='manual', show_on_calendar=1, created_at=STAMP, updated_at=STAMP)
        assert db.execute('PRAGMA foreign_key_check').fetchall() == []
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    db.close()
    prefs_path = container/'Library/Application Support/com.otalog.app/RCTAsyncLocalStorage_V1/manifest.json'
    prefs_path.parent.mkdir(parents=True,exist_ok=True)
    prefs = json.loads(prefs_path.read_text()) if prefs_path.exists() else {}
    prefs['ota-log.onboarding-guide-seen.v2'] = 'true'
    prefs['ota-log.theme-preferences.v1'] = json.dumps({'themeId':'monoChrome','appearance':'light','calendarWeekStart':'monday','calendarDisplay':{'showChekiPhotos':True,'showEvents':True,'showDateItems':True},'chekiDisplayMode':'portrait'})
    prefs['ota-log.cheki-view-preferences.v2'] = json.dumps({'browseMode':'album','defaultBrowseMode':'album','albumGrouping':'none','albumSortOrder':'desc','recordSortOrder':'desc','density':'large','landscapeRotation':'original','showRecordThumbnails':True,'albumModeHintDismissed':True})
    prefs_path.write_text(json.dumps(prefs,ensure_ascii=False))
    result={'device':device,'udid':udid,'bundleId':'com.otalog.app','oshi':people[0],'event':events[13],'lastEvent':events[12],'captureDate':'2026-08-31','fictional':True}
    (ROOT/'qa'/f'{device}-seed.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
    print(json.dumps(result))

if __name__ == '__main__':
    main()
