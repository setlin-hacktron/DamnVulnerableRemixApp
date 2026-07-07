import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { requireUser } from "~/auth.server";
import db from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category") || "";
  const status = url.searchParams.get("status") || "";

  let query =
    "SELECT e.*, u.name as submitter_name FROM expenses e JOIN users u ON e.user_id = u.id";
  const conditions: string[] = [];
  const params: any[] = [];

  if (user.role === "employee") {
    conditions.push("e.user_id = ?");
    params.push(user.id);
  }

  if (search) {
    conditions.push("(e.title LIKE ? OR e.description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    conditions.push("e.category = ?");
    params.push(category);
  }

  if (status) {
    conditions.push("e.status = ?");
    params.push(status);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY e.created_at DESC";

  const expenses = db.prepare(query).all(...params) as any[];

  return json({ expenses, user, search, category, status });
}

export default function ExpensesList() {
  const { expenses, user, search, category, status } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <Link
          to="/expenses/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          New Expense
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg mb-6 p-4">
        <form method="get" className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              name="q"
              placeholder="Search expenses..."
              defaultValue={search}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>
          <select
            name="category"
            defaultValue={category}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm"
          >
            <option value="">All Categories</option>
            <option value="Travel">Travel</option>
            <option value="Meals">Meals</option>
            <option value="Equipment">Equipment</option>
            <option value="Training">Training</option>
            <option value="Software">Software</option>
            <option value="Other">Other</option>
          </select>
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Filter
          </button>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {expenses.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">
            No expenses found.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Title
                </th>
                {user.role !== "employee" && (
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Submitted By
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {expenses.map((exp: any) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-400">#{exp.id}</td>
                  <td className="px-6 py-4 text-sm">
                    <Link
                      to={`/expenses/${exp.id}`}
                      className="text-indigo-600 hover:underline font-medium"
                    >
                      {exp.title}
                    </Link>
                  </td>
                  {user.role !== "employee" && (
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {exp.submitter_name}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    ${Number(exp.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{exp.category}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        exp.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : exp.status === "denied"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(exp.created_at).toLocaleDateString()}
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
