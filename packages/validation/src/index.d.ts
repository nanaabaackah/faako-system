import type { z } from "zod";

export declare const domainIdSchema: z.ZodType<string | number>;
export declare const emailSchema: z.ZodType<string>;
export declare const optionalEmailSchema: z.ZodType<string | undefined>;
export declare const phoneSchema: z.ZodType<string>;
export declare const optionalPhoneSchema: z.ZodType<string | undefined>;
export declare const currencyCodeSchema: z.ZodType<string>;
export declare const isoDateSchema: z.ZodType<string>;
export declare const isoDateTimeSchema: z.ZodType<string>;
export declare const moneyAmountSchema: z.ZodType<number | string>;

export declare const loginInputSchema: z.ZodType<{
  email: string;
  password: string;
}>;

export declare const forgotPasswordInputSchema: z.ZodType<{
  email: string;
}>;

export declare const passwordResetInputSchema: z.ZodType<{
  token: string;
  password: string;
}>;

export declare const authenticationRegistrationInputSchema: z.ZodType<{
  name: string;
  email: string;
  password: string;
}>;

export declare const organisationFormSchema: z.ZodType<{
  name: string;
  slug?: string;
  primaryEmail?: string;
  phone?: string;
  status?: string;
  defaultCurrency?: string;
  parentId?: string | number | null;
}>;

export declare const customerFormSchema: z.ZodType<{
  name: string;
  email?: string;
  phone?: string;
  businessName?: string;
  preferredContactMethod?: "email" | "phone" | "whatsapp";
  defaultDeliveryAddress?: string;
  deliveryNotes?: string;
  status?: string;
}>;

export declare const usernameAccessFormSchema: z.ZodType<{
  username: string;
  password: string;
  roleKey: string;
}>;

export declare const roleFormSchema: z.ZodType<{
  name: string;
  key?: string;
  description?: string;
  modules?: string[];
  permissions?: Record<string, unknown>;
  isActive?: boolean;
}>;

export declare const productFormSchema: z.ZodType<{
  name: string;
  slug?: string;
  sku?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  categoryId?: string | number | null;
  categorySlug?: string | null;
  vendorId?: string | number | null;
  price?: number | string | null;
  compareAtPrice?: number | string | null;
  currency?: string;
  status?: string;
  tags?: string[];
}>;

export declare const inventoryAdjustmentSchema: z.ZodType<{
  inventoryItemId?: string | number;
  productId?: string | number;
  productSlug?: string;
  variantId?: string | number | null;
  movementType:
    | "RESTOCK"
    | "ADJUSTMENT"
    | "DAMAGE"
    | "MANUAL_CORRECTION"
    | "RESERVED"
    | "RELEASED";
  quantityDelta: number;
  quantityAfter?: number;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: string | number | null;
}>;

export declare const orderStatusTransitionSchema: z.ZodType<{
  orderId?: string | number;
  status: string;
  reason?: string | null;
}>;

export declare const bookingInputSchema: z.ZodType<{
  customerId?: string | number;
  attendeeName: string;
  attendeeEmail: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  durationMinutes?: number;
  location?: string;
  meetingLink?: string;
  honeypot?: string;
}>;

export declare const invoiceLineInputSchema: z.ZodType<{
  description: string;
  quantity: number | string;
  unitPrice: number | string;
}>;

export declare const invoiceInputSchema: z.ZodType<{
  organisationId?: string | number;
  customerId?: string | number;
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  issueDate: string;
  dueDate?: string;
  currency: string;
  lineItems: Array<{
    description: string;
    quantity: number | string;
    unitPrice: number | string;
  }>;
  taxRate?: number | string;
  discount?: number | string;
  notes?: string;
}>;

export declare const paymentInputSchema: z.ZodType<{
  orderId?: string | number;
  invoiceId?: string | number;
  customerId?: string | number;
  amount: number | string;
  currency: string;
  unit: "major" | "minor";
  method: string;
  provider?: string;
  reference?: string;
  paidAt?: string;
  notes?: string;
}>;

export declare const contactInputSchema: z.ZodType<{
  name: string;
  email?: string;
  phone?: string;
  businessName?: string;
  topic?: string;
  eventDate?: string;
  location?: string;
  message: string;
  productId?: string | number;
  productSlug?: string;
  source?: string;
  honeypot?: string;
}>;

export declare const newsletterInputSchema: z.ZodType<{
  email: string;
  name?: string;
  source?: string;
  consent: true;
  honeypot?: string;
}>;

export declare const eventRegistrationInputSchema: z.ZodType<{
  eventId: string | number;
  name: string;
  email: string;
  phone?: string;
  organisationName?: string;
  attendeeCount: number;
  accessibilityNeeds?: string;
  dietaryRequirements?: string;
  consent: true;
  honeypot?: string;
}>;

export declare const reebsBusinessScopeSchema: z.ZodType<"reebs-core" | "water" | "consolidated" | "shared">;
export declare const reebsPaginationQuerySchema: z.ZodType<{
  page: number;
  pageSize: number;
  search?: string;
  sort?: string;
  direction?: "asc" | "desc";
}>;
export declare const reebsLoginInputSchema: z.ZodType<{
  email: string;
  password: string;
  remember?: boolean;
}>;
export declare const reebsPublicCustomerInputSchema: z.ZodType<{
  name: string;
  email?: string;
  phone?: string;
}>;
export declare const reebsBookingLineInputSchema: z.ZodType<{
  productId: string | number;
  variantId?: string | number | null;
  quantity: number;
}>;
export declare const reebsBookingCreateInputSchema: z.ZodType<{
  customerId: string | number;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venueAddress?: string | null;
  items: Array<{ productId: string | number; variantId?: string | number | null; quantity: number }>;
  paymentPreference?: string | Record<string, unknown> | null;
  applyBundleDiscount?: boolean;
  discount?: number;
  status?: string;
  source?: string;
}>;
export declare const reebsPaymentInitializationSchema: z.ZodType<{
  orderReference: string;
  idempotencyKey: string;
  currency?: string;
}>;
export declare const waterBusinessScopeSchema: z.ZodType<"water">;

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

export declare const validationIssues: (error: z.ZodError) => ValidationIssue[];

export type LoginInput = z.infer<typeof loginInputSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetInputSchema>;
export type AuthenticationRegistrationInput = z.infer<
  typeof authenticationRegistrationInputSchema
>;
export type OrganisationFormInput = z.infer<typeof organisationFormSchema>;
export type CustomerFormInput = z.infer<typeof customerFormSchema>;
export type UsernameAccessFormInput = z.infer<
  typeof usernameAccessFormSchema
>;
export type RoleFormInput = z.infer<typeof roleFormSchema>;
export type ProductFormInput = z.infer<typeof productFormSchema>;
export type InventoryAdjustmentInput = z.infer<
  typeof inventoryAdjustmentSchema
>;
export type OrderStatusTransitionInput = z.infer<
  typeof orderStatusTransitionSchema
>;
export type BookingInput = z.infer<typeof bookingInputSchema>;
export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>;
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;
export type NewsletterInput = z.infer<typeof newsletterInputSchema>;
export type EventRegistrationInput = z.infer<
  typeof eventRegistrationInputSchema
>;
