const fs = require("fs");
const path = require("path");

const guidesPath = path.join(__dirname, "../../data/visaGuides.json");
const typesPath = path.join(__dirname, "../../data/visaTypes.json");
const timelinePath = path.join(__dirname, "../../data/visaTimelineTasks.json");

/** Map legacy visa labels to current Ireland options. */
const VISA_ALIASES = {
  "Critical Skills": "CSEP (Critical Skills Employment Permit)",
  "General Employment": "General Work Permit",
  "Stamp 1G": "General Work Permit",
  "EU Blue Card": "EU Passport / EU Citizen",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeVisaType(visaType) {
  const raw = (visaType || "").toString().trim();
  if (!raw) return "";
  return VISA_ALIASES[raw] || raw;
}

function getVisaTypesForCountry(country) {
  const data = readJson(typesPath);
  return data[country] || data.default || [];
}

function getVisaGuide(country, visaType) {
  const guides = readJson(guidesPath);
  const normalized = normalizeVisaType(visaType);
  const countryGuides = guides[country] || guides.default || {};
  if (countryGuides[normalized]) {
    return { ...countryGuides[normalized], visaType: normalized, country };
  }
  const fallback = countryGuides[Object.keys(countryGuides)[0]];
  if (fallback) {
    return { ...fallback, visaType: normalized || null, country, fallback: true };
  }
  return null;
}

function getVisaTimelineTasks(country, visaType) {
  const data = readJson(timelinePath);
  const normalized = normalizeVisaType(visaType);
  const countryBlock = data[country];
  if (!countryBlock) return [];
  return countryBlock[normalized] || [];
}

function listVisaOptions(country) {
  const types = getVisaTypesForCountry(country);
  const guides = readJson(guidesPath);
  const countryGuides = guides[country] || {};
  return types.map((type) => {
    const g = countryGuides[type] || {};
    return {
      value: type,
      label: g.shortLabel || type,
      tagline: g.tagline || "",
    };
  });
}

module.exports = {
  normalizeVisaType,
  getVisaTypesForCountry,
  getVisaGuide,
  getVisaTimelineTasks,
  listVisaOptions,
};
