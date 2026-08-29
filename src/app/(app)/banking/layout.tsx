import { ModuleGuard } from "@/components/ModuleGuard";

export default function BankingLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="accounting">{children}</ModuleGuard>;
}
