import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SOURCE_FORMAT = 'ota-log-bundled-artist-source';
const SOURCE_VERSION = 1;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseArguments(argv) {
  const values = { source: null, projectRoot: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--source') values.source = argv[++index] ?? null;
    else if (value === '--project-root') values.projectRoot = argv[++index] ?? null;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!values.source || !values.projectRoot) {
    throw new Error('Usage: node scripts/inject-bundled-artists.mjs --source <dir> --project-root <staging-dir>');
  }
  return values;
}

function assertNullableString(value, field, artistId) {
  if (value !== null && typeof value !== 'string') {
    throw new Error(`Artist ${artistId} has invalid ${field}`);
  }
}

async function loadAndValidateSource(sourceDirectory) {
  const sourceFile = path.join(sourceDirectory, 'artists.json');
  const parsed = JSON.parse(await readFile(sourceFile, 'utf8'));
  if (parsed?.format !== SOURCE_FORMAT || parsed?.version !== SOURCE_VERSION || !Array.isArray(parsed.artists)) {
    throw new Error('Unsupported bundled artist source format');
  }

  const artistIds = new Set();
  const avatarIds = new Set();
  for (const artist of parsed.artists) {
    if (!artist || typeof artist !== 'object' || !UUID_V4_PATTERN.test(artist.id ?? '')) {
      throw new Error(`Invalid artist id: ${String(artist?.id)}`);
    }
    if (artistIds.has(artist.id)) throw new Error(`Duplicate artist id: ${artist.id}`);
    if (typeof artist.name !== 'string' || !artist.name.trim()) {
      throw new Error(`Artist ${artist.id} has no name`);
    }
    assertNullableString(artist.short_name, 'short_name', artist.id);
    assertNullableString(artist.parent_id, 'parent_id', artist.id);
    assertNullableString(artist.url, 'url', artist.id);
    assertNullableString(artist.avatar_id, 'avatar_id', artist.id);
    if (artist.avatar_id !== null) {
      if (!/^\d+$/.test(artist.avatar_id)) throw new Error(`Artist ${artist.id} has invalid avatar_id`);
      if (avatarIds.has(artist.avatar_id)) throw new Error(`Duplicate avatar id: ${artist.avatar_id}`);
      avatarIds.add(artist.avatar_id);
    }
    artistIds.add(artist.id);
  }

  for (const artist of parsed.artists) {
    if (artist.parent_id !== null && !artistIds.has(artist.parent_id)) {
      throw new Error(`Artist ${artist.id} references unknown parent ${artist.parent_id}`);
    }
  }

  const avatarDirectory = path.join(sourceDirectory, 'avatars');
  const actualAvatarFiles = (await readdir(avatarDirectory))
    .filter((name) => name.toLowerCase().endsWith('.jpg'))
    .sort();
  const expectedAvatarFiles = [...avatarIds].map((id) => `avatar_${id}.jpg`).sort();
  const missing = expectedAvatarFiles.filter((name) => !actualAvatarFiles.includes(name));
  const extra = actualAvatarFiles.filter((name) => !expectedAvatarFiles.includes(name));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`Avatar mismatch: missing=${missing.length}, extra=${extra.length}`);
  }

  return { artists: parsed.artists, avatarDirectory, avatarFiles: actualAvatarFiles };
}

function generateAdapterSource(artists, avatarFiles) {
  const artistRows = artists.map((artist) => ({
    id: artist.id,
    name: artist.name,
    short_name: artist.short_name,
    parent_id: artist.parent_id,
    url: artist.url,
    avatar_uri: artist.avatar_id === null ? null : `preset://${artist.avatar_id}`,
  }));
  const avatarEntries = avatarFiles.map((filename) => {
    const id = filename.slice('avatar_'.length, -'.jpg'.length);
    return `  ${JSON.stringify(id)}: require('../../assets/bundled-artists/${filename}'),`;
  });

  return `// Generated in a disposable private-build staging directory. Do not commit this file.\n`
    + `import type { SQLiteDatabase } from 'expo-sqlite';\n`
    + `import { toISODateTime } from '../utils/date';\n\n`
    + `interface BundledArtist {\n`
    + `  id: string;\n  name: string;\n  short_name: string | null;\n  parent_id: string | null;\n`
    + `  url: string | null;\n  avatar_uri: string | null;\n}\n\n`
    + `const BUNDLED_ARTISTS: BundledArtist[] = ${JSON.stringify(artistRows, null, 2)};\n\n`
    + `const BUNDLED_ARTIST_AVATARS: Record<string, number> = {\n${avatarEntries.join('\n')}\n};\n\n`
    + `export async function insertBundledArtists(db: SQLiteDatabase): Promise<void> {\n`
    + `  const now = toISODateTime();\n`
    + `  await db.withTransactionAsync(async () => {\n`
    + `    for (const artist of BUNDLED_ARTISTS) {\n`
    + `      await db.runAsync(\n`
    + `        'INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?)',\n`
    + `        [artist.id, artist.name, artist.short_name, artist.avatar_uri, artist.url, now],\n`
    + `      );\n`
    + `    }\n`
    + `    for (const artist of BUNDLED_ARTISTS) {\n`
    + `      if (artist.parent_id !== null) {\n`
    + `        await db.runAsync('UPDATE artists SET parent_id = ? WHERE id = ?', [artist.parent_id, artist.id]);\n`
    + `      }\n`
    + `    }\n`
    + `  });\n`
    + `}\n\n`
    + `export function resolveBundledArtistAvatar(id: string): number | undefined {\n`
    + `  return BUNDLED_ARTIST_AVATARS[id];\n`
    + `}\n`;
}

const { source, projectRoot } = parseArguments(process.argv.slice(2));
const resolvedSource = path.resolve(source);
const resolvedProjectRoot = path.resolve(projectRoot);
if (existsSync(path.join(resolvedProjectRoot, '.git'))) {
  throw new Error('Refusing to inject private artists into a Git working tree; use a disposable staging directory');
}
const packageJson = JSON.parse(await readFile(path.join(resolvedProjectRoot, 'package.json'), 'utf8'));
if (packageJson.name !== 'ota-log') throw new Error('Target staging directory is not ota-log');

const { artists, avatarDirectory, avatarFiles } = await loadAndValidateSource(resolvedSource);
const targetAvatarDirectory = path.join(resolvedProjectRoot, 'assets', 'bundled-artists');
await rm(targetAvatarDirectory, { recursive: true, force: true });
await mkdir(targetAvatarDirectory, { recursive: true });
for (const filename of avatarFiles) {
  await cp(path.join(avatarDirectory, filename), path.join(targetAvatarDirectory, filename));
}
await writeFile(
  path.join(resolvedProjectRoot, 'src', 'db', 'bundledArtistCatalog.ts'),
  generateAdapterSource(artists, avatarFiles),
  'utf8',
);

process.stdout.write(`Injected ${artists.length} artists and ${avatarFiles.length} avatars into ${resolvedProjectRoot}\n`);
