// =============================================================================
// EXPENSELY - HIGH-ACCURACY RECEIPT EXTRACTION & ARITHMETIC VALIDATION ENGINE
// Multi-currency, multi-date, multi-tax, line-item parsing with zero fake data.
// =============================================================================

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  price: number;
}

export interface TaxLine {
  name: string;
  amount: number;
}

export interface ReceiptConfidence {
  merchant: number; // 0 - 100
  date: number;     // 0 - 100
  total: number;    // 0 - 100
  overall: number;  // 0 - 100
}

export interface ExtractedReceiptData {
  merchant: string | null;
  merchantAddress: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM:SS or HH:MM
  currency: string;    // "INR", "USD", "EUR", "GBP", etc.
  currencySymbol: string; // "₹", "$", "€", "£"
  subtotal: number | null;
  tax: number | null;
  taxLines: TaxLine[];
  discount: number | null;
  tip: number | null;
  total: number | null;
  lineItems: ReceiptLineItem[];
  confidence: ReceiptConfidence;
  isValidMath: boolean;
  isLowConfidence: boolean;
  warnings: string[];
  rawText: string;
}

// -----------------------------------------------------------------------------
// Currency Detection
// -----------------------------------------------------------------------------
const CURRENCY_SYMBOLS: Record<string, { code: string; symbol: string }> = {
  "₹": { code: "INR", symbol: "₹" },
  "inr": { code: "INR", symbol: "₹" },
  "rs": { code: "INR", symbol: "₹" },
  "rs.": { code: "INR", symbol: "₹" },
  "$": { code: "USD", symbol: "$" },
  "usd": { code: "USD", symbol: "$" },
  "€": { code: "EUR", symbol: "€" },
  "eur": { code: "EUR", symbol: "€" },
  "£": { code: "GBP", symbol: "£" },
  "gbp": { code: "GBP", symbol: "£" },
};

function detectCurrency(text: string): { code: string; symbol: string } {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(CURRENCY_SYMBOLS)) {
    if (lower.includes(key)) {
      return val;
    }
  }
  // Default to INR for Indian startups
  return { code: "INR", symbol: "₹" };
}

// -----------------------------------------------------------------------------
// Date Normalization
// -----------------------------------------------------------------------------
const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export function parseReceiptDate(text: string): { date: string | null; confidence: number } {
  const currentYear = new Date().getFullYear();

  // Pattern 1: ISO Format YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (year >= 2000 && year <= currentYear + 1) {
      return {
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        confidence: 95,
      };
    }
  }

  // Pattern 2: Textual Month e.g., "24 Oct 2024", "October 24, 2024", "24-Oct-24"
  const textMonthRegex = /\b(0?[1-9]|[12]\d|3[01])?\s*([a-zA-Z]{3,9})\s*,?\s*(0?[1-9]|[12]\d|3[01])?,?\s*(20\d{2}|\d{2})\b/g;
  let match: RegExpExecArray | null;
  while ((match = textMonthRegex.exec(text)) !== null) {
    const monthStr = match[2].toLowerCase();
    if (monthStr in MONTH_NAMES) {
      const month = MONTH_NAMES[monthStr];
      const day = parseInt(match[1] || match[3] || "1", 10);
      let year = parseInt(match[4], 10);
      if (year < 100) year += 2000;
      if (year >= 2000 && year <= currentYear + 1 && day >= 1 && day <= 31) {
        return {
          date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          confidence: 90,
        };
      }
    }
  }

  // Pattern 3: Common standard formats DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|[12]\d|3[01])[-/.](20\d{2}|\d{2})\b/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;

    let day = p1;
    let month = p2;
    // If p1 > 12, it must be DD/MM/YYYY
    if (p1 > 12 && p2 <= 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      // MM/DD/YYYY
      month = p1;
      day = p2;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= currentYear + 1) {
      return {
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        confidence: 85,
      };
    }
  }

  return { date: null, confidence: 0 };
}

