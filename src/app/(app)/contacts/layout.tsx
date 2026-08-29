import { ModuleGuard } from "@/components/ModuleGuard";

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="crm">{children}</ModuleGuard>;
}
