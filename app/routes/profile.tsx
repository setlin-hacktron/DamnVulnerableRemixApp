import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { requireUser } from "~/auth.server";
import db from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const fullUser = db
    .prepare("SELECT id, email, name, role, department, created_at FROM users WHERE id = ?")
    .get(user.id) as any;
  return json({ user: fullUser });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const updates: Record<string, any> = {};

  const allowedFields = ["name", "email", "department"];
  for (const key of allowedFields) {
    const value = formData.get(key);
    if (value) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return json({ error: "No changes provided" }, { status: 400 });
  }

  const fields = Object.keys(updates);
  const setClause = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => updates[f]);

  db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...values, user.id);

  return json({ success: true, message: "Profile updated successfully" });
}

export default function Profile() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h1>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-lg font-bold">
              {user.name
                .split(" ")
                .map((n: string) => n[0])
                .join("")}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)} &middot; Member since{" "}
                {new Date(user.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        <Form method="post" className="px-6 py-5 space-y-5">
          {actionData?.error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
              {actionData.error}
            </div>
          )}
          {actionData?.success && (
            <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
              {actionData.message}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={user.name}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={user.email}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700">
              Department
            </label>
            <select
              id="department"
              name="department"
              defaultValue={user.department}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            >
              <option value="General">General</option>
              <option value="Engineering">Engineering</option>
              <option value="Marketing">Marketing</option>
              <option value="Finance">Finance</option>
              <option value="Sales">Sales</option>
              <option value="IT">IT</option>
            </select>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Save Changes
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
