import { Suspense, type ReactNode } from "react";
import { RoleGuard } from "@/components/portal/role-guard";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RoleGuard role="teacher">{children}</RoleGuard>
    </Suspense>
  );
}
