const TIME_ZONE_DISPLAY_NAMES = {
  UTC: "UTC",
  GMT: "GMT",
  EST: "Eastern Time",
  EDT: "Eastern Time",
  CST: "Central Time",
  CDT: "Central Time",
  MST: "Mountain Time",
  MDT: "Mountain Time",
  PST: "Pacific Time",
  PDT: "Pacific Time",
  AKST: "Alaska",
  AKDT: "Alaska",
  HST: "Hawaii",
  "UTC-12:00": "International Date Line West",
  "UTC-11:00": "Midway Island, Samoa",
  "UTC-10:00": "Hawaii",
  "UTC-08:00": "Alaska",
  "UTC-07:00": "Pacific Time",
  "UTC-06:00": "Mountain Time",
  "UTC-05:00": "Central Time",
  "UTC-04:00": "Eastern Time",
  "UTC-03:00": "Atlantic Time",
  "UTC-02:30": "Newfoundland",
  "UTC-02:00": "Mid-Atlantic",
  "UTC-01:00": "Azores, Cape Verde Islands",
  "UTC+00:00": "London, Dublin, Lisbon",
  "UTC+01:00": "Paris, Berlin, Rome",
  "UTC+02:00": "Athens, Cairo, Jerusalem",
  "UTC+03:00": "Moscow, Baghdad, Riyadh",
  "UTC+03:30": "Tehran",
  "UTC+04:00": "Abu Dhabi, Muscat, Baku",
  "UTC+04:30": "Kabul",
  "UTC+05:00": "Islamabad, Karachi, Tashkent",
  "UTC+05:30": "Mumbai, Kolkata, New Delhi",
  "UTC+05:45": "Kathmandu",
  "UTC+06:00": "Almaty, Dhaka, Colombo",
  "UTC+06:30": "Yangon, Rangoon",
  "UTC+07:00": "Bangkok, Hanoi, Jakarta",
  "UTC+08:00": "Beijing, Hong Kong, Singapore",
  "UTC+09:00": "Tokyo, Seoul, Osaka",
  "UTC+09:30": "Adelaide, Darwin",
  "UTC+10:00": "Sydney, Melbourne, Brisbane",
  "UTC+11:00": "Solomon Islands, New Caledonia",
  "UTC+12:00": "Auckland, Wellington, Fiji",
  "UTC+13:00": "Nuku'alofa",
};

// Format a stored timezone value into a human-friendly label.
export function formatTimeZoneLabel(timeZone) {
  if (typeof timeZone !== "string") {
    return "";
  }

  const trimmed = timeZone.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.toUpperCase();
  return TIME_ZONE_DISPLAY_NAMES[normalized] || trimmed;
}
