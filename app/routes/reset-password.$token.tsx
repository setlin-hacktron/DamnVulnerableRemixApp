import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useActionData, Link } from "@remix-run/react";
import { validateResetToken } from "~/auth.server";
import db from "~/db.server";
import bcrypt from "bcryptjs";

export async function loader({ params }: LoaderFunctionArgs) {
  const reset = validateResetToken(params.token!);
  if (!reset) {
    throw new Response("Invalid or expired reset token", { status: 400 });
  }
  return json({ email: reset.email });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const reset = validateResetToken(params.token!);
  if (!reset) {
    return json({ error: "Invalid or expired reset token" }, { status: 400 });
  }

  const formData = await request.formData();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!password || password.length < 6) {
    return json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return json({ error: "Passwords do not match" }, { status: 400 });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE email = ?").run(hash, reset.email);
  db.prepare("DELETE FROM password_resets WHERE email = ?").run(reset.email);

  return redirect("/login");
}

export default function ResetPassword() {
  const { email } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="flex min-h-full items-center justify-center py-12 px-4">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            ExpenseFlow
          </h1>
          <h2 className="mt-6 text-center text-xl font-semibold text-gray-900">
            Set new password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Enter a new password for {email}
          </p>
        </div>

        <Form method="post" className="mt-8 space-y-6">
          {actionData?.error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
              {actionData.error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Reset Password
          </button>

          <p className="text-center text-sm text-gray-500">
            <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
              Back to sign in
            </Link>
          </p>
        </Form>
      </div>
    </div>
  );
}
