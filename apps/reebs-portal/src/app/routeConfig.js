import { lazy } from "react";
import { loadLoginPage, loadResetPasswordPage } from "../modules/auth";
import { loadDashboardPage, loadStoreModePage } from "../modules/dashboard";
import { loadBookingsPage, loadSchedulePage } from "../modules/bookings";
import { loadRentalsPage } from "../modules/rentals";
import { loadOrderBuilderPage, loadOrderDetailPage, loadOrdersPage } from "../modules/orders";
import { loadCustomersPage } from "../modules/customers";
import {
  loadInventoryPage,
  loadInventoryProductsPage,
  loadInventoryTemplatesPage,
} from "../modules/inventory";
import { loadDeliveryPage } from "../modules/delivery";
import { loadInvoicingPage } from "../modules/invoicing";
import { loadAccountingPage } from "../modules/accounting";
import { loadExpensesPage } from "../modules/expenses";
import {
  loadDirectoryPage,
  loadHrPage,
  loadRolesPage,
  loadTimesheetsPage,
} from "../modules/hr";
import { loadMaintenancePage } from "../modules/maintenance";
import { loadMarketingPage } from "../modules/marketing";
import { loadDocumentsPage } from "../modules/documents";
import { loadAuditPage } from "../modules/audit";
import { loadAnalyticsPage } from "../modules/analytics";
import { loadWaterPage } from "../modules/water";
import { loadSettingsPage } from "../modules/settings";
import { loadVendorsPage } from "../modules/vendors";

const Login = lazy(loadLoginPage);
const ResetPassword = lazy(loadResetPasswordPage);
const Dashboard = lazy(loadDashboardPage);
const StoreMode = lazy(loadStoreModePage);
const Bookings = lazy(loadBookingsPage);
const Schedule = lazy(loadSchedulePage);
const Rentals = lazy(loadRentalsPage);
const Orders = lazy(loadOrdersPage);
const OrderDetail = lazy(loadOrderDetailPage);
const OrderBuilder = lazy(loadOrderBuilderPage);
const Customers = lazy(loadCustomersPage);
const Inventory = lazy(loadInventoryPage);
const InventoryProducts = lazy(loadInventoryProductsPage);
const InventoryTemplates = lazy(loadInventoryTemplatesPage);
const Delivery = lazy(loadDeliveryPage);
const Invoicing = lazy(loadInvoicingPage);
const Accounting = lazy(loadAccountingPage);
const Expenses = lazy(loadExpensesPage);
const Directory = lazy(loadDirectoryPage);
const Hr = lazy(loadHrPage);
const Roles = lazy(loadRolesPage);
const Timesheets = lazy(loadTimesheetsPage);
const Maintenance = lazy(loadMaintenancePage);
const Marketing = lazy(loadMarketingPage);
const Documents = lazy(loadDocumentsPage);
const Audit = lazy(loadAuditPage);
const Analytics = lazy(loadAnalyticsPage);
const Water = lazy(loadWaterPage);
const Settings = lazy(loadSettingsPage);
const Vendors = lazy(loadVendorsPage);

// Route metadata is the single source of truth for URL, domain, authentication,
// and portal access classification. Water intentionally uses its own access class.
export const routeConfig = [
  { path: "/login", domain: "auth", component: Login, publicOnly: true },
  { path: "/reset-password", domain: "auth", component: ResetPassword },
  { path: "/admin", domain: "dashboard", component: Dashboard, props: { section: "home" }, auth: true, access: "standard" },
  { path: "/admin/store-mode", domain: "dashboard", component: StoreMode, auth: true, access: "standard" },
  { path: "/admin/purchases", domain: "dashboard", component: Dashboard, props: { section: "purchases" }, auth: true, access: "standard" },
  { path: "/admin/offline", domain: "dashboard", component: Dashboard, props: { section: "offline" }, auth: true, access: "standard" },
  { path: "/admin/advanced", domain: "settings", redirect: "/admin/settings?tab=advanced" },
  { path: "/admin/bookings", domain: "bookings", component: Bookings, auth: true, accessPath: "/admin/bookings" },
  { path: "/admin/schedule", domain: "bookings", component: Schedule, auth: true, access: "privileged" },
  { path: "/admin/rentals", domain: "rentals", component: Rentals, auth: true, access: "standard" },
  { path: "/admin/orders", domain: "orders", component: Orders, auth: true, access: "standard" },
  { path: "/admin/orders/new", domain: "orders", component: OrderBuilder, auth: true, access: "standard" },
  { path: "/admin/orders/:id", domain: "orders", component: OrderDetail, auth: true, access: "standard" },
  { path: "/admin/crm", domain: "customers", component: Customers, auth: true, access: "standard" },
  { path: "/admin/customers", domain: "customers", redirect: "/admin/crm" },
  { path: "/admin/inventory", domain: "inventory", component: Inventory, auth: true, access: "standard" },
  { path: "/admin/inventory/products", domain: "inventory", component: InventoryProducts, auth: true, access: "ownerAdmin" },
  { path: "/admin/inventory/templates", domain: "inventory", component: InventoryTemplates, auth: true, access: "ownerAdmin" },
  { path: "/admin/delivery", domain: "delivery", component: Delivery, auth: true, accessPath: "/admin/delivery" },
  { path: "/admin/invoicing", domain: "invoicing", component: Invoicing, auth: true, access: "privileged" },
  { path: "/admin/accounting", domain: "accounting", component: Accounting, auth: true, access: "privileged" },
  { path: "/admin/expenses", domain: "expenses", component: Expenses, auth: true, access: "privileged" },
  { path: "/admin/users", domain: "hr", component: Directory, auth: true, access: "standard" },
  { path: "/admin/employees", domain: "hr", component: Directory, auth: true, access: "standard" },
  { path: "/admin/directory", domain: "hr", component: Directory, auth: true, accessPath: "/admin/directory" },
  { path: "/admin/hr", domain: "hr", component: Hr, auth: true, access: "privileged" },
  { path: "/admin/roles", domain: "hr", component: Roles, auth: true, access: "privileged" },
  { path: "/admin/timesheets", domain: "hr", component: Timesheets, auth: true, access: "standard" },
  { path: "/admin/maintenance", domain: "maintenance", component: Maintenance, auth: true, access: "standard" },
  { path: "/admin/marketing", domain: "marketing", component: Marketing, auth: true, access: "privileged" },
  { path: "/admin/documents", domain: "documents", component: Documents, auth: true, access: "privileged" },
  { path: "/admin/audit-logs", domain: "audit", component: Audit, auth: true, access: "ownerAdmin" },
  { path: "/admin/reports", domain: "analytics", component: Analytics, auth: true, access: "ownerAdmin" },
  { path: "/admin/water", domain: "water", component: Water, auth: true, access: "water" },
  { path: "/admin/profile", domain: "settings", component: Settings, props: { profileOnly: true }, auth: true },
  { path: "/admin/settings", domain: "settings", component: Settings, auth: true, accessPath: "/admin/settings" },
  { path: "/admin/website-template", domain: "settings", redirect: "/admin/settings?tab=advanced" },
  { path: "/admin/vendors", domain: "vendors", component: Vendors, auth: true, access: "privileged" },
];
