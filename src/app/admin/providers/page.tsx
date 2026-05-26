import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const weekdayNames = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

export default async function ProvidersAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/admin/login");

  const providers = await prisma.provider.findMany({
    include: {
      workingHours: { orderBy: { weekday: "asc" } },
      services: { include: { service: true } },
    },
    orderBy: { name: "asc" },
  });

  function formatMin(min: number): string {
    const h = Math.floor(min / 60).toString().padStart(2, "0");
    const m = (min % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Osoby</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((p) => (
          <div key={p.id} className="card">
            <h2 className="text-lg font-semibold">{p.name}</h2>
            {p.bio && <p className="text-sm text-slate-600 mt-1">{p.bio}</p>}
            <div className="mt-3 text-sm">
              <div className="text-slate-500">Kontakt</div>
              <div>{p.email}</div>
              <div>{p.phone}</div>
            </div>
            <div className="mt-3 text-sm">
              <div className="text-slate-500">Pracovní doba</div>
              {p.workingHours.length === 0 ? (
                <div className="text-slate-400">Nenastavena.</div>
              ) : (
                <ul>
                  {p.workingHours.map((w) => (
                    <li key={w.id}>
                      {weekdayNames[w.weekday]}: {formatMin(w.startMin)}–{formatMin(w.endMin)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-3 text-sm">
              <div className="text-slate-500">Nabízí</div>
              <div>{p.services.map((sp) => sp.service.name).join(", ") || "—"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
