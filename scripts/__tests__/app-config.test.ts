import { execFileSync } from 'node:child_process';
import path from 'node:path';

describe('EAS widget signing configuration', () => {
  test.each([
    ['development', 'com.otalog.app.dev'],
    ['preview', 'com.otalog.app.preview'],
    ['production', 'com.otalog.app'],
    ['', 'com.otalog.app'],
  ])('%s keeps extension credentials aligned with the app', (variant, identifier) => {
    const output = execFileSync(process.execPath, ['-e', `
      const source = require('./app.json').expo;
      const before = JSON.stringify(source);
      const config = require('./app.config.js')({ config: source });
      require('node:assert/strict').equal(JSON.stringify(source), before);
      console.log(JSON.stringify(config));
    `], {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, APP_VARIANT: variant },
      encoding: 'utf8',
    });
    const config = JSON.parse(output);
    expect(config.ios.bundleIdentifier).toBe(identifier);
    expect(config.extra.eas.build.experimental.ios.appExtensions).toEqual([{
      targetName: 'ExpoWidgetsTarget',
      bundleIdentifier: `${identifier}.ExpoWidgetsTarget`,
      entitlements: {
        'com.apple.security.application-groups': [`group.${identifier}`],
      },
    }]);
  });
});
