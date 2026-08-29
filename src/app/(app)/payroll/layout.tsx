import { ModuleGuard } from "@/components/ModuleGuard";

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="payroll">{children}</ModuleGuard>;
}
