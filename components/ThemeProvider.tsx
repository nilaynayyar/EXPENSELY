"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";

type ThemeContextType = {
  theme: string;
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState("light");
  const themeRef = useRef("light");

  // Apply class to <html> element
  const applyTheme = (newTheme: string) => {
    themeRef.current = newTheme;
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
  };

  useEffect(() => {
    // Read persisted preference on mount
    const savedTheme = localStorage.getItem("darkMode") === "true" ? "dark" : "light";
    setThemeState(savedTheme);
    applyTheme(savedTheme);

    // Listen for cross-component theme changes — use ref to avoid stale closure
    const handleThemeChange = () => {
      const isDark = localStorage.getItem("darkMode") === "true";
      const updatedTheme = isDark ? "dark" : "light";
      if (updatedTheme !== themeRef.current) {
        setThemeState(updatedTheme);
        applyTheme(updatedTheme);
      }
    };

    window.addEventListener("themechange", handleThemeChange);
    return () => window.removeEventListener("themechange", handleThemeChange);
  }, []); // Run once on mount — no stale closure because we use themeRef

  const setTheme = (newTheme: string) => {
    setThemeState(newTheme);
    localStorage.setItem("darkMode", newTheme === "dark" ? "true" : "false");
    applyTheme(newTheme);
    window.dispatchEvent(new Event("themechange"));
  };

  const toggleTheme = () => {
    setTheme(themeRef.current === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
