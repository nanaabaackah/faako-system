/**
 * Framework-independent business-domain contracts.
 *
 * These types describe stable API and integration boundaries. They are not
 * database row types and deliberately exclude ORM relations, password material,
 * framework request objects, and UI state.
 */

export type DomainId = string | number;
export type IsoDateString = string;
export type IsoDateTimeString = string;
export type CurrencyCode = string;
export type DomainStatus = string;
export type DomainPrimitive = string | number | boolean | null;
export type DomainValue =
  | DomainPrimitive
  | readonly DomainValue[]
  | { readonly [key: string]: DomainValue };
export type DomainMetadata = Readonly<Record<string, DomainValue>>;

export interface DomainEntity<Id extends DomainId = DomainId> {
  id: Id;
}

export interface DomainTimestamps {
  createdAt?: IsoDateTimeString | null;
  updatedAt?: IsoDateTimeString | null;
}

export interface ContactDetails {
  email?: string | null;
  phone?: string | null;
}

/**
 * `unit` is mandatory because existing systems mix major currency values with
 * minor-unit integers.
 */
export interface Money<Amount extends number | string = number> {
  amount: Amount;
  currency: CurrencyCode;
  unit: "major" | "minor";
}

export interface User<
  Id extends DomainId = DomainId,
  OrganisationId extends DomainId = DomainId,
  RoleId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps,
    ContactDetails {
  organisationId?: OrganisationId | null;
  roleId?: RoleId | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  username?: string | null;
  status: DomainStatus;
}

export interface Organisation<
  Id extends DomainId = DomainId,
  ParentId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps {
  name: string;
  slug?: string | null;
  status?: DomainStatus | null;
  parentId?: ParentId | null;
  primaryEmail?: string | null;
  defaultCurrency?: CurrencyCode | null;
}

/**
 * A permission definition. Assignment of a permission to a role or user is a
 * separate `PermissionGrant`.
 */
export interface Permission {
  key: string;
  resource?: string | null;
  action?: string | null;
  description?: string | null;
}

export interface PermissionGrant {
  permissionKey: Permission["key"];
  effect: "allow" | "deny";
  scope?: DomainMetadata | null;
}

export interface Role<Id extends DomainId = DomainId>
  extends DomainEntity<Id>,
    DomainTimestamps {
  key?: string | null;
  name: string;
  description?: string | null;
  status?: DomainStatus | null;
  permissions?: PermissionGrant[];
  system?: boolean;
}

export interface Category<
  Id extends DomainId = DomainId,
  ParentId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps {
  name: string;
  slug?: string | null;
  description?: string | null;
  parentId?: ParentId | null;
  status?: DomainStatus | null;
  sortOrder?: number | null;
}

export interface Product<
  Id extends DomainId = DomainId,
  CategoryId extends DomainId = DomainId,
  VendorId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps {
  name: string;
  slug?: string | null;
  sku?: string | null;
  description?: string | null;
  categoryId?: CategoryId | null;
  vendorId?: VendorId | null;
  status?: DomainStatus | null;
  price?: Money<number | string> | null;
}

export interface Customer<
  Id extends DomainId = DomainId,
  OrganisationId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps,
    ContactDetails {
  organisationId?: OrganisationId | null;
  name: string;
  status?: DomainStatus | null;
  businessName?: string | null;
  preferredContactMethod?: string | null;
}

export interface InventoryItem<
  Id extends DomainId = DomainId,
  ProductId extends DomainId = DomainId,
  VendorId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps {
  productId?: ProductId | null;
  vendorId?: VendorId | null;
  sku?: string | null;
  status: DomainStatus;
  quantityOnHand?: number | null;
  reservedQuantity?: number | null;
  availableQuantity?: number | null;
  reorderThreshold?: number | null;
}

export interface InventoryMovement<
  Id extends DomainId = DomainId,
  InventoryItemId extends DomainId = DomainId,
> extends DomainEntity<Id> {
  inventoryItemId?: InventoryItemId | null;
  type: string;
  quantityDelta: number;
  quantityBefore?: number | null;
  quantityAfter?: number | null;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: DomainId | null;
  occurredAt: IsoDateTimeString;
}

export interface OrderLine<
  Id extends DomainId = DomainId,
  ProductId extends DomainId = DomainId,
> extends DomainEntity<Id> {
  productId?: ProductId | null;
  sku?: string | null;
  name: string;
  quantity: number;
  unitPrice?: Money<number | string> | null;
  lineTotal?: Money<number | string> | null;
}

