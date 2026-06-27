import crypto from "node:crypto";
import { Router } from "express";
import { asyncRoute, createHttpError } from "../apiResponse.js";
import { requireAdminRole, requireSiteUser } from "../adminAuth.js";
import {
  clearCustomerAuthCookie,
  getCustomerAuthCookieToken,
  hashPassword,
  safeVerifyPassword,
  setCustomerAuthCookie,
  signToken,
  verifyToken,
} from "../auth.js";
import { sendCustomerPasswordResetEmail } from "../customerAccountNotifications.js";
import { toPublicCommerceOrder } from "../orders.js";

const CUSTOMER_TOKEN_AUDIENCE = "stroane_customer";
const CUSTOMER_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const CUSTOMER_PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 100;
const CUSTOMER_SELECT = {
  id: true,
  email: true,
  status: true,
  name: true,
  phone: true,
  businessName: true,
  preferredContactMethod: true,
  defaultDeliveryAddress: true,
  deliveryNotes: true,
  invitedAt: true,
  inviteExpiresAt: true,
  activatedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

const sanitizeText = (value = "", maxLength = 160) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const normalizeEmail = (value = "") => {
  const email = sanitizeText(value, 180).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
};

const getPrismaUniqueFields = (error) => {
  const target = error?.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return [];
};

const isUniqueFieldError = (error, field) =>
  error?.code === "P2002" && getPrismaUniqueFields(error).includes(field);

const createDuplicateCustomerEmailError = () =>
  createHttpError("An account already exists for this email. Please sign in.", 409);

const normalizePhone = (value = "") => {
  const phone = sanitizeText(value, 60);
  if (!phone) return "";
  if (!/^\+?[0-9][0-9\s().-]{6,24}$/.test(phone)) return "";
  const digits = phone.replace(/\D/g, "");
  return /^\d{7,15}$/.test(digits) ? phone : "";
};

const normalizePreferredContactMethod = (value = "email") => {
  const normalized = sanitizeText(value, 20).toLowerCase();
  return ["email", "phone", "whatsapp"].includes(normalized) ? normalized : "email";
};

const getPasswordRequirementErrors = (password = "") => {
  const errors = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);
  }
  if (!/[a-z]/.test(password)) errors.push("Password must include a lowercase letter.");
  if (!/[A-Z]/.test(password)) errors.push("Password must include an uppercase letter.");
  if (!/\d/.test(password)) errors.push("Password must include a number.");
  if (!/[^A-Za-z0-9\s]/.test(password)) errors.push("Password must include a symbol.");
  if (/\s/.test(password)) errors.push("Password must not contain spaces.");
  return errors;
};

const normalizePassword = (value) => {
  if (typeof value !== "string") return "";
  if (getPasswordRequirementErrors(value).length) return "";
  return value;
};

const toSafeCustomerErrorLog = (error) => ({
  message: String(error?.message || "Unknown customer account error")
    .replace(/\s+/g, " ")
    .slice(0, 180),
  code: typeof error?.code === "string" ? error.code.slice(0, 40) : undefined,
});

const hashInviteToken = (token) =>
  crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");

const createInviteToken = () => crypto.randomBytes(32).toString("base64url");

const resolveStorefrontBaseUrl = () =>
  String(
    process.env.STROANE_STOREFRONT_BASE_URL ||
      process.env.PUBLIC_STOREFRONT_URL ||
      process.env.STOREFRONT_BASE_URL ||
      "https://stroanesolutions.com"
  )
    .trim()
    .replace(/\/+$/, "");

const buildSignupUrl = (token) =>
  `${resolveStorefrontBaseUrl()}/signup?invite=${encodeURIComponent(token)}`;

const requireCustomerMutationHeader = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(String(req.method || "").toUpperCase())) return next();
  if (String(req.get("x-stroane-client") || "").trim().toLowerCase() === "storefront") {
    return next();
  }
  return next(createHttpError("Invalid customer request.", 403));
};

