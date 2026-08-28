export type ReebsBusinessScope = "reebs-core" | "water" | "consolidated" | "shared";
export type ReebsBusinessUnit = "REEBS_CORE" | "WATER" | "CONSOLIDATED" | "SHARED";
export type ReebsApiAudience = "public" | "customer" | "admin" | "system" | "webhook";

export interface ReebsScopedResponse {
  scope: ReebsBusinessScope;
  businessUnit: ReebsBusinessUnit;
}

export interface ReebsPaginationQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  direction?: "asc" | "desc";
}

export interface ReebsPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ReebsSessionUserDto {
  id: string | number;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  personalEmail?: string | null;
  role?: string | null;
  organizationId?: string | number | null;
}

export interface ReebsPublicProductDto {
  id: string | number;
  name: string;
  slug?: string | null;
  sku?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  price?: number | string | null;
  currency?: string;
  stock?: number;
  images?: unknown[];
  variants?: unknown[];
  rentalPrice?: number | string | null;
  rentalPeriod?: string | null;
  securityDeposit?: number | string | null;
}

export interface ReebsCustomerSelfDto {
  id: string | number;
  name: string;
  email?: string | null;
  phone?: string | null;
  businessName?: string | null;
  preferredContactMethod?: "email" | "phone" | "whatsapp" | null;
  defaultDeliveryAddress?: string | null;
  deliveryNotes?: string | null;
}

export interface ReebsAdminCustomerDto extends ReebsCustomerSelfDto {
  status?: string | null;
  segmentOverride?: string | null;
  organizationId?: string | number | null;
}

export interface ReebsBookingLineInput {
  productId: string | number;
  variantId?: string | number | null;
  quantity: number;
}

export interface ReebsBookingCreateInput {
  customerId: string | number;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venueAddress?: string | null;
  items: ReebsBookingLineInput[];
  paymentPreference?: string | null;
  applyBundleDiscount?: boolean;
}

export interface ReebsBookingSummaryDto {
  id: string | number;
  customerId: string | number;
  eventDate: string;
  status: string;
  totalAmount?: number | string;
}

export interface ReebsRentalPeriodDto {
  startDate: string;
  endDate: string;
  reservedQuantity: number;
  returnedQuantity?: number;
  status: string;
}

export interface ReebsOrderSummaryDto {
  id: string | number;
  orderNumber?: string;
  customerId: string | number;
  status: string;
  subtotalCents: number;
  totalCents: number;
  currency: string;
}

export interface ReebsInventoryAvailabilityDto {
  productId: string | number;
  available: number;
  reserved: number;
  inUse: number;
  maintenance: number;
  damaged: number;
  unavailable: number;
}

export interface ReebsInventoryAdjustmentInput {
  productId: string | number;
  variantId?: string | number | null;
  quantityDelta: number;
  operation: string;
  reason: string;
}

