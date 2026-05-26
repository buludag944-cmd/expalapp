#!/usr/bin/env bash
# Full-stack E2E: free :3001/:3000 → backend npm start → frontend npm start → Ethereal registration → verify → login
# Repo layout: sibling frontend at ../frontend (override with FULL_STACK_FRONTEND_ROOT).
# Requires: bash, curl, python3 recommended; sqlite3 optional (cleans prior test email); outbound network for Ethereal.
# Usage from backend/: npm run test:full-stack
set +e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_ROOT="${FULL_STACK_FRONTEND_ROOT:-$(cd "$BACKEND_ROOT/../frontend" 2>/dev/null && pwd || echo "")}"

if [[ ! -d "$FRONTEND_ROOT" ]] || [[ ! -f "$FRONTEND_ROOT/package.json" ]]; then
  echo "❌ Frontend not found at: ${FRONTEND_ROOT:-'(empty)'}"
  echo "   Point FULL_STACK_FRONTEND_ROOT at your CRA app directory (contains package.json with react-scripts)."
  exit 2
fi

_TMP="${TMPDIR:-/tmp}"
_TMP="${_TMP%/}"
LOG_B="${_TMP}/expal-backend-verify.log"
LOG_F="${_TMP}/expal-frontend-verify.log"
DB="$BACKEND_ROOT/expal.db"
EMAIL="cursorverify@example.com"
PASS="StrongPassword123!"

fail_cleanup() {
  echo ""
  echo "❌ $1"
}

cleanup_servers() {
  for pid in "${FRONT_PID:-}" "${BACK_PID:-}"; do
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  for p in 3000 3001; do
    PIDS=$(lsof -ti:"$p" 2>/dev/null)
    if [[ -n "${PIDS:-}" ]]; then echo "$PIDS" | xargs kill -9 2>/dev/null || true; fi
  done
}

echo "==> Killing listeners on ports 3000 and 3001 ..."
for p in 3000 3001; do
  PIDS=$(lsof -ti:"$p" 2>/dev/null)
  if [[ -n "${PIDS:-}" ]]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
  fi
done
sleep 2

if [[ -f "$DB" ]] && command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" "DELETE FROM Users WHERE lower(email)=lower('${EMAIL}');" 2>/dev/null || true
  echo "==> Removed prior test row for ${EMAIL} (if any)"
fi

: >"$LOG_B"
: >"$LOG_F"

echo "==> Starting backend (npm start): $BACKEND_ROOT"
cd "$BACKEND_ROOT" || exit 2
export SMTP_HOST=""
export SMTP_PORT=""
export SMTP_USER=""
export SMTP_PASS=""
(npm start >>"$LOG_B" 2>&1) &
BACK_PID=$!

echo "   backend log: $LOG_B (pid=$BACK_PID)"
START_WAIT=120
elapsed=0
while [[ $elapsed -lt $START_WAIT ]]; do
  if grep -q "Server listening" "$LOG_B" 2>/dev/null && curl -sf --connect-timeout 2 "http://127.0.0.1:3001/health" >/dev/null; then
    break
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done

if ! curl -sf --connect-timeout 3 "http://127.0.0.1:3001/health" | grep -q '"ok"'; then
  fail_cleanup "Backend did not become healthy."
  tail -80 "$LOG_B"
  cleanup_servers
  exit 1
fi

if grep -Eqi "SQLite|sequelize.*Error|DB sync error" "$LOG_B" 2>/dev/null; then
  echo "(warn) Possible DB error markers in backend log — check below after tail)"
fi

grep -Eq "Database synced|FORCE reset" "$LOG_B" && echo "✅ Backend DB sync message present." || echo "(note) Missing explicit DB sync grep (see log)"

echo "✅ Backend: http://localhost:3001/health OK"

echo "==> Starting frontend (npm start): $FRONTEND_ROOT"
cd "$FRONTEND_ROOT" || exit 2
export BROWSER=none
CI=true npm start >>"$LOG_F" 2>&1 &
FRONT_PID=$!

