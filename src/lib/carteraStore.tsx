"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AbonoCartera } from "./types";

const STORAGE_KEY = "tort-cartera-v1";

interface CarteraStore {
  abonos: AbonoCartera[];
  addAbono: (a: AbonoCartera) => void;
  removeAbono: (id: string) => void;
}

const CarteraContext = createContext<CarteraStore | null>(null);

export function CarteraProvider({ children }: { children: ReactNode }) {
  const [abonos, setAbonos] = useState<AbonoCartera[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setAbonos(JSON.parse(saved)); } catch {}
  }, []);

  const store = useMemo<CarteraStore>(() => {
    const save = (next: AbonoCartera[]) => {
      setAbonos(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    };
    return {
      abonos,
      addAbono: (a) => save([a, ...abonos]),
      removeAbono: (id) => save(abonos.filter((a) => a.id !== id)),
    };
  }, [abonos]);

  return <CarteraContext.Provider value={store}>{children}</CarteraContext.Provider>;
}

export function useCartera(): CarteraStore {
  const ctx = useContext(CarteraContext);
  if (!ctx) throw new Error("useCartera must be inside CarteraProvider");
  return ctx;
}