export interface ReebsAddressDto {
  line1: string;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ReebsDeliveryDto {
  id: string | number;
  linkedResourceType: "booking" | "order";
  linkedResourceId: string | number;
  address: ReebsAddressDto;
  status: string;
  scheduledAt?: string | null;
}

export interface ReebsInvoiceSummaryDto {
  id: string | number;
  invoiceNumber: string;
  subtotalCents: number;
  taxCents: number;
  feesCents: number;
  discountCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceCents: number;
  currency: string;
  status: string;
}

export interface ReebsExpenseSummaryDto {
  id: string | number;
  category: string;
  amountCents: number;
  currency: string;
  date: string;
  status?: string;
}

export interface ReebsAccountingJournalSummaryDto {
  id: string | number;
  reference: string;
  date: string;
  status: string;
  debitTotalCents: number;
  creditTotalCents: number;
  currency: string;
}

export interface ReebsPaymentInitializationInput {
  orderReference: string;
  idempotencyKey: string;
  currency?: string;
}

export interface ReebsPaymentInitializationDto {
  reference: string;
  authorizationUrl?: string;
  status: string;
}

export interface ReebsPublicCommercialTermsDto extends ReebsScopedResponse {
  scope: "reebs-core";
  businessUnit: "REEBS_CORE";
  currency: string;
  effectiveAt: string;
  booking: {
    bundleMinimumItems: number;
    bundleDiscountBps: number;
    attendantUnitFeeCents: number;
  };
  paymentTerms: {
    serviceDepositBps: number;
    serviceDepositDueDays: number;
  };
  configurationIds: {
    bundleMinimumItems: number;
    bundleDiscount: number;
    attendantFee: number;
    serviceDeposit: number;
    serviceDepositDue: number;
  };
}

export interface WaterProductDto {
  key: string;
  name: string;
  inventoryProductId?: string | number | null;
  linkedVendorIds?: Array<string | number>;
  purchaseCost?: number;
  pricing: {
    currency: string | null;
    retailSingle: number | null;
    retailBulk: number | null;
    company: number | null;
    bulkThreshold: number | null;
    discountLimitBps?: number | null;
    effectiveRecords?: Record<string, unknown> | null;
    configurationError?: string | null;
    configurationErrorCode?: string | null;
  };
}

export type ReebsPortalTheme = "system" | "light" | "dark";
export type ReebsPortalFontSize = "compact" | "default" | "large";

export interface ReebsPortalPreferencesDto {
  theme: ReebsPortalTheme;
  fontSize: ReebsPortalFontSize;
}

export interface ReebsDocumentIdentityDto {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
}

export interface ReebsPortalSettingsDto {
  preferences: ReebsPortalPreferencesDto;
  documentIdentity: ReebsDocumentIdentityDto;
  capabilities: {
    canManageDocumentIdentity: boolean;
  };
}

export interface WaterCustomerDto {
  id: string | number;
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface WaterOrderLineDto {
  productKey: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface WaterOrderDto {
  id: string | number;
  customerId?: string | number | null;
  customerName?: string | null;
  status: string;
  paymentStatus: string;
  lines: WaterOrderLineDto[];
  totalAmount: number;
}

export interface WaterInventoryDto {
  productKey: string;
  stockOnHand: number;
  unitsRestocked: number;
  unitsSold: number;
  adjustmentUnits: number;
}

export interface WaterPaymentDto {
  paymentReference: string;
  providerReference?: string | null;
  method: string;
  status: string;
  amount: number;
  paidAt?: string | null;
}

export interface WaterFinancialSummaryDto {
  revenue: number;
  restockSpend: number;
  extraExpenses: number;
  costOfGoodsSold: number;
  grossProfit: number;
  netProfit: number;
  cashCollected: number;
  outstandingCredit: number;
  cashPosition: number;
  inventoryValue: number;
  currentUnitCost: number;
}

export interface WaterDashboardDto extends ReebsScopedResponse {
  scope: "water";
  businessUnit: "WATER";
  product: WaterProductDto;
  summary: WaterFinancialSummaryDto;
  restocks: unknown[];
  sales: unknown[];
  expenses: unknown[];
  adjustments: unknown[];
}

export interface ReebsCoreAnalyticsDto extends ReebsScopedResponse {
  scope: "reebs-core";
  businessUnit: "REEBS_CORE";
  generatedAt: string;
  organizationId: string | number;
}

export interface ReebsFinancialComponentDto extends ReebsScopedResponse {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
}

export interface ReebsConsolidatedAnalyticsDto extends ReebsScopedResponse {
  scope: "consolidated";
  businessUnit: "CONSOLIDATED";
  components: {
    reebsCore: ReebsFinancialComponentDto & {
      scope: "reebs-core";
      businessUnit: "REEBS_CORE";
    };
    water: ReebsFinancialComponentDto & {
      scope: "water";
      businessUnit: "WATER";
    };
    shared: ReebsFinancialComponentDto & {
      scope: "shared";
      businessUnit: "SHARED";
      allocationApplied?: boolean;
    };
  };
  summary: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
  };
}
