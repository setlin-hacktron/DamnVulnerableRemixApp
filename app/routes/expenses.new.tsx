import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, Link } from "@remix-run/react";
import { requireUser } from "~/auth.server";
import db from "~/db.server";
import { validateUrl } from "~/ssrf.server";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const category = formData.get("category") as string;
  const receiptUrl = formData.get("receipt_url") as string;

  if (!title || !amount || !category) {
    return json({ error: "Title, amount, and category are required" }, { status: 400 });
  }

  if (amount <= 0 || amount > 50000) {
    return json({ error: "Amount must be between $0.01 and $50,000" }, { status: 400 });
  }

  let receiptPath = null;
  if (receiptUrl) {
    try {
      const isValid = await validateUrl(receiptUrl);
      if (!isValid) {
        return json({ error: "Invalid or untrusted receipt URL" }, { status: 400 });
      }

      const response = await fetch(receiptUrl);
      if (!response.ok) throw new Error("Failed to fetch receipt");
      const buffer = Buffer.from(await response.arrayBuffer());

      const ext = receiptUrl.split(".").pop()?.split("?")[0] || "pdf";
      const filename = `receipt_${user.id}_${Date.now()}.${ext}`;
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "data", "receipts", filename);
      fs.writeFileSync(filePath, buffer);
      receiptPath = filename;
    } catch {
      return json({ error: "Could not fetch receipt from the provided URL" }, { status: 400 });
    }
  }

  const result = db
    .prepare(
      "INSERT INTO expenses (user_id, title, description, amount, category, receipt_path) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(user.id, title, description, amount, category, receiptPath);

  return redirect(`/expenses/${result.lastInsertRowid}`);
}

export default function NewExpense() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/expenses" className="text-sm text-indigo-600 hover:underline">
          &larr; Back to expenses
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-5 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Submit New Expense</h1>
          <p className="mt-1 text-sm text-gray-500">
            Fill in the details below to submit an expense for reimbursement.
          </p>
        </div>

        <Form method="post" className="px-6 py-5 space-y-5">
          {actionData?.error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
              {actionData.error}
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder="e.g., Flight to NYC"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Provide details about this expense..."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Supports basic HTML formatting for rich descriptions.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Amount ($)
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max="50000"
                required
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                id="category"
                name="category"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              >
                <option value="">Select a category</option>
                <option value="Travel">Travel</option>
                <option value="Meals">Meals</option>
                <option value="Equipment">Equipment</option>
                <option value="Training">Training</option>
                <option value="Software">Software</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="receipt_url" className="block text-sm font-medium text-gray-700">
              Receipt URL (optional)
            </label>
            <input
              id="receipt_url"
              name="receipt_url"
              type="url"
              placeholder="https://example.com/receipt.pdf"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Paste a direct link to your receipt and we'll import it automatically.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <Link
              to="/expenses"
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Submit Expense
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
