import { Suspense, type ReactNode } from "react";
import { RoleGuard } from "@/components/portal/role-guard";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RoleGuard role="student">{children}</RoleGuard>
    </Suspense>
  );
}
