const GATEWAY_NAMES: Record<string, string> = { mpesa_daraja: "M-Pesa Daraja", kopokopo: "Kopo Kopo" };

/** Appends "(via Kopo Kopo)" etc. to an M-Pesa till's display name when the
 *  org has flagged that a different gateway actually settles it (see
 *  org.mpesaTillGatewayId) — leaves every other account name untouched. */
export function bankAccountLabel(
  bank: { name: string; kind: string },
  mpesaTillGatewayId: string | null | undefined
): string {
  if (bank.kind !== "mpesa" || !mpesaTillGatewayId || mpesaTillGatewayId === "mpesa_daraja") return bank.name;
  return `${bank.name} (via ${GATEWAY_NAMES[mpesaTillGatewayId] || mpesaTillGatewayId})`;
}
