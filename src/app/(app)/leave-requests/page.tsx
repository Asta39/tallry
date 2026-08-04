import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { myLeaveRequests, pendingLeaveRequests, reviewedLeaveRequests } from "@/lib/leave-requests";
import { canReviewLeaveRequests } from "@/lib/leave-permissions";
import { getOrg } from "@/lib/org";
import { PageHeader } from "@/components/ui";
import { LeaveRequestsClient } from "./LeaveRequestsClient";

export const dynamic = "force-dynamic";

export default async function LeaveRequestsPage() {
  await requirePerm("leave_requests");
  const access = await getAccess();
  const canReview = canReviewLeaveRequests(access);
  const o = await getOrg();

  const [mine, pending, reviewed] = await Promise.all([
    myLeaveRequests(),
    canReview ? pendingLeaveRequests() : Promise.resolve([]),
    canReview ? reviewedLeaveRequests() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Leave Requests" subtitle="Submit a leave request, or review your team's." />
      <LeaveRequestsClient
        orgId={o.id}
        memberId={access?.memberId ?? null}
        mine={mine}
        canReview={canReview}
        pending={pending}
        reviewed={reviewed}
      />
    </>
  );
}