const toCustomerProfile = (customer) => ({
  id: customer.id,
  email: customer.email,
  status: String(customer.status || "INVITED").toLowerCase(),
  name: customer.name || "",
  phone: customer.phone || "",
  businessName: customer.businessName || "",
  preferredContactMethod: customer.preferredContactMethod || "email",
  defaultDeliveryAddress: customer.defaultDeliveryAddress || "",
  deliveryNotes: customer.deliveryNotes || "",
  invitedAt: customer.invitedAt || undefined,
  inviteExpiresAt: customer.inviteExpiresAt || undefined,
  activatedAt: customer.activatedAt || undefined,
  lastLoginAt: customer.lastLoginAt || undefined,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
});

const toCustomerOrder = (order) => ({
  ...toPublicCommerceOrder(order),
  deliveryAddress: order.deliveryAddress || "",
  deliveryNotes: order.deliveryNotes || "",
});

const buildInviteData = (token = createInviteToken()) => ({
  token,
  tokenHash: hashInviteToken(token),
  expiresAt: new Date(Date.now() + CUSTOMER_INVITE_TTL_MS),
  signupUrl: buildSignupUrl(token),
});

const buildPasswordResetUrl = (token) =>
  `${resolveStorefrontBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

const buildPasswordResetData = (token = createInviteToken()) => ({
  token,
  tokenHash: hashInviteToken(token),
  expiresAt: new Date(Date.now() + CUSTOMER_PASSWORD_RESET_TTL_MS),
  resetUrl: buildPasswordResetUrl(token),
});

const linkOrdersForCustomer = async (prisma, customer) => {
  if (!customer?.id || !customer.email || !prisma.commerceOrder?.updateMany) return;
  await prisma.commerceOrder.updateMany({
    where: {
      customerId: null,
      customerEmail: { equals: customer.email, mode: "insensitive" },
    },
    data: { customerId: customer.id },
  });
};

const getCustomerFromToken = async (prisma, token) => {
  const payload = verifyToken(token);
  if (payload?.aud !== CUSTOMER_TOKEN_AUDIENCE || !payload?.customerId) return null;

  const customer = await prisma.customerAccount.findUnique({
    where: { id: String(payload.customerId) },
    select: CUSTOMER_SELECT,
  });
  if (!customer || customer.status === "LOCKED") return null;
  return customer;
};

const requireCustomer = (prisma) =>
  asyncRoute(async (req, res, next) => {
    const token = getCustomerAuthCookieToken(req);
    if (!token) return res.status(401).json({ error: "Sign in to continue." });

    const customer = await getCustomerFromToken(prisma, token);
    if (!customer) return res.status(401).json({ error: "Sign in to continue." });
    req.customer = customer;
    return next();
  });

const setCustomerSession = async (prisma, res, customer) => {
  const token = signToken({
    aud: CUSTOMER_TOKEN_AUDIENCE,
    customerId: customer.id,
    email: customer.email,
  });
  setCustomerAuthCookie(res, token);
  await linkOrdersForCustomer(prisma, customer);
};

const normalizeProfilePayload = (body = {}, { requirePassword = false } = {}) => {
  const name = sanitizeText(body.name, 140);
  const email = normalizeEmail(body.email);
  const phone = "phone" in body ? normalizePhone(body.phone) : "";
  const password = normalizePassword(body.password);
  const businessName = sanitizeText(body.businessName, 160);
  const defaultDeliveryAddress = sanitizeText(body.defaultDeliveryAddress, 260);
  const deliveryNotes = sanitizeText(body.deliveryNotes, 500);
  const preferredContactMethod = normalizePreferredContactMethod(body.preferredContactMethod);

  const errors = [];
  if (!name) errors.push("Full name is required.");
  if (!email) errors.push("A valid email address is required.");
  if ("phone" in body && body.phone && !phone) errors.push("Add a valid phone number.");
  if (requirePassword && !password) {
    errors.push(...getPasswordRequirementErrors(typeof body.password === "string" ? body.password : ""));
  }

  if (errors.length) {
    throw createHttpError("Invalid customer profile details.", 400, errors);
  }

  return {
    name,
    email,
    phone: phone || null,
    businessName: businessName || null,
    preferredContactMethod,
    defaultDeliveryAddress: defaultDeliveryAddress || null,
    deliveryNotes: deliveryNotes || null,
    password,
  };
};

const findSignupContext = async (prisma, { inviteToken, paymentReference, email }) => {
  const token = sanitizeText(inviteToken, 160);
  if (token) {
    const customer = await prisma.customerAccount.findFirst({
      where: {
        inviteTokenHash: hashInviteToken(token),
        inviteExpiresAt: { gt: new Date() },
        status: { not: "LOCKED" },
      },
      select: { ...CUSTOMER_SELECT, passwordHash: true },
    });
    if (!customer) throw createHttpError("This profile invitation is invalid or expired.", 400);
    if (email && customer.email !== email) {
      throw createHttpError("Use the email address this invitation was sent to.", 400);
    }
    return { source: "invite", customer };
  }

  const reference = sanitizeText(paymentReference, 140);
  if (reference) {
    const order = await prisma.commerceOrder.findFirst({
      where: {
        OR: [{ paymentReference: reference }, { orderNumber: reference }],
      },
      include: { items: true, customerAccount: true },
    });
    if (!order) throw createHttpError("We could not find that checkout reference.", 404);
    if (normalizeEmail(order.customerEmail) !== email) {
      throw createHttpError("Use the same email address from checkout.", 400);
    }
    if (order.customerAccount?.status === "LOCKED") {
      throw createHttpError("This customer account is locked. Contact Stroane.", 403);
    }
    return { source: "checkout", order, customer: order.customerAccount || null };
  }

  return { source: "direct", customer: null };
};

const completeSignup = async (prisma, payload, context = {}, createdById = null) => {
  const passwordHash = hashPassword(payload.password);
  const now = new Date();
  const existingByEmail = await prisma.customerAccount.findFirst({
    where: { email: { equals: payload.email, mode: "insensitive" } },
    select: { id: true, status: true, passwordHash: true, createdById: true },
  });
  const contextCustomer = context.customer;
  const existingId = contextCustomer?.id || existingByEmail?.id || null;

  if (contextCustomer?.email && contextCustomer.email !== payload.email) {
    throw createHttpError("This account link belongs to a different email address.", 409);
  }
  if (existingByEmail?.status === "LOCKED" || contextCustomer?.status === "LOCKED") {
    throw createHttpError("This customer account is locked. Contact Stroane.", 403);
  }
  if (existingByEmail?.passwordHash && existingByEmail.id !== contextCustomer?.id) {
    throw createDuplicateCustomerEmailError();
  }
  if (contextCustomer?.passwordHash) {
    throw createDuplicateCustomerEmailError();
  }

  const data = {
    email: payload.email,
    name: payload.name,
    phone: payload.phone,
    businessName: payload.businessName,
    preferredContactMethod: payload.preferredContactMethod,
    defaultDeliveryAddress:
      payload.defaultDeliveryAddress ||
      context.order?.deliveryAddress ||
      contextCustomer?.defaultDeliveryAddress ||
      null,
    deliveryNotes: payload.deliveryNotes || context.order?.deliveryNotes || null,
    passwordHash,
    status: "ACTIVE",
    activatedAt: now,
    lastLoginAt: now,
    inviteTokenHash: null,
    inviteExpiresAt: null,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    passwordResetRequestedAt: null,
    createdById: contextCustomer?.createdById || existingByEmail?.createdById || createdById,
  };

  let customer;
  try {
    customer = existingId
      ? await prisma.customerAccount.update({
          where: { id: existingId },
          data,
          select: CUSTOMER_SELECT,
        })
      : await prisma.customerAccount.create({
          data,
          select: CUSTOMER_SELECT,
        });
  } catch (error) {
    if (isUniqueFieldError(error, "email")) throw createDuplicateCustomerEmailError();
    throw error;
  }

  if (context.order?.id) {
    await prisma.commerceOrder.update({
      where: { id: context.order.id },
      data: { customerId: customer.id },
    });
  }
  await linkOrdersForCustomer(prisma, customer);
  return customer;
};

const toAdminCustomer = (customer) => {
  const lastOrder = customer.orders?.[0] || null;
  return {
    ...toCustomerProfile(customer),
    hasAccount: Boolean(customer.activatedAt),
    inviteActive:
      customer.status === "INVITED" &&
      customer.inviteExpiresAt instanceof Date &&
      customer.inviteExpiresAt.getTime() > Date.now(),
    orderCount: customer._count?.orders || 0,
    totalSpend: Number(customer.ordersAggregate?.totalSpend || 0),
    lastOrder: lastOrder
      ? {
          id: lastOrder.id,
          orderNumber: lastOrder.orderNumber,
          total: Number(lastOrder.total || 0),
          status: String(lastOrder.status || "").toLowerCase(),
          paymentStatus: lastOrder.paymentStatus || "",
          createdAt: lastOrder.createdAt,
        }
      : null,
  };
};

const buildCustomerSummary = (customers = []) =>
  customers.reduce(
    (summary, customer) => {
      summary.totalCustomers += 1;
      if (customer.status === "ACTIVE") summary.activeAccounts += 1;
      if (customer.status === "INVITED") summary.invitedAccounts += 1;
      if (customer.status === "LOCKED") summary.lockedAccounts += 1;
      summary.linkedOrders += customer._count?.orders || 0;
      return summary;
    },
    {
      totalCustomers: 0,
      activeAccounts: 0,
      invitedAccounts: 0,
      lockedAccounts: 0,
      linkedOrders: 0,
    }
  );

const buildCustomerListWhere = (query = {}) => {
  const search = sanitizeText(query.search, 120);
  const status = sanitizeText(query.status, 20).toUpperCase();
  const where = {};
  if (["INVITED", "ACTIVE", "LOCKED"].includes(status)) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { businessName: { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
};

const toSafeResetLog = (error) => ({
  message: String(error?.message || "Unknown password reset email error")
    .replace(/\s+/g, " ")
    .slice(0, 180),
  statusCode: Number(error?.statusCode) || undefined,
});

const getCustomersWithOrderTotals = async (prisma, where, limit) => {
  const customers = await prisma.customerAccount.findMany({
    where,
    select: {
      ...CUSTOMER_SELECT,
      _count: { select: { orders: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const totals = await Promise.all(
    customers.map(async (customer) => {
      const aggregate = await prisma.commerceOrder.aggregate({
        where: { customerId: customer.id },
        _sum: { total: true },
      });
      return [customer.id, Number(aggregate._sum.total || 0)];
    })
  );
  const totalByCustomerId = new Map(totals);

  return customers.map((customer) => ({
    ...customer,
    ordersAggregate: { totalSpend: totalByCustomerId.get(customer.id) || 0 },
  }));
};

export const createCustomerAccountRouter = (prisma) => {
  const router = Router();
  const requireCurrentCustomer = requireCustomer(prisma);

  router.use(requireCustomerMutationHeader);

  router.post(
    "/signup",
    asyncRoute(async (req, res) => {
      const payload = normalizeProfilePayload(req.body || {}, { requirePassword: true });
      const context = await findSignupContext(prisma, {
        inviteToken: req.body?.inviteToken,
        paymentReference: req.body?.paymentReference,
        email: payload.email,
      });
      const customer = await completeSignup(prisma, payload, context);
      await setCustomerSession(prisma, res, customer);
      return res.status(201).json({ ok: true, customer: toCustomerProfile(customer) });
    })
  );

  router.post(
    "/login",
    asyncRoute(async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!email || !password) {
        throw createHttpError("Incorrect email or password.", 401);
      }

      const customer = await prisma.customerAccount.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { ...CUSTOMER_SELECT, passwordHash: true },
      });
      const valid = safeVerifyPassword(password, customer?.passwordHash || null);
      if (!customer || !valid || customer.status !== "ACTIVE") {
        throw createHttpError("Incorrect email or password.", 401);
      }

      const updatedCustomer = await prisma.customerAccount.update({
        where: { id: customer.id },
        data: { lastLoginAt: new Date() },
        select: CUSTOMER_SELECT,
      });
      await setCustomerSession(prisma, res, updatedCustomer);
      return res.json({ ok: true, customer: toCustomerProfile(updatedCustomer) });
    })
  );

  router.post(
    "/password/forgot",
    asyncRoute(async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      const genericResponse = {
        ok: true,
        message: "If that email belongs to a Stroane account, a reset link will be sent.",
      };

      if (!email) return res.json(genericResponse);

      const customer = await prisma.customerAccount.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { ...CUSTOMER_SELECT, passwordHash: true },
      });
      if (!customer || customer.status === "LOCKED" || !customer.passwordHash) {
        return res.json(genericResponse);
      }

      const reset = buildPasswordResetData();
      await prisma.customerAccount.update({
        where: { id: customer.id },
        data: {
          passwordResetTokenHash: reset.tokenHash,
          passwordResetExpiresAt: reset.expiresAt,
          passwordResetRequestedAt: new Date(),
        },
        select: { id: true },
      });

      try {
        await sendCustomerPasswordResetEmail({
          customer,
          resetUrl: reset.resetUrl,
          expiresInMinutes: Math.round(CUSTOMER_PASSWORD_RESET_TTL_MS / 60_000),
        });
      } catch (error) {
        console.warn("Customer password reset email failed", toSafeResetLog(error));
      }

      return res.json(genericResponse);
    })
  );

  router.post(
    "/password/reset",
    asyncRoute(async (req, res) => {
      const token = sanitizeText(req.body?.token, 240);
      const password = normalizePassword(req.body?.password);

      if (!token) throw createHttpError("Reset link is invalid or expired.", 400);
      if (!password) {
        throw createHttpError(
          "Password must meet every listed requirement.",
          400,
          getPasswordRequirementErrors(typeof req.body?.password === "string" ? req.body.password : "")
        );
      }

      const customer = await prisma.customerAccount.findFirst({
        where: {
          passwordResetTokenHash: hashInviteToken(token),
          passwordResetExpiresAt: { gt: new Date() },
          status: { not: "LOCKED" },
        },
        select: CUSTOMER_SELECT,
      });
      if (!customer) throw createHttpError("Reset link is invalid or expired.", 400);

      const updatedCustomer = await prisma.customerAccount.update({
        where: { id: customer.id },
        data: {
          passwordHash: hashPassword(password),
          status: "ACTIVE",
          activatedAt: customer.activatedAt || new Date(),
          lastLoginAt: new Date(),
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          passwordResetRequestedAt: null,
          inviteTokenHash: null,
          inviteExpiresAt: null,
        },
        select: CUSTOMER_SELECT,
      });
      await setCustomerSession(prisma, res, updatedCustomer);
      return res.json({ ok: true, customer: toCustomerProfile(updatedCustomer) });
    })
  );

  router.post("/logout", (_req, res) => {
    clearCustomerAuthCookie(res);
    return res.json({ ok: true });
  });

  router.get(
    "/me",
    requireCurrentCustomer,
    asyncRoute(async (req, res) => {
      await linkOrdersForCustomer(prisma, req.customer);
      return res.json({ ok: true, customer: toCustomerProfile(req.customer) });
    })
  );

  router.patch(
    "/me",
    requireCurrentCustomer,
    asyncRoute(async (req, res) => {
      const payload = normalizeProfilePayload(
        { ...req.customer, ...req.body, email: req.customer.email },
        { requirePassword: false }
      );

      const updatedCustomer = await prisma.customerAccount.update({
        where: { id: req.customer.id },
        data: {
          name: payload.name,
          phone: payload.phone,
          businessName: payload.businessName,
          preferredContactMethod: payload.preferredContactMethod,
          defaultDeliveryAddress: payload.defaultDeliveryAddress,
          deliveryNotes: payload.deliveryNotes,
        },
        select: CUSTOMER_SELECT,
      });
      return res.json({ ok: true, customer: toCustomerProfile(updatedCustomer) });
    })
  );

  router.get(
    "/orders",
    requireCurrentCustomer,
    asyncRoute(async (req, res) => {
      await linkOrdersForCustomer(prisma, req.customer);
      const orders = await prisma.commerceOrder.findMany({
        where: {
          OR: [
            { customerId: req.customer.id },
            { customerEmail: { equals: req.customer.email, mode: "insensitive" } },
          ],
        },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return res.json({ ok: true, orders: orders.map(toCustomerOrder) });
    })
  );

  return router;
};

export const createAdminCustomerRouter = (prisma) => {
  const router = Router();

  router.use(requireSiteUser(prisma, ["ADMIN", "OWNER", "VIEWER", "CUSTOM"]));

  router.get(
    "/customers",
    asyncRoute(async (req, res) => {
      const limit = Math.min(Math.max(Number(req.query.limit) || 120, 1), 250);
      const customers = await getCustomersWithOrderTotals(
        prisma,
        buildCustomerListWhere(req.query),
        limit
      );
      return res.json({
        customers: customers.map(toAdminCustomer),
        summary: buildCustomerSummary(customers),
      });
    })
  );

  router.get(
    "/customers/:id",
    asyncRoute(async (req, res) => {
      const customer = await prisma.customerAccount.findUnique({
        where: { id: String(req.params.id || "") },
        select: {
          ...CUSTOMER_SELECT,
          _count: { select: { orders: true } },
          orders: {
            orderBy: { createdAt: "desc" },
            include: { items: true },
            take: 25,
          },
        },
      });
      if (!customer) return res.status(404).json({ error: "Customer not found." });
      const aggregate = await prisma.commerceOrder.aggregate({
        where: { customerId: customer.id },
        _sum: { total: true },
      });
      return res.json({
        customer: toAdminCustomer({
          ...customer,
          ordersAggregate: { totalSpend: Number(aggregate._sum.total || 0) },
        }),
        orders: customer.orders.map(toCustomerOrder),
      });
    })
  );

  router.post(
    "/customers",
    requireAdminRole(prisma, "crm", "create"),
    asyncRoute(async (req, res) => {
      const payload = normalizeProfilePayload({
        ...req.body,
        password: "Temporary-password-1!",
      });
      const shouldCreateInvite = req.body?.createInvite !== false;
      const invite = shouldCreateInvite ? buildInviteData() : null;
      const existing = await prisma.customerAccount.findFirst({
        where: { email: { equals: payload.email, mode: "insensitive" } },
      });

      if (existing?.status === "LOCKED") {
        throw createHttpError("This customer account is locked.", 409);
      }

      let customer;
      try {
        customer = existing
          ? await prisma.customerAccount.update({
              where: { id: existing.id },
              data: {
                email: payload.email,
                name: payload.name,
                phone: payload.phone,
                businessName: payload.businessName,
                preferredContactMethod: payload.preferredContactMethod,
                defaultDeliveryAddress: payload.defaultDeliveryAddress,
                deliveryNotes: payload.deliveryNotes,
                ...(existing.status === "ACTIVE"
                  ? {}
                  : { status: "INVITED" }),
                ...(invite
                  ? {
                      inviteTokenHash: invite.tokenHash,
                      inviteExpiresAt: invite.expiresAt,
                      invitedAt: new Date(),
                    }
                  : {}),
              },
              select: CUSTOMER_SELECT,
            })
          : await prisma.customerAccount.create({
              data: {
                email: payload.email,
                name: payload.name,
                phone: payload.phone,
                businessName: payload.businessName,
                preferredContactMethod: payload.preferredContactMethod,
                defaultDeliveryAddress: payload.defaultDeliveryAddress,
                deliveryNotes: payload.deliveryNotes,
                status: "INVITED",
                createdById: req.authUser?.id || null,
                ...(invite
                  ? {
                      inviteTokenHash: invite.tokenHash,
                      inviteExpiresAt: invite.expiresAt,
                      invitedAt: new Date(),
                    }
                  : {}),
              },
              select: CUSTOMER_SELECT,
            });
      } catch (error) {
        if (isUniqueFieldError(error, "email")) {
          throw createHttpError("A customer record already exists for this email.", 409);
        }
        throw error;
      }

      await linkOrdersForCustomer(prisma, customer);
      return res.status(201).json({
        customer: toAdminCustomer(customer),
        invite: invite
          ? {
              signupUrl: invite.signupUrl,
              expiresAt: invite.expiresAt,
            }
          : null,
      });
    })
  );

  router.patch(
    "/customers/:id",
    requireAdminRole(prisma, "crm", "edit"),
    asyncRoute(async (req, res) => {
      const updates = {};
      if ("name" in req.body) updates.name = sanitizeText(req.body.name, 140);
      if ("phone" in req.body) updates.phone = normalizePhone(req.body.phone) || null;
      if ("businessName" in req.body) {
        updates.businessName = sanitizeText(req.body.businessName, 160) || null;
      }
      if ("preferredContactMethod" in req.body) {
        updates.preferredContactMethod = normalizePreferredContactMethod(
          req.body.preferredContactMethod
        );
      }
      if ("defaultDeliveryAddress" in req.body) {
        updates.defaultDeliveryAddress = sanitizeText(req.body.defaultDeliveryAddress, 260) || null;
      }
      if ("deliveryNotes" in req.body) {
        updates.deliveryNotes = sanitizeText(req.body.deliveryNotes, 500) || null;
      }
      if ("status" in req.body) {
        const status = sanitizeText(req.body.status, 20).toUpperCase();
        if (!["INVITED", "ACTIVE", "LOCKED"].includes(status)) {
          throw createHttpError("Invalid customer status.", 400);
        }
        updates.status = status;
      }

      if (Object.keys(updates).length === 0) {
        throw createHttpError("No customer fields to update.", 400);
      }

      const customer = await prisma.customerAccount.update({
        where: { id: String(req.params.id || "") },
        data: updates,
        select: CUSTOMER_SELECT,
      });
      await linkOrdersForCustomer(prisma, customer);
      return res.json({ customer: toAdminCustomer(customer) });
    })
  );

  router.post(
    "/customers/:id/invite",
    requireAdminRole(prisma, "crm", "edit"),
    asyncRoute(async (req, res) => {
      const invite = buildInviteData();
      const customer = await prisma.customerAccount.update({
        where: { id: String(req.params.id || "") },
        data: {
          status: "INVITED",
          inviteTokenHash: invite.tokenHash,
          inviteExpiresAt: invite.expiresAt,
          invitedAt: new Date(),
        },
        select: CUSTOMER_SELECT,
      });
      return res.json({
        customer: toAdminCustomer(customer),
        invite: {
          signupUrl: invite.signupUrl,
          expiresAt: invite.expiresAt,
        },
      });
    })
  );

  return router;
};

export const tryLinkCustomerForOrder = async (prisma, email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !prisma.customerAccount?.findUnique) return null;
  try {
    const customer = await prisma.customerAccount.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, email: true, status: true },
    });
    return customer?.status === "LOCKED" ? null : customer;
  } catch (error) {
    console.warn("Customer order link lookup failed", toSafeCustomerErrorLog(error));
    return null;
  }
};
