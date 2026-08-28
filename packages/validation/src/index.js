import { z } from "zod";

const EMAIL_MAX_LENGTH = 254;
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{6,24}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_PATTERN = /^\d+(?:\.\d{1,4})?$/;

const requiredText = (maxLength, minLength = 1) =>
  z.string().trim().min(minLength).max(maxLength);

const optionalText = (maxLength) =>
  z.union([z.string().trim().max(maxLength), z.literal("")]).optional();

const nullableOptionalText = (maxLength) =>
  z
    .union([z.string().trim().max(maxLength), z.literal(""), z.null()])
    .optional();

export const domainIdSchema = z.union([
  z.string().trim().min(1).max(160),
  z.number().int().nonnegative(),
]);

export const emailSchema = z.string().min(1).max(EMAIL_MAX_LENGTH).email();

export const optionalEmailSchema = z
  .union([z.string().trim().max(EMAIL_MAX_LENGTH).email(), z.literal("")])
  .optional();

export const phoneSchema = z
  .string()
  .trim()
  .max(25)
  .regex(PHONE_PATTERN, "Enter a valid phone number.")
  .refine(
    (value) => /^\d{7,15}$/.test(value.replace(/\D/g, "")),
    "Enter a valid phone number.",
  );

export const optionalPhoneSchema = z
  .union([phoneSchema, z.literal("")])
  .optional();

export const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Za-z]{3}$/)
  .transform((value) => value.toUpperCase());

export const isoDateSchema = z
  .string()
  .regex(DATE_PATTERN, "Use a YYYY-MM-DD date.");

export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const moneyAmountSchema = z.union([
  z.number().finite().nonnegative(),
  z.string().trim().regex(DECIMAL_PATTERN, "Enter a valid non-negative amount."),
]);

export const loginInputSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(1024),
  })
  .strip();

export const forgotPasswordInputSchema = z
  .object({
    email: emailSchema,
  })
  .strip();

export const passwordResetInputSchema = z
  .object({
    token: z.string().min(1).max(2048),
    password: z.string().min(8).max(1024),
  })
  .strip();

export const authenticationRegistrationInputSchema = z
  .object({
    name: requiredText(200, 2),
    email: emailSchema,
    password: z.string().min(8).max(1024),
  })
  .strip();

export const organisationFormSchema = z
  .object({
    name: requiredText(200),
    slug: z
      .union([
        z.string().trim().toLowerCase().max(160).regex(SLUG_PATTERN),
        z.literal(""),
      ])
      .optional(),
    primaryEmail: optionalEmailSchema,
    phone: optionalPhoneSchema,
    status: optionalText(80),
    defaultCurrency: currencyCodeSchema.optional(),
    parentId: domainIdSchema.nullable().optional(),
  })
  .strip();

export const customerFormSchema = z
  .object({
    name: requiredText(200, 2),
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
    businessName: optionalText(200),
    preferredContactMethod: z
      .enum(["email", "phone", "whatsapp"])
      .optional(),
    defaultDeliveryAddress: optionalText(500),
    deliveryNotes: optionalText(1200),
    status: optionalText(80),
  })
  .strip()
  .superRefine((value, context) => {
    if (value.email || value.phone) return;
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["email"],
      message: "Enter an email address or phone number.",
    });
  });

/**
 * Compatibility schema for operational directories that historically allow a
 * name-only customer. Account and checkout forms should use customerFormSchema.
 */
export const customerMasterDataFormSchema = z
  .object({
    name: requiredText(200),
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
    businessName: optionalText(200),
    preferredContactMethod: z.enum(["email", "phone", "whatsapp"]).optional(),
    defaultDeliveryAddress: optionalText(500),
    deliveryNotes: optionalText(1200),
    status: optionalText(80),
  })
  .strip();

export const userAccessFormSchema = z
  .object({
    firstName: requiredText(120),
    lastName: requiredText(120),
    email: optionalEmailSchema,
    password: nullableOptionalText(1024),
    roleId: domainIdSchema.nullable().optional(),
    role: optionalText(80),
    roleKey: optionalText(80),
    status: z
      .enum(["ACTIVE", "SUSPENDED", "PENDING", "INACTIVE", "DISABLED"])
      .optional(),
  })
  .strip();

