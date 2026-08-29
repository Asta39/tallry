import { ModuleGuard } from "@/components/ModuleGuard";

export default function AccountantLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="accounting">{children}</ModuleGuard>;
}
