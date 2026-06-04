import { Suspense } from "react";
import ReportClient from "./ReportClient";
import { getUser } from "../../lib/auth";
import { planOf } from "../../lib/plans";

export const metadata = { title: "Audit an MCP server", alternates: { canonical: "/report" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getUser();
  const plan = planOf(user?.plan);
  return (
    <Suspense fallback={<div className="grid place-items-center py-28"><span className="loading loading-spinner loading-lg text-primary" /></div>}>
      <ReportClient canPrivate={plan.privateAudits} signedIn={!!user} canEval={plan.privateAudits} />
    </Suspense>
  );
}
