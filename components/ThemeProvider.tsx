"use client";

import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";

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

const subscribe = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("themechange", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("themechange", callback);
    window.removeEventListener("storage", callback);
  };
};

const getSnapshot = () => {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("darkMode") === "true" ? "dark" : "light";
};

const getServerSnapshot = () => "light";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const currentTheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const themeRef = useRef("light");

  const applyTheme = (newTheme: string) => {
    themeRef.current = newTheme;
    if (typeof document !== "undefined") {
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      }
    }
  };

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  const setTheme = (newTheme: string) => {
    localStorage.setItem("darkMode", newTheme === "dark" ? "true" : "false");
    applyTheme(newTheme);
    window.dispatchEvent(new Event("themechange"));
  };

  const toggleTheme = () => {
    setTheme(currentTheme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
