#!/usr/bin/env bash
#
# Nightly backup of the VantaBlock database *and* its .env.
#
# Runs on the CasaOS box as the `glitch` user, driven by the
# vantablock-backup.timer systemd *user* unit (see scripts/systemd/). No root
# needed anywhere in here — that box has no NOPASSWD sudo.
#
# Each run produces one archive holding both files captured at the same instant:
#   data.db   consistent snapshot, VACUUM INTO + verified (scripts/db-snapshot.mjs)
#   .env      the app's environment, including secrets
#
# They travel together on purpose. Restoring a database whose paired .env has
# been lost is not a real recovery — once client keys are encrypted at rest, the
# key that decrypts them lives in .env, so a DB without its .env is undecryptable.
#
# Where copies go:
#   - Local: plain .tar.gz in ~/vantablock-backups, mode 0600 in a 0700 dir.
#     Not encrypted, deliberately — the plaintext DB and .env already sit on this
#     disk, so encrypting a local copy buys nothing and makes restores harder.
#     The tight modes matter though: the archive contains secrets.
#   - Off-site: AES-256 encrypted copy on the Relay VM. That one IS encrypted —
#     it's an internet-facing box, and the archive holds password hashes,
#     Pterodactyl keys, the Stripe secret and the session secret. A relay
#     compromise should yield ciphertext and nothing else.
#
# Exits non-zero if the off-site copy fails, even when the local one succeeded,
# so `systemctl --user --failed` actually surfaces it. Silent off-site failure is
# the exact kind of rot this backup was added to prevent.
#
# !! Never move the backup passphrase into .env. The passphrase decrypts the
# !! archive that contains .env — putting it inside would make every off-site
# !! backup unrecoverable the moment you actually need one.
#
# ---------------------------------------------------------------------------
# RESTORE RUNBOOK
#
#   # 1a. Local backups are plain — just extract one:
#   ls -lt ~/vantablock-backups/
#   mkdir -p /tmp/restore && tar -xzf ~/vantablock-backups/vantablock-<stamp>.tar.gz -C /tmp/restore
#
#   # 1b. ...or pull an off-site one and decrypt it:
#   scp -i /opt/vantablock/.ssh/vantablock_relay \
#       ubuntu@<RELAY_HOST>:vantablock-backups/vantablock-<stamp>.tar.gz.enc /tmp/
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
#       -pass file:$HOME/.vantablock-backup.pass \
#       -in /tmp/vantablock-<stamp>.tar.gz.enc -out /tmp/restore.tar.gz
#   mkdir -p /tmp/restore && tar -xzf /tmp/restore.tar.gz -C /tmp/restore
#
#   ls -a /tmp/restore        # data.db and .env (.env is hidden — use -a)
#
#   # 2. Stop the API before swapping anything.
#   systemctl --user stop vantablock-api
#
#   # 3. Move the current files aside — including -wal and -shm. Leaving a stale
#   #    WAL beside a restored database is the one step that can corrupt it.
#   cd /opt/vantablock/server
#   mv data.db data.db.pre-restore-$(date +%Y%m%d-%H%M%S)
#   rm -f data.db-wal data.db-shm
#   cp /opt/vantablock/.env /opt/vantablock/.env.pre-restore-$(date +%Y%m%d-%H%M%S)
#
#   # 4. Put the restored pair in place, keeping .env private.
#   cp /tmp/restore/data.db /opt/vantablock/server/data.db
#   cp /tmp/restore/.env    /opt/vantablock/.env
#   chmod 600 /opt/vantablock/.env /opt/vantablock/server/data.db
#
#   # 5. Back up and check.
#   systemctl --user start vantablock-api
#   curl -s http://127.0.0.1:8081/api/health
#
#   rm -rf /tmp/restore /tmp/restore.tar.gz     # don't leave secrets in /tmp
#
# The passphrase lives at ~/.vantablock-backup.pass on this box AND should be in
# the owner's password manager. Without it the off-site copies are unrecoverable.
# ---------------------------------------------------------------------------

set -euo pipefail

APP_DIR=/opt/vantablock
DB="$APP_DIR/server/data.db"
ENV_FILE="$APP_DIR/.env"
LOCAL_DIR="$HOME/vantablock-backups"
PASS_FILE="$HOME/.vantablock-backup.pass"
REMOTE_DIR=vantablock-backups

