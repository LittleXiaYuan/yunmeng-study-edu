import { RoleGuard } from "@/components/portal/role-guard";
import type { ReactNode } from "react";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return <RoleGuard role="teacher">{children}</RoleGuard>;
}
