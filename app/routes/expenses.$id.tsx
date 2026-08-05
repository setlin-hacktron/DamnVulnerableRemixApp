import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, Form, useActionData } from "@remix-run/react";
import { requireUser } from "~/auth.server";
import db from "~/db.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const expense = db
    .prepare(
      `SELECT e.*, u.name as submitter_name, u.email as submitter_email, u.department as submitter_department
       FROM expenses e JOIN users u ON e.user_id = u.id WHERE e.id = ?`
    )
    .get(params.id) as any;

  if (!expense) {
    throw new Response("Expense not found", { status: 404 });
  }

  if (user.role === "employee" && expense.user_id !== user.id) {
    throw new Response("Forbidden", { status: 403 });
  }

  const reimbursement = db
    .prepare("SELECT * FROM reimbursements WHERE expense_id = ?")
    .get(expense.id) as any;

  return json({ expense, reimbursement });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    const expense = db
      .prepare("SELECT user_id FROM expenses WHERE id = ?")
      .get(params.id) as any;

    if (!expense) {
      throw new Response("Expense not found", { status: 404 });
    }

    if (user.role === "employee" && expense.user_id !== user.id) {
      throw new Response("Forbidden", { status: 403 });
    }

    db.prepare("DELETE FROM reimbursements WHERE expense_id = ?").run(params.id);
    db.prepare("DELETE FROM expenses WHERE id = ?").run(params.id);
    return json({ success: true, message: "Expense deleted" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function ExpenseDetail() {
  const { expense, reimbursement } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link to="/expenses" className="text-sm text-indigo-600 hover:underline">
          &larr; Back to expenses
        </Link>
      </div>

      {actionData?.message && (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">
          {actionData.message}{" "}
          <Link to="/expenses" className="underline">
            Go back
          </Link>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{expense.title}</h1>
            <p className="mt-1 text-sm text-gray-500">Expense #{expense.id}</p>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
              expense.status === "approved"
                ? "bg-green-100 text-green-800"
                : expense.status === "denied"
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {expense.status}
          </span>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </label>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                ${Number(expense.amount).toFixed(2)}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </label>
              <p className="mt-1 text-lg text-gray-700">{expense.category}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </label>
            <div
              className="mt-2 text-sm text-gray-700 prose max-w-none"
              dangerouslySetInnerHTML={{ __html: expense.description || "<em>No description</em>" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Submitted By
              </label>
              <p className="mt-1 text-sm text-gray-700">{expense.submitter_name}</p>
              <p className="text-sm text-gray-500">{expense.submitter_email}</p>
              <p className="text-sm text-gray-500">{expense.submitter_department}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Submitted On
              </label>
              <p className="mt-1 text-sm text-gray-700">
                {new Date(expense.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {expense.receipt_path && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Receipt
              </label>
              <a
                href={`/api/receipt?file=${expense.receipt_path}`}
                className="mt-2 inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Download {expense.receipt_path}
              </a>
            </div>
          )}

          {reimbursement && (
            <div className="rounded-md bg-green-50 border border-green-200 p-4">
              <p className="text-sm font-medium text-green-800">
                Reimbursed: ${Number(reimbursement.amount).toFixed(2)} on{" "}
                {new Date(reimbursement.processed_at).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          {expense.status === "pending" && (
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <button
                type="submit"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                onClick={(e) => {
                  if (!confirm("Are you sure you want to delete this expense?")) {
                    e.preventDefault();
                  }
                }}
              >
                Delete
              </button>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
