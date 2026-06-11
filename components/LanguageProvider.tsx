"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";

type LanguageContextType = {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "English (US)",
  setLanguage: () => {},
  t: (key: string) => key,
});

const TRANSLATIONS: Record<string, Record<string, string>> = {
  "English (US)": {
    "Dashboard": "Dashboard",
    "Expenses": "Expenses",
    "Receipt Scanner": "Receipt Scanner",
    "Analytics": "Analytics",
    "Groups": "Groups",
    "Budgets": "Budgets",
    "Settings": "Settings",
    "Help Center": "Help Center",
    "Logout": "Logout",
    "Overview": "Overview",
    "Add Expense": "Add Expense",
    "Total Spending": "Total Spending",
    "Monthly Budget": "Monthly Budget",
    "Remaining": "Remaining",
    "Recent Receipt": "Recent Receipt",
    "Spending Trends": "Spending Trends",
    "Categories": "Categories",
    "Recent": "Recent",
    "View All": "View All",
    "Analytics & Reports": "Analytics & Reports",
    "Total Spend": "Total Spend",
    "Average Daily": "Average Daily",
    "Projected EOM": "Projected EOM",
    "AI Potential Savings": "AI Potential Savings",
    "Spending Trend": "Spending Trend",
    "Category Breakdown": "Category Breakdown",
    "Weekly Comparison": "Weekly Comparison",
    "Smart Recommendations": "Smart Recommendations",
    "Run Full Audit": "Run Full Audit",
    "Scan New Receipt": "Scan New Receipt",
    "Export Report": "Export Report",
  },
  "Hindi": {
    "Dashboard": "डैशबोर्ड",
    "Expenses": "खर्चे",
    "Receipt Scanner": "रसीद स्कैनर",
    "Analytics": "एनालिटिक्स",
    "Groups": "समूह",
    "Budgets": "बजट",
    "Settings": "सेटिंग्स",
    "Help Center": "सहायता केंद्र",
    "Logout": "लॉग आउट",
    "Overview": "अवलोकन",
    "Add Expense": "खर्च जोड़ें",
    "Total Spending": "कुल खर्च",
    "Monthly Budget": "मासिक बजट",
    "Remaining": "शेष",
    "Recent Receipt": "हाल की रसीद",
    "Spending Trends": "खर्च की प्रवृत्तियां",
    "Categories": "श्रेणियां",
    "Recent": "हाल का",
    "View All": "सभी देखें",
    "Analytics & Reports": "एनालिटिक्स और रिपोर्ट",
    "Total Spend": "कुल खर्च",
    "Average Daily": "दैनिक औसत",
    "Projected EOM": "महीने के अंत तक अनुमानित",
    "AI Potential Savings": "एआई संभावित बचत",
    "Spending Trend": "खर्च की प्रवृत्ति",
    "Category Breakdown": "श्रेणी विवरण",
    "Weekly Comparison": "साप्ताहिक तुलना",
    "Smart Recommendations": "स्मार्ट सिफारिशें",
    "Run Full Audit": "पूरा ऑडिट करें",
    "Scan New Receipt": "नई रसीद स्कैन करें",
    "Export Report": "रिपोर्ट निर्यात करें",
  },
  "Spanish": {
    "Dashboard": "Panel",
    "Expenses": "Gastos",
    "Receipt Scanner": "Escáner de recibos",
    "Analytics": "Análisis",
    "Groups": "Grupos",
    "Budgets": "Presupuestos",
    "Settings": "Configuración",
    "Help Center": "Centro de ayuda",
    "Logout": "Cerrar sesión",
    "Overview": "Resumen",
    "Add Expense": "Agregar Gasto",
    "Total Spending": "Gasto Total",
    "Monthly Budget": "Presupuesto Mensual",
    "Remaining": "Restante",
    "Recent Receipt": "Recibo Reciente",
    "Spending Trends": "Tendencias de Gasto",
    "Categories": "Categorías",
    "Recent": "Reciente",
    "View All": "Ver Todo",
    "Analytics & Reports": "Análisis e Informes",
    "Total Spend": "Gasto Total",
    "Average Daily": "Promedio Diario",
    "Projected EOM": "Proyectado para Fin de Mes",
    "AI Potential Savings": "Ahorros Potenciales con IA",
    "Spending Trend": "Tendencia de Gasto",
    "Category Breakdown": "Desglose por Categoría",
    "Weekly Comparison": "Comparación Semanal",
    "Smart Recommendations": "Recomendaciones Inteligentes",
    "Run Full Audit": "Ejecutar Auditoría Completa",
    "Scan New Receipt": "Escanear Nuevo Recibo",
    "Export Report": "Exportar Informe",
  },
  "French": {
    "Dashboard": "Tableau de bord",
    "Expenses": "Dépenses",
    "Receipt Scanner": "Scanner de reçus",
    "Analytics": "Analytique",
    "Groups": "Groupes",
    "Budgets": "Budgets",
    "Settings": "Paramètres",
    "Help Center": "Centre d'aide",
    "Logout": "Déconnexion",
    "Overview": "Aperçu",
    "Add Expense": "Ajouter une dépense",
    "Total Spending": "Dépenses Totales",
    "Monthly Budget": "Budget Mensuel",
    "Remaining": "Restant",
    "Recent Receipt": "Reçu Récent",
    "Spending Trends": "Tendances des Dépenses",
    "Categories": "Catégories",
    "Recent": "Récent",
    "View All": "Voir Tout",
    "Analytics & Reports": "Analyses et Rapports",
    "Total Spend": "Dépense Totale",
    "Average Daily": "Moyenne Quotidienne",
    "Projected EOM": "Projeté pour la fin du mois",
    "AI Potential Savings": "Économies Potentielles (IA)",
    "Spending Trend": "Tendance des Dépenses",
    "Category Breakdown": "Répartition par Catégorie",
    "Weekly Comparison": "Comparaison Hebdomadaire",
    "Smart Recommendations": "Recommandations Intelligentes",
    "Run Full Audit": "Lancer un Audit Complet",
    "Scan New Receipt": "Scanner un Nouveau Reçu",
    "Export Report": "Exporter le Rapport",
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState("English (US)");
  const languageRef = useRef("English (US)");

  useEffect(() => {
    const savedLang = localStorage.getItem("language");
    if (savedLang) {
      setLanguageState(savedLang);
      languageRef.current = savedLang;
    }

    // Use ref to avoid stale closure — no re-registration needed
    const handleLanguageChange = (e: Event) => {
      if (e.type === "storage" && (e as StorageEvent).key !== "language") return;
      const updatedLang = localStorage.getItem("language");
      if (updatedLang && updatedLang !== languageRef.current) {
        setLanguageState(updatedLang);
        languageRef.current = updatedLang;
      }
    };

    window.addEventListener("languagechange", handleLanguageChange);
    window.addEventListener("storage", handleLanguageChange);
    return () => {
      window.removeEventListener("languagechange", handleLanguageChange);
      window.removeEventListener("storage", handleLanguageChange);
    };
  }, []); // Run once only — no stale closure thanks to ref

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    languageRef.current = lang;
    localStorage.setItem("language", lang);
    window.dispatchEvent(new Event("languagechange"));
  };

  const t = (key: string) => {
    return TRANSLATIONS[language]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
