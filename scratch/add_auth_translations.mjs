import fs from "fs";

const newKeys = {
  "English (US)": {
    "auth_confirm_password": "Confirm Password",
    "auth_confirm_password_placeholder": "Re-enter your password",
    "auth_err_password_mismatch": "Passwords do not match. Please re-enter your password.",
    "auth_verify_email_title": "Verify Your Email",
    "auth_verify_email_instructions": "Please check your inbox (and spam or promotions folder) and click the link to activate your Expensely account.",
    "auth_cooldown_wait": "Resend available in {seconds}s",
  },
  "English (UK)": {
    "auth_confirm_password": "Confirm Password",
    "auth_confirm_password_placeholder": "Re-enter your password",
    "auth_err_password_mismatch": "Passwords do not match. Please re-enter your password.",
    "auth_verify_email_title": "Verify Your Email",
    "auth_verify_email_instructions": "Please check your inbox (and spam or promotions folder) and click the link to activate your Expensely account.",
    "auth_cooldown_wait": "Resend available in {seconds}s",
  },
  "Hindi": {
    "auth_confirm_password": "पासवर्ड की पुष्टि करें",
    "auth_confirm_password_placeholder": "अपना पासवर्ड पुनः दर्ज करें",
    "auth_err_password_mismatch": "पासवर्ड मेल नहीं खाते। कृपया अपना पासवर्ड पुनः दर्ज करें।",
    "auth_verify_email_title": "अपना ईमेल सत्यापित करें",
    "auth_verify_email_instructions": "कृपया अपना इनबॉक्स (और स्पैम फ़ोल्डर) जांचें और अपने खाते को सक्रिय करने के लिए लिंक पर क्लिक करें।",
    "auth_cooldown_wait": "{seconds}s में पुनः भेजें",
  },
  "Spanish": {
    "auth_confirm_password": "Confirmar Contraseña",
    "auth_confirm_password_placeholder": "Vuelva a ingresar su contraseña",
    "auth_err_password_mismatch": "Las contraseñas no coinciden. Por favor reingrese su contraseña.",
    "auth_verify_email_title": "Verifique su Correo",
    "auth_verify_email_instructions": "Por favor revise su bandeja de entrada (y carpeta de spam) y haga clic en el enlace para activar su cuenta.",
    "auth_cooldown_wait": "Reenvío disponible en {seconds}s",
  },
  "French": {
    "auth_confirm_password": "Confirmer le Mot de Passe",
    "auth_confirm_password_placeholder": "Saisissez à nouveau votre mot de passe",
    "auth_err_password_mismatch": "Les mots de passe ne correspondent pas. Veuillez saisir à nouveau.",
    "auth_verify_email_title": "Vérifiez Votre E-mail",
    "auth_verify_email_instructions": "Veuillez vérifier votre boîte de réception (et dossier spam) et cliquer sur le lien pour activer votre compte.",
    "auth_cooldown_wait": "Renvoi disponible dans {seconds}s",
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
console.log("Successfully inserted auth additions to translations.ts!");
