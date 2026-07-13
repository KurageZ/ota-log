const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native-cookies',
  'cookies',
  'android',
  'build.gradle',
);

if (!fs.existsSync(buildGradlePath)) {
  console.warn('[patch-react-native-cookies] build.gradle missing, skipping');
  process.exit(0);
}

const source = fs.readFileSync(buildGradlePath, 'utf8');
const patched = source.replace(/jcenter\(\)/g, 'mavenCentral()');

if (patched !== source) {
  fs.writeFileSync(buildGradlePath, patched);
  console.log('[patch-react-native-cookies] patched android/build.gradle');
}
