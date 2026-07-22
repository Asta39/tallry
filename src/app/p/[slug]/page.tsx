import { cookies } from "next/headers";
import { getOrgBySlug, getPortalSession, getReceiptsForPhone } from "@/lib/portal";
import { getOrCreateReceiptToken } from "@/lib/receipts/tokens";
import { fmtKES } from "@/lib/money";
import { PortalAuth } from "./PortalAuth";
import { portalLogoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PortalPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const org = await getOrgBySlug(slug);

  if (!org) {
    return (
      <Shell>
        <div className="text-center py-12">
          <h1 className="text-lg font-semibold">Business not found</h1>
          <p className="text-sm text-gray-500 mt-1">Check the link and try again.</p>
        </div>
      </Shell>
    );
  }

  const jar = await cookies();
  const session = await getPortalSession(org.id, jar.get(`portal_${org.id}`)?.value);

  if (!session) {
    return (
      <Shell>
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">{org.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Your payment receipts</p>
        </div>
        <PortalAuth slug={slug} orgName={org.name} />
      </Shell>
    );
  }

  const rows = await getReceiptsForPhone(org.id, session.phone);
  const withTokens = await Promise.all(rows.map(async (r) => ({
    ...r,
    token: await getOrCreateReceiptToken(org.id, r.payment.id).catch(() => null),
  })));

  return (
    <Shell wide>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{org.name}</h1>
          <p className="text-sm text-gray-500">Receipts for {session.phone}</p>
        </div>
        <form action={portalLogoutAction.bind(null, slug)}>
          <button className="text-sm text-gray-500 hover:text-gray-900">Sign out</button>
        </form>
      </div>

      {withTokens.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-500">
          No receipts found for this number yet.
        </div>
      ) : (
        <div className="space-y-3">
          {withTokens.map(({ payment, doc, token }) => (
            <div key={payment.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div>
                <div className="font-medium tnum">{fmtKES(payment.amountCents)}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {payment.date}{doc ? ` · ${doc.number}` : ""} · {payment.number}
                </div>
              </div>
              {token ? (
                <a
                  href={`/r/${token}/pdf?download=1`}
                  className="shrink-0 px-4 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium"
                >
                  Download
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <div className="text-center text-[11px] text-gray-400 mt-8">
        Powered by Zeno · <a href="/privacy" className="hover:text-gray-600">Privacy</a> · <a href="/terms" className="hover:text-gray-600">Terms</a>
      </div>
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-10">
      <div className={`${wide ? "max-w-lg" : "max-w-sm"} mx-auto`}>{children}</div>
    </div>
  );
}
