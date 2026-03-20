import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUser } from "~/auth.server";
import db from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const stats = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) as approved,
        COALESCE(SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END), 0) as denied,
        COALESCE(SUM(amount), 0) as total_amount
      FROM expenses WHERE user_id = ?`
    )
    .get(user.id) as any;

  const recentExpenses = db
    .prepare("SELECT * FROM expenses WHERE user_id = ? ORDER BY created_at DESC LIMIT 5")
    .all(user.id) as any[];

  let pendingApprovals = 0;
  if (user.role === "manager" || user.role === "admin") {
    const result = db
      .prepare("SELECT COUNT(*) as count FROM expenses WHERE status = 'pending'")
      .get() as any;
    pendingApprovals = result.count;
  }

  return json({ user, stats, recentExpenses, pendingApprovals });
}

export default function Dashboard() {
  const { user, stats, recentExpenses, pendingApprovals } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {user.role.charAt(0).toUpperCase() + user.role.slice(1)} &middot; {user.department}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label="Total Expenses" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} color="yellow" />
        <StatCard label="Approved" value={stats.approved} color="green" />
        <StatCard
          label="Total Amount"
          value={`$${Number(stats.total_amount).toFixed(2)}`}
          color="indigo"
        />
      </div>

      {pendingApprovals > 0 && (
        <div className="mb-8 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-800">
            You have{" "}
            <Link to="/admin" className="underline font-bold">
              {pendingApprovals} expense(s)
            </Link>{" "}
            waiting for approval.
          </p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Expenses</h2>
          <Link
            to="/expenses/new"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            New Expense
          </Link>
        </div>
        <div className="border-t border-gray-200">
          {recentExpenses.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">
              No expenses yet.{" "}
              <Link to="/expenses/new" className="text-indigo-600 hover:underline">
                Submit your first expense
              </Link>
            </p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {recentExpenses.map((exp: any) => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">
                      <Link
                        to={`/expenses/${exp.id}`}
                        className="text-indigo-600 hover:underline font-medium"
                      >
                        {exp.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      ${Number(exp.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{exp.category}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={exp.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "gray",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  const colors: Record<string, string> = {
    gray: "bg-white",
    yellow: "bg-yellow-50 border-yellow-200",
    green: "bg-green-50 border-green-200",
    indigo: "bg-indigo-50 border-indigo-200",
  };

  return (
    <div className={`rounded-lg border p-5 shadow-sm ${colors[color] || colors.gray}`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    denied: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status] || "bg-gray-100 text-gray-800"
      }`}
    >
      {status}
    </span>
  );
}