echo "   frontend log: $LOG_F (pid=$FRONT_PID)"

FE_WAIT=240
elapsed=0
FE_OK=0
while [[ $elapsed -lt $FE_WAIT ]]; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://127.0.0.1:3000/" 2>/dev/null || echo "000")
  if [[ "$CODE" == "200" ]]; then
    FE_OK=1
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

if [[ "$FE_OK" != "1" ]]; then
  fail_cleanup "Frontend did not respond with HTTP 200 on :3000 (last code=$CODE)"
  tail -60 "$LOG_F"
  cleanup_servers
  exit 1
fi
echo "✅ Frontend loads at http://localhost:3000 (HTTP $CODE)"

ETH_HTML=$(mktemp "${_TMP}/ethereal_verify.XXXXXX.html")

echo ""
echo "==> POST /api/register ..."
REG_TMP=$(mktemp)
CODE=$(curl -sS -o "$REG_TMP" -w "%{http_code}" --connect-timeout 15 \
  -X POST "http://127.0.0.1:3001/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"firstName\":\"Cursor\",\"lastName\":\"Verify\",\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}")

cat "$REG_TMP"
echo ""
echo "   HTTP status: $CODE"
rm -f "$REG_TMP"

if [[ "$CODE" != "201" ]]; then
  fail_cleanup "Register expected HTTP 201, got $CODE"
  tail -100 "$LOG_B"
  rm -f "$ETH_HTML"
  cleanup_servers
  exit 1
fi

echo "Waiting for Ethereal / email logs (max 90s)..."
elapsed=0
while [[ $elapsed -lt 90 ]]; do
  if grep -qE '\[email\]' "$LOG_B" 2>/dev/null || grep -q "sendMail failed" "$LOG_B" 2>/dev/null; then
    break
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done

echo ""
echo "----- Backend log (register / email) -----"
grep -E '\[(register|email|verify)\]' "$LOG_B" 2>/dev/null | tail -30 || tail -40 "$LOG_B"

HAS_REGISTER=""
grep -q '\[register\] POST /api/register handler invoked' "$LOG_B" 2>/dev/null && HAS_REGISTER=1

if [[ -z "$HAS_REGISTER" ]]; then
  echo ""
  echo "❌ DIAGNOSTIC: Missing [register] POST /api/register handler invoked — request may not have reached backend."
  rm -f "$ETH_HTML"
  cleanup_servers
  exit 1
fi

if grep -q '\[email\] sendMail failed:' "$LOG_B" 2>/dev/null; then
  echo ""
  echo "❌ DIAGNOSTIC: [email] sendMail failed — check outbound connectivity, firewall, or SMTP_* / credentials in backend .env."
  rm -f "$ETH_HTML"
  cleanup_servers
  exit 1
fi

if ! grep -q '\[email\]' "$LOG_B" 2>/dev/null; then
  echo ""
  echo "❌ DIAGNOSTIC: No [email] lines in backend log."
  echo "   • If SMTP_HOST is unset, Ethereal requires internet for nodemailer.createTestAccount()."
  echo "   • If SMTP_* is set, verify host/port/user/pass and MAIL_FROM."
  rm -f "$ETH_HTML"
  cleanup_servers
  exit 1
fi

PREVIEW=$(grep '\[email\] Preview URL:' "$LOG_B" 2>/dev/null | tail -1 | sed -n 's/.*Preview URL:[[:space:]]*\(.*\)$/\1/p' | tr -d '\r' | awk '{print $1}')

if [[ -z "$PREVIEW" || "$PREVIEW" == "(none" ]]; then
  echo ""
  echo "❌ Could not parse Ethereal Preview URL from logs."
  rm -f "$ETH_HTML"
  cleanup_servers
  exit 1
fi

echo ""
echo "==> Fetching Preview URL ..."
ETH_CODE=$(curl -sS -o "$ETH_HTML" -w "%{http_code}" --connect-timeout 30 "$PREVIEW")
echo "   Preview HTTP: $ETH_CODE"

