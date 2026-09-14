#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly SOURCE_DIR="${REPO_ROOT}/publishing/website/"

DEPLOY_HOST="${OTA_LOG_DEPLOY_HOST:-root@8.133.166.21}"
DEPLOY_PATH="${OTA_LOG_DEPLOY_PATH:-/var/www/ota-log}"
SITE_URL="${OTA_LOG_SITE_URL:-}"
GITHUB_RELEASES_URL="${OTA_LOG_GITHUB_RELEASES_URL:-https://github.com/KurageZ/ota-log/releases/latest}"
APK_URL="${OTA_LOG_APK_URL:-}"
STAGING_DIR=""

DRY_RUN=false
CHECK_ONLY=false
DELETE_REMOTE=false

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy-website.sh [options]

Options:
  --apk-url URL  Android download URL, currently used for the Quark cloud-drive link (overrides OTA_LOG_APK_URL).
  --check-only  Only validate local website files; do not connect to the server.
  --dry-run     Preview files that rsync would transfer.
  --delete      Delete remote files that no longer exist locally.
  -h, --help    Show this help.

Environment overrides:
  OTA_LOG_DEPLOY_HOST  SSH target (default: root@8.133.166.21)
  OTA_LOG_DEPLOY_PATH  Remote website directory (default: /var/www/ota-log)
  OTA_LOG_GITHUB_RELEASES_URL  GitHub Releases URL
  OTA_LOG_APK_URL      Android download URL (overridden by --apk-url)
  OTA_LOG_SITE_URL     Optional public URL used for post-deploy HTTP checks
EOF
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

while (($# > 0)); do
  case "$1" in
    --apk-url)
      (($# >= 2)) || fail "--apk-url requires a URL"
      APK_URL="$2"
      shift
      ;;
    --check-only)
      CHECK_ONLY=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --delete)
      DELETE_REMOTE=true
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
  shift
done

require_command python3

if [[ "$CHECK_ONLY" == false && -z "$APK_URL" ]]; then
  fail "provide --apk-url URL or OTA_LOG_APK_URL for deployment"
fi

# Generate configuration in a temporary copy; never modify tracked website files.
STAGING_DIR="$(mktemp -d /tmp/ota-log-website.XXXXXX)"
trap 'rm -rf "$STAGING_DIR"' EXIT
python3 - "$SOURCE_DIR" "$STAGING_DIR" "$GITHUB_RELEASES_URL" "$APK_URL" <<'PYCONFIG'
import json
import shutil
import sys
from pathlib import Path
from urllib.parse import urlsplit

source, destination, github_url, quark_url = sys.argv[1:]
shutil.copytree(source, destination, dirs_exist_ok=True)
(Path(destination) / "android-download.js").write_text(
    "window.OTA_LOG_GITHUB_RELEASES_URL = " + json.dumps(github_url or None) + ";\n"
    "window.OTA_LOG_QUARK_URL = " + json.dumps(quark_url or None) + ";\n",
    encoding="utf-8",
)
PYCONFIG

python3 - "$STAGING_DIR" <<'PY'
from html.parser import HTMLParser
from pathlib import Path
from sys import argv
from urllib.parse import urlsplit


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, _tag, attrs):
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.links.append(value)


root = Path(argv[1]).resolve()
required = [
    root / "index.html",
    root / "icon.png",
    root / "privacy" / "index.html",
    root / "support" / "index.html",
]

missing = [str(path.relative_to(root)) for path in required if not path.is_file()]
if missing:
    raise SystemExit(f"Missing required website files: {', '.join(missing)}")

for html_file in root.rglob("*.html"):
    parser = LinkParser()
    parser.feed(html_file.read_text(encoding="utf-8"))

    for link in parser.links:
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc or link.startswith("#") or not parsed.path:
            continue

        target = (html_file.parent / parsed.path).resolve()
        if parsed.path.endswith("/"):
            target /= "index.html"

        try:
            target.relative_to(root)
        except ValueError as error:
            raise SystemExit(f"Local link escapes website root: {html_file}: {link}") from error

        if not target.exists():
            raise SystemExit(f"Broken local link: {html_file}: {link}")

print("Local website validation passed.")
PY

if [[ "$CHECK_ONLY" == true ]]; then
  exit 0
