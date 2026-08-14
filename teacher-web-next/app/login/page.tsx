import { Suspense } from "react";
import { LoginScreen } from "@/components/portal/login-screen";
import type { ReactNode } from "react";

export default function LoginPage(): ReactNode {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
