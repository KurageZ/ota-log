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

module.exports = ({ config }) => {
  return {
    ...config,
    name: variant?.name ?? config.name,
    scheme: variant?.scheme ?? config.scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: variant?.identifier ?? config.ios.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: variant?.identifier ?? config.android.package,
    },
  };
};
