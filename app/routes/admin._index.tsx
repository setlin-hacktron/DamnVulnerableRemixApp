import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useActionData, Link } from "@remix-run/react";
import { requireManager } from "~/auth.server";
import db from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireManager(request);

  const pendingExpenses = db
    .prepare(
      `SELECT e.*, u.name as submitter_name, u.department as submitter_department
       FROM expenses e JOIN users u ON e.user_id = u.id
       WHERE e.status = 'pending'
       ORDER BY e.created_at ASC`
    )
    .all() as any[];

  const recentlyProcessed = db
    .prepare(
      `SELECT e.*, u.name as submitter_name, a.name as approver_name
       FROM expenses e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN users a ON e.approved_by = a.id
       WHERE e.status IN ('approved', 'denied')
       ORDER BY e.approved_at DESC
       LIMIT 10`
    )
    .all() as any[];

  return json({ user, pendingExpenses, recentlyProcessed });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireManager(request);
  const formData = await request.formData();
  const expenseId = formData.get("expense_id") as string;
  const intent = formData.get("intent") as string;

  if (!expenseId || !intent) {
    return json({ error: "Missing parameters" }, { status: 400 });
  }

  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(expenseId) as any;
  if (!expense) {
    return json({ error: "Expense not found" }, { status: 404 });
  }

  if (expense.status !== "pending") {
    return json({ error: "Expense has already been processed" }, { status: 400 });
  }

  if (intent === "approve") {
    db.prepare(
      "UPDATE expenses SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(user.id, expenseId);

    db.prepare("INSERT INTO reimbursements (expense_id, amount) VALUES (?, ?)").run(
      expenseId,
      expense.amount
    );

    return json({ success: true, message: `Expense #${expenseId} approved` });
  }

  if (intent === "deny") {
    db.prepare(
      "UPDATE expenses SET status = 'denied', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(user.id, expenseId);

    return json({ success: true, message: `Expense #${expenseId} denied` });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function AdminDashboard() {
  const { user, pendingExpenses, recentlyProcessed } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Approvals</h1>
          <p className="text-sm text-gray-500">
            Review and process employee expense submissions
          </p>
        </div>
        {user.role === "admin" && (
          <Link
            to="/admin/users"
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Manage Users
          </Link>
        )}
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

      <div className="bg-white shadow rounded-lg mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Pending Approval ({pendingExpenses.length})
          </h2>
        </div>

        {pendingExpenses.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">
            No expenses pending approval.
          </p>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingExpenses.map((exp: any) => (
              <div key={exp.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <Link
                    to={`/expenses/${exp.id}`}
                    className="font-medium text-gray-900 hover:text-indigo-600"
                  >
                    {exp.title}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {exp.submitter_name} &middot; {exp.submitter_department} &middot;{" "}
                    {new Date(exp.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-lg font-bold text-gray-900">
                    ${Number(exp.amount).toFixed(2)}
                  </span>
                  <Form method="post" className="flex space-x-2">
                    <input type="hidden" name="expense_id" value={exp.id} />
                    <button
                      type="submit"
                      name="intent"
                      value="approve"
                      className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500"
                    >
                      Approve
                    </button>
                    <button
                      type="submit"
                      name="intent"
                      value="deny"
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                    >
                      Deny
                    </button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recently Processed</h2>
        </div>
        {recentlyProcessed.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">No recent activity.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Expense
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Submitter
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Processed By
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {recentlyProcessed.map((exp: any) => (
                <tr key={exp.id}>
                  <td className="px-6 py-3 text-sm">{exp.title}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{exp.submitter_name}</td>
                  <td className="px-6 py-3 text-sm font-medium">
                    ${Number(exp.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        exp.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {exp.approver_name || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
