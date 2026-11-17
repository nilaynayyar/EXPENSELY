import { TRANSLATIONS, SUPPORTED_LANGUAGES, LOCALE_MAP } from "../lib/i18n/translations.ts";

console.log("================================================================");
console.log("EXPENSELY - TRANSLATION COVERAGE & PARITY VALIDATION SUITE");
console.log("================================================================\n");

const baseLang = "English (US)";
const baseKeys = Object.keys(TRANSLATIONS[baseLang]);
console.log(`Base Language: ${baseLang} (${baseKeys.length} total keys)\n`);

let totalErrors = 0;

for (const lang of SUPPORTED_LANGUAGES) {
  const langKeys = Object.keys(TRANSLATIONS[lang] || {});
  const missingKeys = baseKeys.filter((k) => !(k in TRANSLATIONS[lang]));
  const extraKeys = langKeys.filter((k) => !baseKeys.includes(k));
  if (extraKeys.length > 0) {
    console.warn(`  [WARN] Extra keys found in ${lang}:`, extraKeys);
  }
  const emptyKeys = langKeys.filter((k) => !TRANSLATIONS[lang][k] || TRANSLATIONS[lang][k].trim() === "");

  console.log(`--- Checking ${lang} (Locale: ${LOCALE_MAP[lang]}) ---`);
  console.log(`  Key Count: ${langKeys.length} / ${baseKeys.length}`);

  if (missingKeys.length > 0) {
    console.error(`  [FAIL] Missing ${missingKeys.length} keys:`, missingKeys);
    totalErrors += missingKeys.length;
  } else {
    console.log(`  [PASS] Zero missing keys.`);
  }

  if (emptyKeys.length > 0) {
    console.error(`  [FAIL] Empty translation strings:`, emptyKeys);
    totalErrors += emptyKeys.length;
  } else {
    console.log(`  [PASS] Zero empty translations.`);
  }

  const coveragePercent = Math.round((langKeys.length / baseKeys.length) * 100);
  console.log(`  Coverage: ${coveragePercent}%\n`);
}

if (totalErrors === 0) {
  console.log("================================================================");
  console.log("TRANSLATION VALIDATION SUCCESS: 100% COVERAGE ACROSS ALL LANGUAGES");
  console.log("================================================================");
  process.exit(0);
} else {
  console.error(`VALIDATION FAILED WITH ${totalErrors} ERRORS`);
  process.exit(1);
}
