import { accountingModule } from "./accounting/index.js";
import { analyticsModule } from "./analytics/index.js";
import { auditModule } from "./audit/index.js";
import { bookingsModule } from "./bookings/index.js";
import { customersModule } from "./customers/index.js";
import { dashboardModule } from "./dashboard/index.js";
import { deliveryModule } from "./delivery/index.js";
import { documentsModule } from "./documents/index.js";
import { expensesModule } from "./expenses/index.js";
import { hrModule } from "./hr/index.js";
import { inventoryModule } from "./inventory/index.js";
import { invoicingModule } from "./invoicing/index.js";
import { maintenanceModule } from "./maintenance/index.js";
import { marketingModule } from "./marketing/index.js";
import { ordersModule } from "./orders/index.js";
import { rentalsModule } from "./rentals/index.js";
import { settingsModule } from "./settings/index.js";
import { waterModule } from "./water/index.js";

export const backendModules = Object.freeze([
  dashboardModule,
  bookingsModule,
  rentalsModule,
  ordersModule,
  customersModule,
  inventoryModule,
  deliveryModule,
  invoicingModule,
  accountingModule,
  expensesModule,
  hrModule,
  maintenanceModule,
  marketingModule,
  documentsModule,
  auditModule,
  analyticsModule,
  waterModule,
  settingsModule,
]);
