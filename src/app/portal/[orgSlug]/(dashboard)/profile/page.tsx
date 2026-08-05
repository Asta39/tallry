import { getClientSession } from "@/lib/client-portal/auth";
import { db, contacts } from "@/db";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ClientPortalProfile({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const session = await getClientSession(orgSlug);
  if (!session) redirect(`/portal/${orgSlug}/login`);

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, session.contactId), eq(contacts.orgId, session.orgId)))
    .limit(1);

  if (!contact) redirect(`/portal/${orgSlug}/login`);

  return (
    <>
      <PageHeader title="Profile" subtitle="Keep your contact details up to date." />
      <ProfileForm slug={orgSlug} contact={contact} />
    </>
  );
}
