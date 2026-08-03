export function buildBalanceAdjustmentLines(params: {
  accountId: number;
  accountType: string;
  offsetAccountId: number;
  deltaCents: number;
}) {
  const debitNature = params.accountType === "asset" || params.accountType === "expense";
  const amount = Math.abs(params.deltaCents);
  const targetLine = params.deltaCents > 0
    ? (debitNature
        ? { accountId: params.accountId, debitCents: amount, creditCents: 0 }
        : { accountId: params.accountId, debitCents: 0, creditCents: amount })
    : (debitNature
        ? { accountId: params.accountId, debitCents: 0, creditCents: amount }
        : { accountId: params.accountId, debitCents: amount, creditCents: 0 });
  const offsetLine = {
    accountId: params.offsetAccountId,
    debitCents: targetLine.creditCents,
    creditCents: targetLine.debitCents,
  };
  return [targetLine, offsetLine];
}
