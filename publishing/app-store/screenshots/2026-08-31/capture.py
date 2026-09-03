"""Recapture the six routes on the prepared, isolated store simulator.

App must be running on Metro, developer FAB hidden, and dialogs dismissed.
Inspect every output before submission; fixed waits are not a readiness proof.
"""
from pathlib import Path
import json
import subprocess
import sys
import time

root = Path(__file__).resolve().parent
device = sys.argv[1]
seed = json.loads((root / 'qa' / f'{device}-seed.json').read_text())
udid = seed['udid']
devices = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', '--json']))
actual = next(d for group in devices['devices'].values() for d in group if d['udid'] == udid)
assert actual['name'].startswith('ota-log Store '), 'Only dedicated store simulators allowed'
routes = [('01-home', ''), ('02-cheki', 'cheki'), ('03-event', 'events/' + seed['event']), ('04-artist', 'artists/' + seed['oshi']), ('05-calendar', 'calendar'), ('06-stats', 'stats?preset=year')]
for name, route in routes:
    subprocess.run(['xcrun','simctl','openurl',udid,'otalog://'+route],check=True)
    time.sleep(3)
    output = root / 'raw' / device / (name + '.png')
    subprocess.run(['xcrun','simctl','io',udid,'screenshot',str(output)],check=True)
    print(output, flush=True)