/** Username-based staff accounts used by the Stroane operations portal. */
export const usernameAccessFormSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(50)
      .regex(
        /^[a-z0-9._-]+$/,
        "Username can only use letters, numbers, dots, underscores, and hyphens.",
      ),
    password: z.string().min(8).max(100),
    roleKey: requiredText(80),
  })
  .strip();

export const roleFormSchema = z
  .object({
    name: requiredText(80),
    key: z
      .union([
        z.string().trim().toLowerCase().max(80).regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/),
        z.literal(""),
      ])
      .optional(),
    description: optionalText(240),
    modules: z.array(requiredText(120)).max(100).optional(),
    permissions: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().optional(),
  })
  .strip();

export const roleAssignmentInputSchema = z
  .object({
    userId: domainIdSchema,
    roleId: domainIdSchema.nullable().optional(),
    roleKey: optionalText(80),
  })
  .strip()
  .superRefine((value, context) => {
    if (value.roleId !== undefined && value.roleId !== null) return;
    if (value.roleKey) return;
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["roleId"],
      message: "Choose a role assignment.",
    });
  });

export const vendorFormSchema = z
  .object({
    name: requiredText(200),
    contactName: nullableOptionalText(200),
    email: z
      .union([z.string().trim().max(EMAIL_MAX_LENGTH).email(), z.literal(""), z.null()])
      .optional(),
    phone: nullableOptionalText(80),
    mobileMoneyNumber: nullableOptionalText(80),
    address: nullableOptionalText(500),
    bankName: nullableOptionalText(160),
    bankAccount: nullableOptionalText(160),
    leadTimeDays: z
      .union([
        z.number().int().nonnegative(),
        z.string().trim().regex(/^\d+$/, "Lead time must be zero or more whole days."),
        z.literal(""),
        z.null(),
      ])
      .optional(),
    suppliedItems: z.array(requiredText(200)).max(500).optional(),
    notes: nullableOptionalText(2000),
    status: optionalText(80),
  })
  .strip();

export const productFormSchema = z
  .object({
    name: requiredText(180),
    slug: z
      .union([
        z.string().trim().toLowerCase().max(180).regex(SLUG_PATTERN),
        z.literal(""),
      ])
      .optional(),
    sku: nullableOptionalText(120),
    shortDescription: nullableOptionalText(320),
    longDescription: nullableOptionalText(2400),
    categoryId: domainIdSchema.nullable().optional(),
    categorySlug: nullableOptionalText(160),
    vendorId: domainIdSchema.nullable().optional(),
    price: moneyAmountSchema.nullable().optional(),
    compareAtPrice: moneyAmountSchema.nullable().optional(),
    currency: currencyCodeSchema.optional(),
    status: optionalText(80),
    tags: z.array(requiredText(80)).max(20).optional(),
  })
  .strip();

export const inventoryAdjustmentSchema = z
  .object({
    inventoryItemId: domainIdSchema.optional(),
    productId: domainIdSchema.optional(),
    productSlug: optionalText(160),
    variantId: domainIdSchema.nullable().optional(),
    movementType: z.enum([
      "RESTOCK",
      "ADJUSTMENT",
      "DAMAGE",
      "MANUAL_CORRECTION",
      "RESERVED",
      "RELEASED",
    ]),
    quantityDelta: z.number().int(),
    quantityAfter: z.number().int().nonnegative().optional(),
    reason: nullableOptionalText(400),
    referenceType: nullableOptionalText(80),
    referenceId: domainIdSchema.nullable().optional(),
  })
  .strip()
  .superRefine((value, context) => {
    if (value.inventoryItemId !== undefined || value.productId !== undefined || value.productSlug) {
      return;
    }
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["inventoryItemId"],
      message: "Identify the inventory item or product.",
    });
  });

const ORDER_STATUS_VALUES = [
  "pending",
  "payment_pending",
  "paid",
  "processing",
  "fulfilled",
  "completed",
  "cancelled",
  "canceled",
];

const BOOKING_STATUS_VALUES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "canceled",
  "no_show",
];

