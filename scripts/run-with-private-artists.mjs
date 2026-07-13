import { cp, lstat, mkdtemp, rm, symlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArguments(argv) {
  const separatorIndex = argv.indexOf('--');
  if (separatorIndex < 0 || separatorIndex === argv.length - 1) {
    throw new Error('Usage: node scripts/run-with-private-artists.mjs --source <dir> [--keep] -- <command> [...args]');
  }

  let source = process.env.OTA_LOG_ARTIST_SOURCE_DIR ?? null;
  let keep = false;
  for (let index = 0; index < separatorIndex; index += 1) {
    const value = argv[index];
    if (value === '--source') source = argv[++index] ?? null;
    else if (value === '--keep') keep = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!source) throw new Error('Missing --source or OTA_LOG_ARTIST_SOURCE_DIR');

  return {
    source: path.resolve(source),
    keep,
    command: argv[separatorIndex + 1],
    commandArguments: argv.slice(separatorIndex + 2),
  };
}

function shouldCopy(projectRoot, sourcePath) {
  const relative = path.relative(projectRoot, sourcePath);
  if (!relative) return true;
  const firstSegment = relative.split(path.sep)[0];
  if (['.git', '.expo', 'android', 'dist', 'ios', 'node_modules', 'web-build'].includes(firstSegment)) return false;
  if (relative === path.join('assets', 'artists') || relative.startsWith(`${path.join('assets', 'artists')}${path.sep}`)) return false;
  if (relative === path.join('src', 'db', 'artistAvatars.ts')) return false;
  if (relative === path.join('src', 'db', 'seedArtists.ts')) return false;
  if (relative === path.join('scripts', '.tmp-export-private-artists.mjs')) return false;
  return true;
}

function run(command, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`));
    });
  });
}

const args = parseArguments(process.argv.slice(2));
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const stagingRoot = await mkdtemp(path.join(tmpdir(), 'ota-log-private-build-'));

try {
  await cp(projectRoot, stagingRoot, {
    recursive: true,
    preserveTimestamps: true,
    filter: (sourcePath) => shouldCopy(projectRoot, sourcePath),
  });

  const nodeModules = path.join(projectRoot, 'node_modules');
  if (!(await lstat(nodeModules)).isDirectory()) throw new Error('node_modules is missing');
  await symlink(nodeModules, path.join(stagingRoot, 'node_modules'), 'junction');

  await run(
    process.execPath,
    [path.join(stagingRoot, 'scripts', 'inject-bundled-artists.mjs'), '--source', args.source, '--project-root', stagingRoot],
    stagingRoot,
    process.env,
  );
  await run(args.command, args.commandArguments, stagingRoot, {
    ...process.env,
    OTA_LOG_ARTIST_SOURCE_DIR: args.source,
    OTA_LOG_PRIVATE_BUILD_STAGING: '1',
  });
} finally {
  if (args.keep) {
    process.stdout.write(`Private build staging kept at ${stagingRoot}\n`);
  } else {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}
