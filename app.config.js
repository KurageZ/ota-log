const baseConfig = require('./app.json').expo;

const variants = {
  development: {
    name: 'ota log Dev',
    identifier: 'com.otalog.app.dev',
    scheme: 'otalog-dev',
  },
  preview: {
    name: 'ota log Preview',
    identifier: 'com.otalog.app.preview',
    scheme: 'otalog-preview',
  },
  production: {
    name: 'ota log',
    identifier: 'com.otalog.app',
    scheme: 'otalog',
  },
};

const variantName = process.env.APP_VARIANT;

if (variantName && !Object.hasOwn(variants, variantName)) {
  throw new Error(`Unknown APP_VARIANT: ${variantName}`);
}

const variant = variantName ? variants[variantName] : null;

module.exports = {
  ...baseConfig,
  name: variant?.name ?? baseConfig.name,
  scheme: variant?.scheme ?? baseConfig.scheme,
  ios: {
    ...baseConfig.ios,
    bundleIdentifier: variant?.identifier ?? baseConfig.ios.bundleIdentifier,
  },
  android: {
    ...baseConfig.android,
    package: variant?.identifier ?? baseConfig.android.package,
  },
};
