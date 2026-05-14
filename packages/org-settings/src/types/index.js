/**
 * @typedef {Object} OrganizationBranding
 * @property {string} logoUrl - URL or path reference to the organization logo
 * @property {string} faviconUrl - URL or path reference to the organization favicon
 * @property {string} primaryColor - CSS color value for primary brand color
 * @property {string} accentColor - CSS color value for accent brand color
 */

/**
 * @typedef {Object} OrganizationContactInfo
 * @property {string} contactEmail - Primary contact email
 * @property {string} contactPhone - Primary contact phone number
 * @property {string} whatsappNumber - WhatsApp contact number
 * @property {string} addressLine1 - Street address line 1
 * @property {string} addressLine2 - Street address line 2
 * @property {string} city - City
 * @property {string} country - Country
 */

/**
 * @typedef {Object} OrganizationNotificationPrefs
 * @property {boolean} [emailEnabled] - Whether email alerts are enabled
 * @property {boolean} [smsEnabled] - Whether SMS alerts are enabled
 * @property {boolean} [whatsappEnabled] - Whether WhatsApp notifications are enabled
 * @property {boolean} [notifyOffline] - Whether to alert when a service goes offline
 * @property {boolean} [notifyDegraded] - Whether to alert when a service is degraded
 */

/**
 * @typedef {Object} OrganizationSettings
 * @property {string} businessName - Display name for the organization
 * @property {string} logoUrl - URL or path reference to the organization logo
 * @property {string} faviconUrl - URL or path reference to the organization favicon
 * @property {string} primaryColor - CSS color value for primary brand color
 * @property {string} accentColor - CSS color value for accent brand color
 * @property {string} contactEmail - Primary contact email address
 * @property {string} contactPhone - Primary contact phone number
 * @property {string} whatsappNumber - WhatsApp contact number
 * @property {string} addressLine1 - Street address line 1
 * @property {string} addressLine2 - Street address line 2 / suite / floor
 * @property {string} city - City
 * @property {string} country - Country
 * @property {string} currency - ISO 4217 currency code (e.g. "GHS"); defaults to DEFAULT_CURRENCY
 * @property {string} timezone - IANA timezone string (e.g. "Africa/Accra"); defaults to DEFAULT_TIMEZONE
 * @property {string[]|null} enabledModules - Allowed module keys; null means all modules enabled
 * @property {OrganizationNotificationPrefs|null} notificationPrefs - Per-org notification preferences
 */

export {};