if [[ "$ETH_CODE" != "200" ]]; then
  fail_cleanup "Ethereal preview did not return HTTP 200 ($ETH_CODE)"
  rm -f "$ETH_HTML"
  cleanup_servers
  exit 1
fi

TOKEN=$(grep -Eo 'verify/[0-9a-f]{64}' "$ETH_HTML" | head -1 | cut -d/ -f2)
if [[ -z "$TOKEN" || ${#TOKEN} -ne 64 ]]; then
  fail_cleanup "Preview HTML missing /verify/<64-hex-token>"
  rm -f "$ETH_HTML"
  cleanup_servers
  exit 1
fi
echo "✅ Preview contains verification token (${#TOKEN} hex chars)"

echo ""
echo "==> GET /api/auth/verify/:token"
VERIFY_BODY=$(mktemp)
VCODE=$(curl -sS -o "$VERIFY_BODY" -w "%{http_code}" --connect-timeout 15 \
  "http://127.0.0.1:3001/api/auth/verify/${TOKEN}")
echo "   HTTP status: $VCODE"
cat "$VERIFY_BODY"
echo ""
rm -f "$VERIFY_BODY"

if [[ "$VCODE" != "200" ]]; then
  fail_cleanup "Verify expected HTTP 200, got $VCODE"
  tail -80 "$LOG_B"
  rm -f "$ETH_HTML"
  cleanup_servers
  exit 1
fi

VERIFY_LOG_OK=""
grep -Fq "[verify] Account activated email=cursorverify@example.com" "$LOG_B" 2>/dev/null && VERIFY_LOG_OK=1
if [[ -z "$VERIFY_LOG_OK" ]]; then
  echo "⚠️  Checking relaxed pattern for verify log..."
  grep '\[verify\]' "$LOG_B" | tail -5
  if ! grep -q '\[verify\] Account activated email=cursorverify@example.com' "$LOG_B" 2>/dev/null; then
    fail_cleanup "Missing backend log line: [verify] Account activated email=cursorverify@example.com id=..."
    rm -f "$ETH_HTML"
    cleanup_servers
    exit 1
  fi
fi
echo "✅ Backend [verify] log present for cursorverify@example.com"

LOGIN_TMP=$(mktemp)
LCODE=$(curl -sS -o "$LOGIN_TMP" -w "%{http_code}" --connect-timeout 15 \
  -X POST "http://127.0.0.1:3001/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}")

echo ""
echo "==> POST /api/login"
echo "   HTTP status: $LCODE"

if [[ "$LCODE" != "200" ]]; then
  fail_cleanup "Login expected HTTP 200, got $LCODE"
  cat "$LOGIN_TMP"
  rm -f "$LOGIN_TMP" "$ETH_HTML"
  cleanup_servers
  exit 1
fi

JWT_LEN=""
if command -v python3 >/dev/null 2>&1; then
  JWT_LEN=$(python3 -c "import json; d=json.load(open('$LOGIN_TMP', encoding='utf-8')); print(len(d.get('token') or ''))")
fi

if [[ -z "${JWT_LEN:-}" || "${JWT_LEN:-}" == "0" ]]; then
  JWT=$(sed -n 's/.*\"token\":\"\([^\"]*\)\".*/\1/p' "$LOGIN_TMP" | head -1 || true)
  JWT_LEN=${#JWT}
fi

cat "$LOGIN_TMP"
echo ""
rm -f "$LOGIN_TMP"

if [[ -z "$JWT_LEN" || "$JWT_LEN" -eq 0 ]]; then
  fail_cleanup "Login JSON missing token"
  rm -f "$ETH_HTML"
  cleanup_servers
  exit 1
fi

echo "[test] Login successful (JWT length = ${JWT_LEN} chars)"

echo ""
echo "Shutting down dev servers ..."
cleanup_servers
rm -f "$ETH_HTML"

echo ""
echo "✅ Verification flow successful."
