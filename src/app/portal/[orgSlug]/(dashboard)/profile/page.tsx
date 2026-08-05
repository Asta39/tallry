import { getClientSession } from "@/lib/client-portal/auth";
import { db, contacts } from "@/db";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import Image from "next/image";
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
      <div className="flex items-center gap-4 mb-6">
        <Image src="/portal/illus-checkmark.png" alt="" width={56} height={56} className="select-none pointer-events-none shrink-0" />
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Profile</h1>
          <p className="text-[13px] text-[var(--color-ink-400)] mt-0.5">Keep your contact details up to date.</p>
        </div>
      </div>
      <ProfileForm slug={orgSlug} contact={contact} />
    </>
  );
}