export interface Order<
  Id extends DomainId = DomainId,
  CustomerId extends DomainId = DomainId,
  OrganisationId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps {
  organisationId?: OrganisationId | null;
  customerId?: CustomerId | null;
  orderNumber?: string | null;
  status: DomainStatus;
  paymentStatus?: DomainStatus | null;
  fulfillmentStatus?: DomainStatus | null;
  subtotal?: Money<number | string> | null;
  total?: Money<number | string> | null;
  amountPaid?: Money<number | string> | null;
  balanceDue?: Money<number | string> | null;
  lines?: OrderLine[];
  placedAt?: IsoDateTimeString | null;
}

export interface BookingLine<
  Id extends DomainId = DomainId,
  ProductId extends DomainId = DomainId,
> extends DomainEntity<Id> {
  productId?: ProductId | null;
  name: string;
  quantity: number;
  price?: Money<number | string> | null;
}

export interface Booking<
  Id extends DomainId = DomainId,
  CustomerId extends DomainId = DomainId,
  OrganisationId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps {
  organisationId?: OrganisationId | null;
  customerId?: CustomerId | null;
  reference?: string | null;
  title?: string | null;
  status: DomainStatus;
  startAt: IsoDateTimeString;
  endAt?: IsoDateTimeString | null;
  location?: string | null;
  total?: Money<number | string> | null;
  lines?: BookingLine[];
}

export interface InvoiceLine<Id extends DomainId = DomainId>
  extends DomainEntity<Id> {
  description: string;
  quantity: number | string;
  unitPrice: Money<number | string>;
  lineTotal: Money<number | string>;
}

export interface Invoice<
  Id extends DomainId = DomainId,
  CustomerId extends DomainId = DomainId,
  OrganisationId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps {
  organisationId?: OrganisationId | null;
  customerId?: CustomerId | null;
  invoiceNumber: string;
  status: DomainStatus;
  issuedAt: IsoDateString | IsoDateTimeString;
  dueAt?: IsoDateString | IsoDateTimeString | null;
  subtotal: Money<number | string>;
  tax?: Money<number | string> | null;
  discount?: Money<number | string> | null;
  total: Money<number | string>;
  amountPaid?: Money<number | string> | null;
  balanceDue?: Money<number | string> | null;
  lines?: InvoiceLine[];
}

export interface Payment<
  Id extends DomainId = DomainId,
  OrderId extends DomainId = DomainId,
  CustomerId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps {
  orderId?: OrderId | null;
  customerId?: CustomerId | null;
  reference?: string | null;
  status: DomainStatus;
  method?: string | null;
  provider?: string | null;
  amount: Money<number | string>;
  paidAt?: IsoDateTimeString | null;
}

export interface Vendor<
  Id extends DomainId = DomainId,
  OrganisationId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps,
    ContactDetails {
  organisationId?: OrganisationId | null;
  name: string;
  slug?: string | null;
  status?: DomainStatus | null;
  contactName?: string | null;
  website?: string | null;
  address?: string | null;
}

export interface Employee<
  Id extends DomainId = DomainId,
  UserId extends DomainId = DomainId,
  OrganisationId extends DomainId = DomainId,
> extends DomainEntity<Id>,
    DomainTimestamps,
    ContactDetails {
  organisationId?: OrganisationId | null;
  userId?: UserId | null;
  employeeNumber?: string | null;
  displayName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  status?: DomainStatus | null;
}

/**
 * Effective access after role and direct-grant resolution. It is not an
 * authentication session and must not contain tokens or password material.
 */
export interface ApplicationAccess<
  UserId extends DomainId = DomainId,
  OrganisationId extends DomainId = DomainId,
  RoleId extends DomainId = DomainId,
> {
  userId: UserId;
  organisationId?: OrganisationId | null;
  roleIds: RoleId[];
  permissionKeys: Permission["key"][];
  moduleKeys?: string[];
  unrestricted?: boolean;
}

export interface AuditActor<Id extends DomainId = DomainId> {
  id?: Id | null;
  type: string;
  label?: string | null;
}

export interface AuditSubject<Id extends DomainId = DomainId> {
  id?: Id | null;
  type: string;
  label?: string | null;
}

export interface AuditEvent<
  Id extends DomainId = DomainId,
  OrganisationId extends DomainId = DomainId,
> {
  id?: Id;
  organisationId?: OrganisationId | null;
  action: string;
  source: string;
  status?: DomainStatus | null;
  category?: string | null;
  severity?: string | null;
  summary?: string | null;
  actor?: AuditActor | null;
  subject?: AuditSubject | null;
  requestId?: string | null;
  externalReference?: string | null;
  metadata?: DomainMetadata | null;
  occurredAt: IsoDateTimeString;
}
