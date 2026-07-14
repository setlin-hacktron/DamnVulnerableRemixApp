#!/usr/bin/env bash
set -uo pipefail

APP_URL="${APP_URL:-http://localhost:3001}"
COOKIE_JAR=$(mktemp)

echo "Logging in..."
LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$APP_URL/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=john@expenseflow.io&password=password123" \
  -c "$COOKIE_JAR")

if [[ "$LOGIN_CODE" != "302" ]]; then
  echo "Login failed! (Got HTTP $LOGIN_CODE)"
  exit 1
fi
echo "Login successful."

echo ""
echo "--- Testing SSRF on /expenses/new ---"

# Test 1: Localhost URL
echo "Testing localhost SSRF..."
RESP1=$(curl -s -b "$COOKIE_JAR" \
  -X POST "$APP_URL/expenses/new" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "title=SSRF+Test&amount=10&category=Other&receipt_url=http://localhost:3001/dashboard")

if echo "$RESP1" | grep -q "Invalid or untrusted receipt URL"; then
  echo "  PASS: Localhost URL blocked successfully!"
else
  echo "  FAIL: Localhost URL was not blocked!"
  echo "  Response was: $RESP1"
  exit 1
fi

# Test 2: Private IP URL
echo "Testing private IP (192.168.1.1) SSRF..."
RESP2=$(curl -s -b "$COOKIE_JAR" \
  -X POST "$APP_URL/expenses/new" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "title=SSRF+Test&amount=10&category=Other&receipt_url=http://192.168.1.1/some-path")

if echo "$RESP2" | grep -q "Invalid or untrusted receipt URL"; then
  echo "  PASS: Private IP URL blocked successfully!"
else
  echo "  FAIL: Private IP URL was not blocked!"
  echo "  Response was: $RESP2"
  exit 1
fi

# Test 3: Link-Local IP URL
echo "Testing AWS metadata / link-local (169.254.169.254) SSRF..."
RESP3=$(curl -s -b "$COOKIE_JAR" \
  -X POST "$APP_URL/expenses/new" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "title=SSRF+Test&amount=10&category=Other&receipt_url=http://169.254.169.254/latest/meta-data/")

if echo "$RESP3" | grep -q "Invalid or untrusted receipt URL"; then
  echo "  PASS: AWS metadata IP blocked successfully!"
else
  echo "  FAIL: AWS metadata IP was not blocked!"
  echo "  Response was: $RESP3"
  exit 1
fi

echo ""
echo "--- Testing SSRF on /api/import-receipt ---"

# Test 4: API endpoint with Localhost URL
echo "Testing API endpoint with localhost SSRF..."
RESP4=$(curl -s -b "$COOKIE_JAR" \
  -X POST "$APP_URL/api/import-receipt" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "url=http://127.0.0.1:3001/dashboard")

if echo "$RESP4" | grep -q "Invalid or untrusted receipt URL"; then
  echo "  PASS: API endpoint blocked localhost URL successfully!"
else
  echo "  FAIL: API endpoint did not block localhost URL!"
  echo "  Response was: $RESP4"
  exit 1
fi

# Test 5: API endpoint with Private IP URL
echo "Testing API endpoint with private IP SSRF..."
RESP5=$(curl -s -b "$COOKIE_JAR" \
  -X POST "$APP_URL/api/import-receipt" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "url=http://10.10.10.10/receipt.pdf")

if echo "$RESP5" | grep -q "Invalid or untrusted receipt URL"; then
  echo "  PASS: API endpoint blocked private IP successfully!"
else
  echo "  FAIL: API endpoint did not block private IP!"
  echo "  Response was: $RESP5"
  exit 1
fi

rm -f "$COOKIE_JAR"
echo ""
echo "All SSRF verification tests passed!"