const DELIVERY_STATUS_VALUES = [
  "pending",
  "scheduled",
  "loaded",
  "en_route",
  "delivered",
  "pickup",
  "issue",
  "cancelled",
  "canceled",
];

const statusTransitionSchema = (allowedValues) =>
  z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine(
      (value) => allowedValues.includes(value.toLowerCase()),
      "Choose a supported status.",
    );

export const orderLineInputSchema = z
  .object({
    productId: domainIdSchema.optional(),
    productSlug: optionalText(180),
    variantId: domainIdSchema.nullable().optional(),
    quantity: z.number().int().positive().max(100000),
    price: moneyAmountSchema.optional(),
    unitPrice: moneyAmountSchema.optional(),
  })
  .strip()
  .superRefine((value, context) => {
    if (value.productId === undefined && !value.productSlug) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productId"],
        message: "Identify the product.",
      });
    }
    if (value.price === undefined && value.unitPrice === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Provide the order-line price.",
      });
    }
  });

export const orderCreateInputSchema = z
  .object({
    customerId: domainIdSchema,
    status: statusTransitionSchema(ORDER_STATUS_VALUES).optional(),
    source: optionalText(120),
    purchaseChannel: optionalText(80),
    fulfillmentMethod: optionalText(80),
    deliveryMethod: z.enum(["pickup", "delivery"]).optional(),
    deliveryRequired: z.boolean().optional(),
    type: optionalText(80),
    items: z.array(orderLineInputSchema).min(1).max(500),
    discount: moneyAmountSchema.optional(),
  })
  .strip();

export const orderStatusTransitionSchema = z
  .object({
    orderId: domainIdSchema.optional(),
    status: statusTransitionSchema(ORDER_STATUS_VALUES),
    reason: nullableOptionalText(500),
  })
  .strip();

export const bookingStatusTransitionSchema = z
  .object({
    bookingId: domainIdSchema.optional(),
    status: statusTransitionSchema(BOOKING_STATUS_VALUES),
    reason: nullableOptionalText(500),
  })
  .strip();

export const deliveryUpdateSchema = z
  .object({
    deliveryId: domainIdSchema.optional(),
    status: statusTransitionSchema(DELIVERY_STATUS_VALUES),
    driverId: domainIdSchema.nullable().optional(),
    vehicleId: domainIdSchema.nullable().optional(),
    scheduledAt: z.union([isoDateTimeSchema, z.literal("")]).optional(),
    deliveredAt: z.union([isoDateTimeSchema, z.literal("")]).optional(),
    notes: nullableOptionalText(2000),
  })
  .strip();

export const bookingInputSchema = z
  .object({
    customerId: domainIdSchema.optional(),
    attendeeName: requiredText(200),
    attendeeEmail: emailSchema,
    title: requiredText(300),
    description: optionalText(2000),
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema.optional(),
    durationMinutes: z.number().int().positive().max(1440).optional(),
    location: optionalText(500),
    meetingLink: z
      .union([z.string().url().max(2000), z.literal("")])
      .optional(),
    honeypot: optionalText(200),
  })
  .strip()
  .superRefine((value, context) => {
    if (!value.endAt && !value.durationMinutes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "Provide an end time or duration.",
      });
    }
    if (value.endAt && Date.parse(value.endAt) <= Date.parse(value.startAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "End time must be after start time.",
      });
    }
  });

export const invoiceLineInputSchema = z
  .object({
    description: requiredText(500),
    quantity: moneyAmountSchema,
    unitPrice: moneyAmountSchema,
  })
  .strip();

export const invoiceInputSchema = z
  .object({
    organisationId: domainIdSchema.optional(),
    customerId: domainIdSchema.optional(),
    invoiceNumber: requiredText(120),
    clientName: requiredText(200),
    clientEmail: optionalEmailSchema,
    clientAddress: optionalText(1000),
    issueDate: isoDateSchema,
    dueDate: z.union([isoDateSchema, z.literal("")]).optional(),
    currency: currencyCodeSchema,
    lineItems: z.array(invoiceLineInputSchema).min(1).max(200),
    taxRate: moneyAmountSchema.optional(),
    discount: moneyAmountSchema.optional(),
    notes: optionalText(4000),
  })
  .strip()
  .superRefine((value, context) => {
    if (value.dueDate && value.dueDate < value.issueDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "Due date cannot be before issue date.",
      });
    }
  });

