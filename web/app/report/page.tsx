import { Suspense } from "react";
import ReportClient from "./ReportClient";

export const metadata = { title: "Audit d'un serveur MCP" };

export default function Page() {
  return (
    <Suspense fallback={<div className="grid place-items-center py-28"><span className="loading loading-spinner loading-lg text-primary" /></div>}>
      <ReportClient />
    </Suspense>
  );
}
