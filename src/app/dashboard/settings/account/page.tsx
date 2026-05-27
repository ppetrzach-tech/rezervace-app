import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AccountForm } from "./AccountForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Účet</h2>
        <p className="text-slate-600 text-sm">
          Vaše osobní údaje a změna hesla.
        </p>
      </div>
      <AccountForm
        initial={{
          email: session.user.email ?? "",
          name: session.user.name ?? "",
        }}
      />
    </div>
  );
}
