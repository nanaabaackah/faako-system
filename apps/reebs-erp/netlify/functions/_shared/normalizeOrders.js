export const normalizeOrdersToPickup = async (client, organizationId = null) => {
  const whereParts = [
    `("deliveryMethod" IS NULL OR "deliveryMethod" NOT ILIKE '%pickup%')`,
  ];
  const params = [];
  if (organizationId) {
    params.push(organizationId);
    whereParts.push(`"organizationId" = $${params.length}`);
  }
  const where = whereParts.join(" AND ");

  await client.query(
    `UPDATE "order"
     SET "deliveryMethod" = 'pickup',
         "pickupDetails" = COALESCE("pickupDetails", "deliveryDetails"),
         "deliveryDetails" = NULL
     WHERE ${where}`,
    params
  );
};