fi

require_command rsync
require_command ssh

[[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9._@:-]+$ ]] || fail "unsafe SSH target: $DEPLOY_HOST"
[[ "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "unsafe remote path: $DEPLOY_PATH"
[[ "$DEPLOY_PATH" != *"/../"* && "$DEPLOY_PATH" != */.. ]] || fail "remote path must not contain '..'"

DEPLOY_PATH="${DEPLOY_PATH%/}"
case "$DEPLOY_PATH" in
  "" | / | /var | /var/www)
    fail "refusing to deploy to broad remote path: $DEPLOY_PATH"
    ;;
esac

readonly REMOTE_PARENT="${DEPLOY_PATH%/*}"
readonly SSH_CONTROL_DIR="$(mktemp -d /tmp/ota-log-deploy.XXXXXX)"
readonly SSH_CONTROL_PATH="${SSH_CONTROL_DIR}/control"
SSH_MASTER_STARTED=false

readonly SSH_OPTIONS=(
  -o ConnectTimeout=10
  -o ControlMaster=auto
  -o ControlPersist=60
  -o "ControlPath=$SSH_CONTROL_PATH"
)

cleanup() {
  if [[ "$SSH_MASTER_STARTED" == true ]]; then
    ssh "${SSH_OPTIONS[@]}" -O exit "$DEPLOY_HOST" >/dev/null 2>&1 || true
  fi
  rm -rf "$STAGING_DIR"
  rmdir "$SSH_CONTROL_DIR" >/dev/null 2>&1 || true
}

trap cleanup EXIT

printf 'Deploy target: %s:%s\n' "$DEPLOY_HOST" "$DEPLOY_PATH"

if ! ssh "${SSH_OPTIONS[@]}" -MNf "$DEPLOY_HOST"; then
  fail "SSH connection failed. Run 'ssh $DEPLOY_HOST' directly to inspect the authentication or host-key error."
fi
SSH_MASTER_STARTED=true

if ! ssh "${SSH_OPTIONS[@]}" "$DEPLOY_HOST" "test -d '$REMOTE_PARENT'"; then
  fail "remote parent directory does not exist: $REMOTE_PARENT"
fi

if ! ssh "${SSH_OPTIONS[@]}" "$DEPLOY_HOST" "command -v rsync >/dev/null"; then
  fail "rsync is not installed on $DEPLOY_HOST; install it on the server before deploying."
fi

if [[ "$DRY_RUN" == false ]]; then
  ssh "${SSH_OPTIONS[@]}" "$DEPLOY_HOST" "mkdir -p '$DEPLOY_PATH'"
fi

RSYNC_OPTIONS=(
  --archive
  --delay-updates
  --human-readable
  --itemize-changes
  --chmod=u=rwX,go=rX
  --exclude=/README.md
)

if [[ "$DRY_RUN" == true ]]; then
  RSYNC_OPTIONS+=(--dry-run)
fi

if [[ "$DELETE_REMOTE" == true ]]; then
  RSYNC_OPTIONS+=(
    --delete-delay
    --filter='protect /.well-known/***'
  )
fi

rsync "${RSYNC_OPTIONS[@]}" \
  -e "ssh -o ConnectTimeout=10 -o ControlMaster=auto -o ControlPersist=60 -o ControlPath=$SSH_CONTROL_PATH" \
  "${STAGING_DIR}/" "${DEPLOY_HOST}:${DEPLOY_PATH}/"

if [[ "$DRY_RUN" == true ]]; then
  printf 'Dry run complete; no files were changed.\n'
  exit 0
fi

ssh "${SSH_OPTIONS[@]}" "$DEPLOY_HOST" \
  "test -f '$DEPLOY_PATH/index.html' && test -f '$DEPLOY_PATH/privacy/index.html' && test -f '$DEPLOY_PATH/support/index.html'"

if [[ -n "$SITE_URL" ]]; then
  require_command curl
  SITE_URL="${SITE_URL%/}"
  for route in / /privacy/ /support/; do
    curl --fail --silent --show-error --location "${SITE_URL}${route}" >/dev/null
  done
  printf 'HTTP checks passed: %s\n' "$SITE_URL"
fi

printf 'Website deployed successfully.\n'
