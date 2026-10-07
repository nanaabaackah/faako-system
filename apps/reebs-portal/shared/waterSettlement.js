// Framework-independent Water-only settlement projection. Money is integer pesewas.
// Legacy embedded facts are explicitly labelled, never converted into payments.
export const deriveWaterSettlement = (sale, applications = {}) => {
  const total = Number(sale.totalAmount || 0);
  const collectedCents = Number(applications.amountPaidCents || 0);
  const applicationCount = Number(applications.applicationCount || 0);
  const legacyPaid = applicationCount === 0 && String(sale.paymentStatus).toLowerCase() === "paid";
  const legacyPaidCents = legacyPaid ? total : 0;
  const amountPaidCents = legacyPaid ? legacyPaidCents : collectedCents;
  const balanceDueCents = Math.max(0, total - amountPaidCents);
  return {
    amountPaidCents, collectedCents, balanceDueCents, legacyPaidCents,
    legacyPaymentCompatibility: legacyPaid,
    applicationCount,
    paymentStatus: amountPaidCents >= total && total > 0 ? "paid"
      : amountPaidCents > 0 ? "partially_paid"
        : String(sale.paymentStatus).toLowerCase() === "pending" ? "pending" : "unpaid",
  };
};