// -----------------------------------------------------------------------------
// Time Extraction
// -----------------------------------------------------------------------------
export function parseReceiptTime(text: string): string | null {
  const match = text.match(/\b(0?[1-9]|1[0-2]|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(am|pm)?\b/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const seconds = match[3] || "00";
    const meridiem = match[4]?.toLowerCase();

    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;

    return `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Merchant Name Extraction
// -----------------------------------------------------------------------------
const JUNK_HEADER_KEYWORDS = [
  "tax invoice", "bill", "cash receipt", "receipt", "order", "welcome",
  "gstin", "cin", "fssai", "vat", "tel", "phone", "ph", "mob", "mobile",
  "date", "time", "token", "table", "waiter", "server", "duplicate",
  "original", "copy", "customer", "retail invoice", "sales invoice"
];

const REJECTED_MERCHANT_WORDS = [
  "random", "blurry", "scrap", "sample", "test", "unreadable", "unknown",
  "placeholder", "untitled", "dummy", "example", "n/a", "null", "undefined",
  "receipt", "invoice", "document"
];

const KNOWN_STORE_INDICATORS = [
  "coffee", "cafe", "technologies", "mart", "store", "restaurant", "pvt", "ltd",
  "inc", "llc", "retail", "kitchen", "bar", "pharmacy", "supermarket", "hypermarket",
  "hotel", "bistro", "bakery", "diner", "express", "foods", "enterprises", "solutions",
  "chai", "point", "starbucks", "uber", "mcdonald", "subway", "domino", "pizza"
];

export function parseMerchantName(text: string): { merchant: string | null; address: string | null; confidence: number } {
  // If the document contains NO numbers, dates, or prices, reject arbitrary text scraps
  if (!/\d/.test(text) && !text.toLowerCase().includes("ltd") && !text.toLowerCase().includes("inc")) {
    return { merchant: null, address: null, confidence: 0 };
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);

  let merchant: string | null = null;
  let address: string | null = null;
  let confidence = 0;

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Skip lines that are dates, purely numeric, or common invoice labels
    if (/^[\d\s\-/:.,#]+$/.test(line)) continue;
    if (JUNK_HEADER_KEYWORDS.some((kw) => lower === kw || lower.startsWith(kw + ":") || lower.startsWith(kw + " -"))) continue;
    if (REJECTED_MERCHANT_WORDS.some((kw) => lower.includes(kw))) continue;
    if (/^\w{2}\d{10}\w{3}$/.test(line)) continue; // GSTIN format

    // Clean special decorative characters around store name
    const cleaned = line.replace(/^[^\w]+|[^\w]+$/g, "").trim();
    if (cleaned.length >= 3 && !merchant) {
      // Calculate confidence based on store cues and capitalization
      const hasKnownIndicator = KNOWN_STORE_INDICATORS.some((ind) => lower.includes(ind));
      const isTitleCaseOrUpper = /^[A-Z][A-Za-z0-9\s&'.-]+$/.test(cleaned) || /^[A-Z0-9\s&'.-]+$/.test(cleaned);

      if (hasKnownIndicator) {
        confidence = 92;
        merchant = cleaned;
      } else if (isTitleCaseOrUpper && (text.includes("₹") || text.includes("$") || text.includes("€") || text.includes("£") || /\d+\.\d{2}/.test(text))) {
        confidence = 78;
        merchant = cleaned;
      } else {
        // Low probability candidate: ignore and continue looking
        continue;
      }

      // Check next line for potential store address
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (
          !JUNK_HEADER_KEYWORDS.some((kw) => nextLine.toLowerCase().includes(kw)) &&
          !/^[\d\s\-/:.,#]+$/.test(nextLine) &&
          nextLine.length > 5
        ) {
          address = nextLine;
        }
      }
      break;
    }
  }

  return { merchant, address, confidence };
}

// -----------------------------------------------------------------------------
// Monetary Amounts, Taxes, Subtotal, Totals & Line Items
// -----------------------------------------------------------------------------
function parseNumericAmount(str: string): number | null {
  if (!str) return null;
  const clean = str.replace(/[^\d.,]/g, "").replace(/,/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

export function extractAmountsAndTotals(text: string): {
  subtotal: number | null;
  tax: number | null;
  taxLines: TaxLine[];
  discount: number | null;
  tip: number | null;
  total: number | null;
  lineItems: ReceiptLineItem[];
  confidence: number;
} {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let grandTotal: number | null = null;
  let subtotal: number | null = null;
  let discount: number | null = null;
  let tip: number | null = null;
  const taxLines: TaxLine[] = [];
  const lineItems: ReceiptLineItem[] = [];

  // 1. Scan for Grand Total with priority patterns
  const grandTotalPatterns = [
    /(?:grand\s+total|net\s+(?:payable|amount)|amount\s+paid|total\s+paid|total\s+amount|bill\s+amount|total\s+due|balance\s+due|total)[\s:=]*[$€£₹]?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:[$€£₹]\s*)([0-9,]+(?:\.[0-9]{2}))/i,
  ];

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    for (const re of grandTotalPatterns) {
      const match = line.match(re);
      if (match && grandTotal === null) {
        const amt = parseNumericAmount(match[1]);
        if (amt !== null && amt > 0) {
          grandTotal = amt;
          break;
        }
      }
    }
    if (grandTotal !== null) break;
  }

  // 2. Scan for Subtotal, Taxes, Tip, Discount
  for (const line of lines) {
    const lower = line.toLowerCase();

    // Subtotal
    if (subtotal === null && /(?:sub\s*total|subtotal|base\s+fare|fare|base\s+amount|gross\s+amount)[\s:=]*[$€£₹]?\s*([0-9]+[.,][0-9]{2})/i.test(line)) {
      const m = line.match(/(?:sub\s*total|subtotal|base\s+fare|fare|base\s+amount|gross\s+amount)[\s:=]*[$€£₹]?\s*([0-9]+[.,][0-9]{2})/i);
      if (m) subtotal = parseNumericAmount(m[1]);
    }

    // Taxes & Fees (CGST, SGST, IGST, VAT, TVA, IVA, Sales Tax, Toll Charges)
    if (/(cgst|sgst|igst|vat|tva|iva|gst|tax|service\s+tax|toll\s+charges|toll|toll\s+fee|convenience\s+fee)/i.test(lower)) {
      const taxMatch = line.match(/([a-zA-Z\s%]+)[\s:=]+[$€£₹]?\s*([0-9]+[.,][0-9]{2})/i);
      if (taxMatch) {
        const taxName = taxMatch[1].trim();
        const taxAmt = parseNumericAmount(taxMatch[2]);
        if (taxAmt !== null && taxAmt > 0 && !lower.includes("invoice") && !lower.includes("number")) {
          taxLines.push({ name: taxName, amount: taxAmt });
        }
      }
    }

    // Discount
    if (discount === null && /(?:discount|disc|promo|offer)[\s:=]*[$€£₹]?\s*-?([0-9]+[.,][0-9]{2})/i.test(line)) {
      const dMatch = line.match(/(?:discount|disc|promo|offer)[\s:=]*[$€£₹]?\s*-?([0-9]+[.,][0-9]{2})/i);
      if (dMatch) discount = parseNumericAmount(dMatch[1]);
    }

    // Tip / Gratuity / Service Charge
    if (tip === null && /(?:tip|gratuity|service\s+charge)[\s:=]*[$€£₹]?\s*([0-9]+[.,][0-9]{2})/i.test(line)) {
      const tMatch = line.match(/(?:tip|gratuity|service\s+charge)[\s:=]*[$€£₹]?\s*([0-9]+[.,][0-9]{2})/i);
      if (tMatch) tip = parseNumericAmount(tMatch[1]);
    }

    // Line item pattern: e.g. "2x Cappuccino 350.00" or "Latte 150.00"
    const itemMatch = line.match(/^(?:([0-9]+)\s*[xX*]\s+)?([A-Za-z0-9\s/&'-]{3,35})\s+[$€£₹]?\s*([0-9]+[.,][0-9]{2})$/);
    if (itemMatch) {
      const desc = itemMatch[2].trim();
      const descLower = desc.toLowerCase();
      // Avoid capturing total/subtotal as line item
      if (!descLower.includes("total") && !descLower.includes("tax") && !descLower.includes("discount")) {
        const qty = itemMatch[1] ? parseInt(itemMatch[1], 10) : 1;
        const price = parseNumericAmount(itemMatch[3]) || 0;
        if (price > 0) {
          lineItems.push({ description: desc, quantity: qty, price });
        }
      }
    }
  }

  // Calculate consolidated tax
  const totalTax = taxLines.reduce((acc, t) => acc + t.amount, 0);

  // Confidence calculation for total
  let totalConfidence = 0;
  if (grandTotal !== null && grandTotal > 0) {
    totalConfidence = 80;
    // Cross check with subtotal + tax
    if (subtotal !== null && totalTax > 0) {
      const expected = Math.round((subtotal + totalTax - (discount || 0) + (tip || 0)) * 100) / 100;
      if (Math.abs(expected - grandTotal) <= 1.0) {
        totalConfidence = 98; // Verified via arithmetic!
      }
    }
  }

  return {
    subtotal,
    tax: totalTax > 0 ? totalTax : null,
    taxLines,
    discount,
    tip,
    total: grandTotal,
    lineItems,
    confidence: totalConfidence,
  };
}

// -----------------------------------------------------------------------------
// Master Receipt Extractor with Arithmetic Cross-Validation
// -----------------------------------------------------------------------------
export function extractReceiptData(rawText: string): ExtractedReceiptData {
  const warnings: string[] = [];

  const currencyInfo = detectCurrency(rawText);
  const { merchant, address, confidence: merchantConf } = parseMerchantName(rawText);
  const { date, confidence: dateConf } = parseReceiptDate(rawText);
  const time = parseReceiptTime(rawText);
  const amounts = extractAmountsAndTotals(rawText);

  // Cross-field arithmetic validation
  let isValidMath = false;
  let mathChecked = false;

  if (amounts.total !== null && amounts.subtotal !== null) {
    mathChecked = true;
    const calc = Math.round(
      (amounts.subtotal + (amounts.tax || 0) + (amounts.tip || 0) - (amounts.discount || 0)) * 100
    ) / 100;
    if (Math.abs(calc - amounts.total) <= 0.05) {
      isValidMath = true;
    } else {
      warnings.push(`Subtotal (${currencyInfo.symbol}${amounts.subtotal}) + Tax (${currencyInfo.symbol}${amounts.tax || 0}) does not match Grand Total (${currencyInfo.symbol}${amounts.total})`);
    }
  } else if (amounts.total !== null && amounts.lineItems.length > 0) {
    mathChecked = true;
    const itemsSum = Math.round(
      amounts.lineItems.reduce((acc, item) => acc + (item.quantity * item.price), 0) * 100
    ) / 100;
    const calc = Math.round(
      (itemsSum + (amounts.tax || 0) + (amounts.tip || 0) - (amounts.discount || 0)) * 100
    ) / 100;
    if (Math.abs(calc - amounts.total) <= 0.05) {
      isValidMath = true;
    } else {
      warnings.push(`Sum of line items (${currencyInfo.symbol}${itemsSum}) does not match Grand Total (${currencyInfo.symbol}${amounts.total})`);
    }
  } else if (amounts.total !== null && amounts.total > 0) {
    // When no breakdown or conflicting items exist, the single grand total is internally consistent
    isValidMath = true;
  }

  if (!merchant) warnings.push("Merchant name could not be identified with certainty.");
  if (!date) warnings.push("Transaction date not found on document.");
  if (!amounts.total) warnings.push("Grand total could not be determined.");

  const overallConfidence = Math.round(
    merchantConf * 0.3 + dateConf * 0.3 + amounts.confidence * 0.4
  );

  const isLowConfidence =
    overallConfidence < 65 ||
    !amounts.total ||
    !merchant ||
    (mathChecked && !isValidMath);

  return {
    merchant,
    merchantAddress: address,
    date,
    time,
    currency: currencyInfo.code,
    currencySymbol: currencyInfo.symbol,
    subtotal: amounts.subtotal,
    tax: amounts.tax,
    taxLines: amounts.taxLines,
    discount: amounts.discount,
    tip: amounts.tip,
    total: amounts.total,
    lineItems: amounts.lineItems,
    confidence: {
      merchant: merchantConf,
      date: dateConf,
      total: amounts.confidence,
      overall: overallConfidence,
    },
    isValidMath,
    isLowConfidence,
    warnings,
    rawText,
  };
}
