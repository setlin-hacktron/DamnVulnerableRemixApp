import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useActionData, Link } from "@remix-run/react";
import { requireUser } from "~/auth.server";
import db from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);

  const users = db
    .prepare("SELECT id, email, name, role, department, created_at FROM users ORDER BY created_at DESC")
    .all() as any[];

  const userStats = users.map((u: any) => {
    const expenseCount = (
      db.prepare("SELECT COUNT(*) as count FROM expenses WHERE user_id = ?").get(u.id) as any
    ).count;
    const totalAmount = (
      db
        .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ?")
        .get(u.id) as any
    ).total;
    return { ...u, expenseCount, totalAmount };
  });

  return json({ users: userStats });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const userId = formData.get("user_id") as string;

  if (intent === "update_role") {
    const newRole = formData.get("role") as string;
    if (!["employee", "manager", "admin"].includes(newRole)) {
      return json({ error: "Invalid role" }, { status: 400 });
    }
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(newRole, userId);
    return json({ success: true, message: "User role updated" });
  }

  if (intent === "delete") {
    db.prepare("DELETE FROM reimbursements WHERE expense_id IN (SELECT id FROM expenses WHERE user_id = ?)").run(userId);
    db.prepare("DELETE FROM expenses WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    return json({ success: true, message: "User deleted" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function AdminUsers() {
  const { users } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">{users.length} registered users</p>
        </div>
        <Link
          to="/admin"
          className="text-sm text-indigo-600 hover:underline"
        >
          &larr; Back to approvals
        </Link>
      </div>

      {actionData?.message && (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">
          {actionData.message}
        </div>
      )}
      {actionData?.error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {actionData.error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Expenses
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Total Claimed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {users.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-sm text-gray-500">{u.email}</p>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{u.department}</td>
                <td className="px-6 py-4">
                  <Form method="post" className="flex items-center space-x-2">
                    <input type="hidden" name="intent" value="update_role" />
                    <input type="hidden" name="user_id" value={u.id} />
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="submit"
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Update
                    </button>
                  </Form>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{u.expenseCount}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  ${Number(u.totalAmount).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="user_id" value={u.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                      onClick={(e) => {
                        if (!confirm(`Delete user ${u.name}? This cannot be undone.`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Delete
                    </button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
