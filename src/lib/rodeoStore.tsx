"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RodeoDelDia, ParadaRodeo, EstadoRodeo } from "./types";

const STORAGE_ACTIVO = "tort-rodeo-activo-v1";
const STORAGE_HIST = "tort-rodeo-hist-v1";

interface RodeoStore {
  rodeoActivo: RodeoDelDia | null;
  historial: RodeoDelDia[];
  iniciarRodeo: (r: RodeoDelDia) => void;
  actualizarParada: (paradaId: string, patch: Partial<ParadaRodeo>) => void;
  liquidarRodeo: (efectivoRecibido: number) => RodeoDelDia | null;
  cancelarRodeo: () => void;
}

const RodeoContext = createContext<RodeoStore | null>(null);

export function RodeoProvider({ children }: { children: ReactNode }) {
  const [rodeoActivo, setRodeoActivo] = useState<RodeoDelDia | null>(null);
  const [historial, setHistorial] = useState<RodeoDelDia[]>([]);

  useEffect(() => {
    const activo = localStorage.getItem(STORAGE_ACTIVO);
    if (activo) try { setRodeoActivo(JSON.parse(activo)); } catch {}
    const hist = localStorage.getItem(STORAGE_HIST);
    if (hist) try { setHistorial(JSON.parse(hist)); } catch {}
  }, []);

  const store = useMemo<RodeoStore>(() => {
    function saveActivo(r: RodeoDelDia | null) {
      setRodeoActivo(r);
      if (r) {
        try { localStorage.setItem(STORAGE_ACTIVO, JSON.stringify(r)); } catch {}
      } else {
        try { localStorage.removeItem(STORAGE_ACTIVO); } catch {}
      }
    }
    function saveHistorial(h: RodeoDelDia[]) {
      setHistorial(h);
      try { localStorage.setItem(STORAGE_HIST, JSON.stringify(h)); } catch {}
    }

    return {
      rodeoActivo,
      historial,
      iniciarRodeo: (r) => saveActivo(r),
      actualizarParada: (paradaId, patch) => {
        if (!rodeoActivo) return;
        const updated: RodeoDelDia = {
          ...rodeoActivo,
          paradas: rodeoActivo.paradas.map((p) =>
            p.id === paradaId ? { ...p, ...patch } : p
          ),
        };
        saveActivo(updated);
      },
      liquidarRodeo: (efectivoRecibido) => {
        if (!rodeoActivo) return null;
        const done: RodeoDelDia = {
          ...rodeoActivo,
          estado: "liquidado" as EstadoRodeo,
          efectivoRecibido,
        };
        const newHist = [done, ...historial];
        saveActivo(null);
        saveHistorial(newHist);
        return done;
      },
      cancelarRodeo: () => saveActivo(null),
    };
  }, [rodeoActivo, historial]);

  return <RodeoContext.Provider value={store}>{children}</RodeoContext.Provider>;
}

export function useRodeo(): RodeoStore {
  const ctx = useContext(RodeoContext);
  if (!ctx) throw new Error("useRodeo must be inside RodeoProvider");
  return ctx;
}
