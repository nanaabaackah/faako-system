/**
 * Returns true when the draft contains any user-entered state worth persisting.
 * Used to decide whether to write or clear the localStorage draft key.
 */
export function computeHasDraft(draft) {
  return (
    (draft.orderItems?.length > 0) ||
    Boolean((draft.customerName || "").trim()) ||
    Boolean((draft.customerContact || "").trim()) ||
    Boolean(draft.selectedCustomer?.id) ||
    (draft.paymentMethod || "cash") !== "cash" ||
    (draft.discountType || "amount") !== "amount" ||
    Boolean((draft.momoReference || "").trim()) ||
    Boolean((draft.discountValue || "").trim()) ||
    Boolean((draft.cashReceived || "").trim())
  );
}