KEEP_LOCAL=30
KEEP_REMOTE=60

STAMP=$(date +%Y%m%d-%H%M%S)
ARCHIVE="vantablock-$STAMP.tar.gz"

umask 077
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

log() { echo "[backup-db] $*"; }
fail() { echo "[backup-db] ERROR: $*" >&2; exit 1; }

[ -f "$DB" ] || fail "database not found at $DB"
[ -f "$ENV_FILE" ] || fail ".env not found at $ENV_FILE"
[ -f "$PASS_FILE" ] || fail "passphrase file missing at $PASS_FILE"

mkdir -p "$LOCAL_DIR"
chmod 700 "$LOCAL_DIR"

# --- 1. snapshot the database and verify it -----------------------------------
STAGE="$TMP/stage"
mkdir -p "$STAGE"

log "snapshotting $DB"
( cd "$APP_DIR" && node scripts/db-snapshot.mjs "$DB" "$STAGE/data.db" ) \
  || fail "snapshot verification failed — not keeping this backup"

# --- 2. add .env and pack -----------------------------------------------------
cp "$ENV_FILE" "$STAGE/.env"
chmod 600 "$STAGE/data.db" "$STAGE/.env"

# `.` rather than a name list so the dotfile is definitely included.
tar -czf "$TMP/$ARCHIVE" -C "$STAGE" .

# Refuse to ship an archive that's missing either half.
tar -tzf "$TMP/$ARCHIVE" | grep -q './data.db' || fail "archive is missing data.db"
tar -tzf "$TMP/$ARCHIVE" | grep -q './.env'    || fail "archive is missing .env"

install -m 600 "$TMP/$ARCHIVE" "$LOCAL_DIR/$ARCHIVE"
log "local copy: $LOCAL_DIR/$ARCHIVE ($(stat -c %s "$LOCAL_DIR/$ARCHIVE") bytes)"

# --- 3. encrypted off-site copy ----------------------------------------------
# Relay connection details come from the app's own .env so there's one source of
# truth — server/relay.ts already drives the relay with these same three values.
env_get() { grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d '\r'; }

RELAY_HOST=$(env_get RELAY_HOST)
RELAY_USER=$(env_get RELAY_SSH_USER)
RELAY_KEY=$(env_get RELAY_SSH_KEY_PATH)

remote_ok=0
if [ -n "$RELAY_HOST" ] && [ -n "$RELAY_USER" ] && [ -n "$RELAY_KEY" ] && [ -f "$RELAY_KEY" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -pass "file:$PASS_FILE" -in "$TMP/$ARCHIVE" -out "$TMP/$ARCHIVE.enc"

  SSH_OPTS=(-i "$RELAY_KEY" -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)

  if ssh "${SSH_OPTS[@]}" "$RELAY_USER@$RELAY_HOST" "mkdir -p $REMOTE_DIR && chmod 700 $REMOTE_DIR" \
     && scp "${SSH_OPTS[@]}" "$TMP/$ARCHIVE.enc" "$RELAY_USER@$RELAY_HOST:$REMOTE_DIR/"; then
    remote_ok=1
    log "off-site copy: $RELAY_USER@$RELAY_HOST:$REMOTE_DIR/$ARCHIVE.enc"
    ssh "${SSH_OPTS[@]}" "$RELAY_USER@$RELAY_HOST" \
      "ls -1t $REMOTE_DIR/vantablock-*.tar.gz.enc 2>/dev/null | tail -n +$((KEEP_REMOTE + 1)) | xargs -r rm --" \
      || log "WARNING: remote prune failed"
  else
    log "WARNING: could not ship backup to the relay"
  fi
else
  log "WARNING: relay details missing or key unreadable — no off-site copy"
fi

# --- 4. prune local -----------------------------------------------------------
ls -1t "$LOCAL_DIR"/vantablock-*.tar.gz 2>/dev/null | tail -n +$((KEEP_LOCAL + 1)) | xargs -r rm --

log "done ($(ls -1 "$LOCAL_DIR"/vantablock-*.tar.gz 2>/dev/null | wc -l) local backups retained)"

# Local backup succeeded but the off-site copy didn't — report failure so the
# timer shows up in `systemctl --user --failed` rather than rotting quietly.
[ "$remote_ok" -eq 1 ] || fail "off-site copy did not complete (local backup was kept)"
