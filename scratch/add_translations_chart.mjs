import fs from "fs";

const newKeys = {
  "English (US)": {
    "chart_spent": "Spent",
    "chart_amount": "Amount",
    "chart_this_period": "This Period",
    "chart_prior_period": "Prior Period",
  },
  "English (UK)": {
    "chart_spent": "Spent",
    "chart_amount": "Amount",
    "chart_this_period": "This Period",
    "chart_prior_period": "Prior Period",
  },
  "Hindi": {
    "chart_spent": "खर्च",
    "chart_amount": "राशि",
    "chart_this_period": "इस अवधि",
    "chart_prior_period": "पिछली अवधि",
  },
  "Spanish": {
    "chart_spent": "Gastado",
    "chart_amount": "Monto",
    "chart_this_period": "Este Período",
    "chart_prior_period": "Período Anterior",
  },
  "French": {
    "chart_spent": "Dépensé",
    "chart_amount": "Montant",
    "chart_this_period": "Cette Période",
    "chart_prior_period": "Période Précédente",
  }
};

let content = fs.readFileSync("./lib/i18n/translations.ts", "utf8");

for (const [lang, dict] of Object.entries(newKeys)) {
  const blockHeader = `"${lang}": {`;
  const idx = content.indexOf(blockHeader);
  if (idx === -1) {
    console.error(`Could not find header for ${lang}`);
    process.exit(1);
  }
  
  let insertText = "\n";
  for (const [k, v] of Object.entries(dict)) {
    const safeV = v.replace(/"/g, '\\"');
    insertText += `    "${k}": "${safeV}",\n`;
  }

  content = content.slice(0, idx + blockHeader.length) + insertText + content.slice(idx + blockHeader.length);
}

fs.writeFileSync("./lib/i18n/translations.ts", content, "utf8");
console.log("Successfully inserted chart translation keys!");
