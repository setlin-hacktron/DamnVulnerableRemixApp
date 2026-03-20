#!/usr/bin/env bash
set -uo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
PASS=0
FAIL=0

check() {
  local desc="$1"
  local method="$2"
  local url="$3"
  local expected_code="$4"
  shift 4
  local extra_args=("$@")

  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "${extra_args[@]}" "$url" 2>/dev/null || echo "000")

  if [[ "$code" == "$expected_code" ]]; then
    echo "  PASS  $desc (HTTP $code)"
    ((PASS++))
  else
    echo "  FAIL  $desc (expected $expected_code, got $code)"
    ((FAIL++))
  fi
}

echo ""
echo "=== ExpenseFlow Smoke Tests ==="
echo "Target: $APP_URL"
echo ""

# Wait for app to be ready
echo "Waiting for app..."
for i in $(seq 1 30); do
  if curl -sf "$APP_URL/login" > /dev/null 2>&1; then
    echo "App is ready."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "FATAL: App not ready after 30 attempts"
    exit 1
  fi
  sleep 2
done

echo ""
echo "--- Public Routes ---"
check "GET /login returns 200" GET "$APP_URL/login" 200
check "GET /register returns 200" GET "$APP_URL/register" 200
check "GET /forgot-password returns 200" GET "$APP_URL/forgot-password" 200
check "GET / redirects (302)" GET "$APP_URL/" 302

echo ""
echo "--- Auth Protected Routes (should redirect/401) ---"
check "GET /dashboard requires auth" GET "$APP_URL/dashboard" 401
check "GET /expenses requires auth" GET "$APP_URL/expenses" 401
check "GET /profile requires auth" GET "$APP_URL/profile" 401

echo ""
echo "--- Login Flow ---"
# Login and capture cookie
COOKIE_JAR=$(mktemp)
LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$APP_URL/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=john@expenseflow.io&password=password123" \
  -c "$COOKIE_JAR" 2>/dev/null || echo "000")

if [[ "$LOGIN_CODE" == "302" ]]; then
  echo "  PASS  POST /login with valid creds (HTTP 302 redirect)"
  ((PASS++))
else
  echo "  FAIL  POST /login with valid creds (expected 302, got $LOGIN_CODE)"
  ((FAIL++))
fi

check "POST /login with bad creds returns 401" POST "$APP_URL/login" 401 \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=bad@example.com&password=wrong"

echo ""
echo "--- Authenticated Routes ---"
AUTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$APP_URL/dashboard" 2>/dev/null)
if [[ "$AUTH_CHECK" == "200" ]]; then
  echo "  PASS  GET /dashboard with session (HTTP 200)"
  ((PASS++))
else
  echo "  FAIL  GET /dashboard with session (expected 200, got $AUTH_CHECK)"
  ((FAIL++))
fi

check "GET /expenses with session" GET "$APP_URL/expenses" 200 -b "$COOKIE_JAR"
check "GET /expenses/1 with session" GET "$APP_URL/expenses/1" 200 -b "$COOKIE_JAR"
check "GET /expenses/new with session" GET "$APP_URL/expenses/new" 200 -b "$COOKIE_JAR"
check "GET /profile with session" GET "$APP_URL/profile" 200 -b "$COOKIE_JAR"
check "GET /api/export with session" GET "$APP_URL/api/export" 200 -b "$COOKIE_JAR"

echo ""
echo "--- Registration ---"
REG_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$APP_URL/register" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=Test+User&email=test_$(date +%s)@example.com&password=test1234&department=Engineering" \
  2>/dev/null || echo "000")
if [[ "$REG_CODE" == "302" ]]; then
  echo "  PASS  POST /register creates user (HTTP 302)"
  ((PASS++))
else
  echo "  FAIL  POST /register (expected 302, got $REG_CODE)"
  ((FAIL++))
fi

rm -f "$COOKIE_JAR"

echo ""
echo "==================================="
echo "Results: $PASS passed, $FAIL failed"
echo "==================================="

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
echo "All tests passed!"