export const paymentInputSchema = z
  .object({
    orderId: domainIdSchema.optional(),
    invoiceId: domainIdSchema.optional(),
    customerId: domainIdSchema.optional(),
    amount: moneyAmountSchema,
    currency: currencyCodeSchema,
    unit: z.enum(["major", "minor"]),
    method: requiredText(80),
    provider: optionalText(80),
    reference: optionalText(160),
    paidAt: isoDateTimeSchema.optional(),
    notes: optionalText(1000),
  })
  .strip();

export const contactInputSchema = z
  .object({
    name: requiredText(200, 2),
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
    businessName: optionalText(200),
    topic: optionalText(160),
    eventDate: z.union([isoDateSchema, z.literal("")]).optional(),
    location: optionalText(500),
    message: requiredText(4000),
    productId: domainIdSchema.optional(),
    productSlug: optionalText(180),
    source: optionalText(120),
    honeypot: optionalText(200),
  })
  .strip()
  .superRefine((value, context) => {
    if (value.email || value.phone) return;
    const message = "Enter an email address or phone number.";
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["email"],
      message,
    });
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["phone"],
      message,
    });
  });

export const newsletterInputSchema = z
  .object({
    email: emailSchema,
    name: optionalText(200),
    source: optionalText(120),
    consent: z.literal(true),
    honeypot: optionalText(200),
  })
  .strip();

export const eventRegistrationInputSchema = z
  .object({
    eventId: domainIdSchema,
    name: requiredText(200, 2),
    email: emailSchema,
    phone: optionalPhoneSchema,
    organisationName: optionalText(200),
    attendeeCount: z.number().int().min(1).max(20).default(1),
    accessibilityNeeds: optionalText(1000),
    dietaryRequirements: optionalText(1000),
    consent: z.literal(true),
    honeypot: optionalText(200),
  })
  .strip();

export const reebsBusinessScopeSchema = z
  .enum(["reebs-core", "water", "consolidated", "shared"])
  .default("reebs-core");

export const reebsPaginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: optionalText(200),
    sort: optionalText(80),
    direction: z.enum(["asc", "desc"]).optional(),
  })
  .strip();

/** REEBS permits email addresses and legacy username-only operational accounts. */
export const reebsLoginInputSchema = z
  .object({
    email: requiredText(254),
    password: z.string().min(1).max(1024),
    remember: z.boolean().optional(),
  })
  .strip();

export const reebsPublicCustomerInputSchema = z
  .object({
    name: requiredText(200, 2),
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
  })
  .strip()
  .superRefine((value, context) => {
    if (value.email || value.phone) return;
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["email"],
      message: "Enter an email address or phone number.",
    });
  });

export const reebsBookingLineInputSchema = z
  .object({
    productId: domainIdSchema,
    variantId: domainIdSchema.nullable().optional(),
    quantity: z.coerce.number().int().min(1).max(100),
  })
  .strip();

export const reebsBookingCreateInputSchema = z
  .object({
    customerId: domainIdSchema,
    eventDate: isoDateSchema,
    startTime: nullableOptionalText(80),
    endTime: nullableOptionalText(80),
    venueAddress: nullableOptionalText(240),
    items: z.array(reebsBookingLineInputSchema).min(1).max(100),
    paymentPreference: z.union([z.string().max(80), z.record(z.string(), z.unknown()), z.null()]).optional(),
    applyBundleDiscount: z.boolean().optional(),
    discount: z.number().finite().nonnegative().optional(),
    status: optionalText(80),
    source: optionalText(80),
  })
  .strip();

/** Amount is deliberately omitted: the server derives payable totals from the order. */
export const reebsPaymentInitializationSchema = z
  .object({
    orderReference: requiredText(160),
    idempotencyKey: requiredText(160),
    currency: currencyCodeSchema.optional(),
  })
  .strict();

export const waterBusinessScopeSchema = z.literal("water");

export const validationIssues = (error) =>
  error.issues.map((issue) => ({
    field: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
