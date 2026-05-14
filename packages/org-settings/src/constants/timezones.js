export const DEFAULT_TIMEZONE = "Africa/Accra";

export const SUPPORTED_TIMEZONES = Object.freeze([
  { value: "Africa/Accra",        label: "Accra (GMT+0)" },
  { value: "Africa/Abidjan",      label: "Abidjan (GMT+0)" },
  { value: "Africa/Lagos",        label: "Lagos (GMT+1)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (GMT+2)" },
  { value: "Africa/Cairo",        label: "Cairo (GMT+2/+3)" },
  { value: "Africa/Nairobi",      label: "Nairobi (GMT+3)" },
  { value: "Africa/Kampala",      label: "Kampala (GMT+3)" },
  { value: "Africa/Dar_es_Salaam", label: "Dar es Salaam (GMT+3)" },
  { value: "Europe/London",       label: "London (GMT+0/+1)" },
  { value: "America/New_York",    label: "New York (GMT-5/-4)" },
  { value: "UTC",                 label: "UTC" },
]);

export const TIMEZONE_VALUES = Object.freeze(SUPPORTED_TIMEZONES.map((t) => t.value));
