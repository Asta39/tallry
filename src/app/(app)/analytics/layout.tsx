import { ModuleGuard } from "@/components/ModuleGuard";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="accounting">{children}</ModuleGuard>;
}
