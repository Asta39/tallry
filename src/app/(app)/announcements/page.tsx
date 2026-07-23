import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { listAnnouncements } from "@/lib/announcements";
import { PageHeader } from "@/components/ui";
import { AnnouncementsClient } from "./AnnouncementsClient";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  await requirePerm("announcements");
  const access = await getAccess();
  const canPost = !!access?.isOwner || access?.role === "admin";
  const rows = await listAnnouncements();

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="In-house updates from your admin team."
      />
      <AnnouncementsClient
        canPost={canPost}
        rows={rows.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          pinned: r.pinned,
          createdByName: r.createdByName,
          createdAt: r.createdAt,
        }))}
      />
    </>
  );
}
