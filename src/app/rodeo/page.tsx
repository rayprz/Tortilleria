"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  StatCard,
  Card,
  SectionTitle,
  Button,
  Modal,
  NumberField,
  Badge,
} from "@/components/ui";
import { ModuleIntro } from "@/components/ModuleIntro";
import { IconPlus, IconCheck, IconTruck, IconMapPin } from "@/components/Icons";
import { useRodeo } from "@/lib/rodeoStore";
import { useClientes } from "@/lib/clientesStore";
import { useVentas } from "@/lib/ventasStore";
import { useCartera } from "@/lib/carteraStore";
import { useParams } from "@/lib/paramsStore";
import { mxn } from "@/lib/engine";
import type { RodeoDelDia, ParadaRodeo, AbonoCartera, Venta } from "@/lib/types";

const TODAY = "2026-06-21";

// ── Helpers ────────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--line)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--maiz)" }} />
      </div>
      <span className="text-xs tabular-nums font-semibold" style={{ color: "var(--ink-muted)" }}>
        {value}/{max}
      </span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function RodeoPage() {
  const { rodeoActivo, historial, iniciarRodeo, actualizarParada, liquidarRodeo, cancelarRodeo } = useRodeo();
  const { clientes, updateSaldo } = useClientes();
  const { addVenta } = useVentas();
  const { addAbono } = useCartera();
  const { params } = useParams();

  // ── Config form state ────────────────────────────────────────────────────
  const [configOpen, setConfigOpen] = useState(false);
  const [fecha, setFecha] = useState(TODAY);
  const [kgCargados, setKgCargados] = useState(0);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

  // ── Route state ──────────────────────────────────────────────────────────
  const [paradaIdx, setParadaIdx] = useState(0);
  const [verLista, setVerLista] = useState(false);

  // Per-stop form
  const [kgForm, setKgForm] = useState(0);
  const [cobradoForm, setCobradoForm] = useState(0);

  // ── Liquidar state ───────────────────────────────────────────────────────
  const [liquidarOpen, setLiquidarOpen] = useState(false);
  const [efectivoIngresado, setEfectivoIngresado] = useState(0);

  // ── Derived ──────────────────────────────────────────────────────────────
  const paradas = rodeoActivo?.paradas ?? [];
  const completadas = paradas.filter((p) => p.completada).length;
  const todasCompletadas = paradas.length > 0 && completadas === paradas.length;
  const paradaActual = paradas[paradaIdx] ?? null;
  const clienteActual = clientes.find((c) => c.id === paradaActual?.clienteId);
  const precioActual = clienteActual?.tipo === "menudeo" ? params.precioMenudeo : params.precioMayoreo;
  const totalActual = kgForm * precioActual;
  const fiadoActual = Math.max(0, totalActual - cobradoForm);

  // Clients sorted by zona then nombre, excluding pub-gen
  const clientesRuta = useMemo(
    () =>
      clientes
        .filter((c) => c.activo && c.id !== "pub-gen")
        .sort((a, b) => (a.zona ?? "").localeCompare(b.zona ?? "") || a.nombre.localeCompare(b.nombre)),
    [clientes]
  );

  // Summary for liquidación
  const resumenRodeo = useMemo(() => {
    if (!rodeoActivo) return null;
    let kgTotal = 0, cobradoTotal = 0, fiadoTotal = 0;
    for (const p of rodeoActivo.paradas) {
      kgTotal += p.kgEntregados;
      cobradoTotal += p.cobrado;
      fiadoTotal += p.fiado;
    }
    const kgRegreso = (rodeoActivo.kgCargados ?? 0) - kgTotal;
    return { kgTotal, cobradoTotal, fiadoTotal, kgRegreso };
  }, [rodeoActivo]);

  // ── Effects ──────────────────────────────────────────────────────────────

  // When a new rodeo becomes active, go to first incomplete stop
  useEffect(() => {
    if (rodeoActivo) {
      const first = rodeoActivo.paradas.findIndex((p) => !p.completada);
      setParadaIdx(Math.max(0, first));
    }
  }, [rodeoActivo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset per-stop form when parada changes
  useEffect(() => {
    if (paradaActual) {
      const kg = paradaActual.completada ? paradaActual.kgEntregados : paradaActual.kgSugeridos;
      const precio = (clientes.find((c) => c.id === paradaActual.clienteId)?.tipo === "menudeo")
        ? params.precioMenudeo
        : params.precioMayoreo;
      setKgForm(kg);
      setCobradoForm(kg * precio);
    }
  }, [paradaIdx, rodeoActivo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────

  function iniciar() {
    if (!fecha || seleccionados.length === 0) return;
    const paradas: ParadaRodeo[] = seleccionados.map((cid, i) => {
      const c = clientes.find((cl) => cl.id === cid)!;
      return {
        id: `p-${Date.now()}-${i}`,
        clienteId: cid,
        orden: i,
        kgSugeridos: c.kgHabituales ?? 0,
        kgEntregados: 0,
        cobrado: 0,
        fiado: 0,
        completada: false,
      };
    });
    const rodeo: RodeoDelDia = {
      id: `rd-${Date.now()}`,
      fecha,
      kgCargados,
      paradas,
      estado: "en_curso",
      efectivoRecibido: 0,
    };
    iniciarRodeo(rodeo);
    setConfigOpen(false);
    setSeleccionados([]);
    setKgCargados(0);
  }

  function marcarEntregado() {
    if (!paradaActual) return;
    actualizarParada(paradaActual.id, {
      kgEntregados: kgForm,
      cobrado: cobradoForm,
      fiado: fiadoActual,
      completada: true,
    });
    // Advance to next incomplete
    const nextIdx = paradas.findIndex((p, i) => i > paradaIdx && !p.completada);
    if (nextIdx >= 0) {
      setParadaIdx(nextIdx);
    }
  }

  function saltear() {
    actualizarParada(paradaActual!.id, { completada: true, kgEntregados: 0, cobrado: 0, fiado: 0 });
    const nextIdx = paradas.findIndex((p, i) => i > paradaIdx && !p.completada);
    if (nextIdx >= 0) setParadaIdx(nextIdx);
  }

  function confirmarLiquidacion() {
    if (!rodeoActivo) return;
    // 1. Create a venta per stop, update saldos for fiado
    for (const parada of rodeoActivo.paradas) {
      if (parada.kgEntregados <= 0) continue;
      const cliente = clientes.find((c) => c.id === parada.clienteId);
      if (!cliente) continue;
      const pKg = cliente.tipo === "menudeo" ? params.precioMenudeo : params.precioMayoreo;
      const total = +(parada.kgEntregados * pKg).toFixed(2);
      const venta: Venta = {
        id: `rv-${parada.id}`,
        fecha: rodeoActivo.fecha,
        clienteId: parada.clienteId,
        lineas: [{ kgVendidos: parada.kgEntregados, precioKg: pKg, subtotal: total }],
        total,
        formaPago: parada.fiado > 0 ? "99" : "01",
        cfdiEmitido: false,
        nota: `Rodeo ${rodeoActivo.fecha}`,
      };
      addVenta(venta);
      // Add fiado to client's pending balance
      if (parada.fiado > 0) {
        updateSaldo(parada.clienteId, parada.fiado);
        // Also record an abono placeholder noting the partial cobrado (for audit)
        if (parada.cobrado > 0) {
          const ab: AbonoCartera = {
            id: `ab-rv-${parada.id}`,
            fecha: rodeoActivo.fecha,
            clienteId: parada.clienteId,
            monto: parada.cobrado,
            nota: `Cobrado en rodeo (${parada.kgEntregados} kg)`,
          };
          addAbono(ab);
        }
      }
    }
    // 2. Finalize the rodeo
    liquidarRodeo(efectivoIngresado);
    setLiquidarOpen(false);
    setEfectivoIngresado(0);
  }

  // ── Toggle client selection ───────────────────────────────────────────────
  function toggleCliente(id: string) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── Render states ─────────────────────────────────────────────────────────

  // ── No active rodeo ───────────────────────────────────────────────────────
  if (!rodeoActivo) {
    return (
      <div>
        <PageHeader
          title="Rodeo"
          subtitle="Gestión de ruta de entrega del día"
          actions={
            <Button onClick={() => setConfigOpen(true)}>
              <IconPlus size={16} /> Nuevo Rodeo
            </Button>
          }
        />

        <ModuleIntro
          id="rodeo"
          title="Cómo funciona el Rodeo"
          description="Planifica la ruta del día, registra kg entregados y cobrado/fiado en cada parada desde el celular. Al liquidar, las ventas se registran automáticamente y el fiado va a Cartera."
          connections={["Descuenta: Inventario de tortillas", "Alimenta: Ventas, Cartera (fiado)"]}
        />

        {historial.length === 0 ? (
          <Card className="p-10 text-center">
            <div className="mb-3 text-4xl">🛺</div>
            <p className="text-lg font-bold mb-1" style={{ color: "var(--ink)" }}>
              Sin rodeos registrados
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--ink-muted)" }}>
              Crea el rodeo del día, selecciona los clientes y sal a repartir.
            </p>
            <Button onClick={() => setConfigOpen(true)}>
              <IconPlus size={16} /> Crear Rodeo del Día
            </Button>
          </Card>
        ) : (
          <>
            <SectionTitle className="mb-2">Historial de rodeos</SectionTitle>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#faf6ee", color: "var(--ink-muted)" }}>
                      <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                      <th className="px-3 py-2 text-right font-semibold">Paradas</th>
                      <th className="px-3 py-2 text-right font-semibold">Kg entregados</th>
                      <th className="px-3 py-2 text-right font-semibold">Cobrado</th>
                      <th className="px-3 py-2 text-right font-semibold">Fiado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((r) => {
                      const kgTot = r.paradas.reduce((a, p) => a + p.kgEntregados, 0);
                      const cobTot = r.paradas.reduce((a, p) => a + p.cobrado, 0);
                      const fiadTot = r.paradas.reduce((a, p) => a + p.fiado, 0);
                      return (
                        <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                          <td className="px-3 py-2 font-medium">{r.fecha}</td>
                          <td className="px-3 py-2 text-right">{r.paradas.length}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{kgTot.toFixed(1)} kg</td>
                          <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--success)" }}>{mxn(cobTot)}</td>
                          <td className="px-3 py-2 text-right tabular-nums" style={{ color: fiadTot > 0 ? "var(--terracota)" : "var(--ink-muted)" }}>{mxn(fiadTot)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* Config modal */}
        <Modal open={configOpen} onClose={() => setConfigOpen(false)} title="Configurar Rodeo del Día">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium" style={{ color: "var(--ink-muted)" }}>Fecha</span>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded-lg px-2.5 py-1.5 text-sm focus:outline-none"
                  style={{ border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }}
                />
              </label>
              <NumberField label="Kg cargados en camión" value={kgCargados} onChange={setKgCargados} suffix="kg" min={0} />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium" style={{ color: "var(--ink-muted)" }}>
                Clientes en ruta ({seleccionados.length} seleccionados)
              </p>
              <div className="max-h-64 overflow-y-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
                {clientesRuta.length === 0 ? (
                  <p className="p-4 text-sm text-center" style={{ color: "var(--ink-muted)" }}>
                    No hay clientes con zona registrada. Agrégales dirección en Clientes.
                  </p>
                ) : (
                  clientesRuta.map((c) => {
                    const sel = seleccionados.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCliente(c.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                        style={{
                          borderBottom: "1px solid var(--line)",
                          background: sel ? "var(--maiz-light)" : "transparent",
                        }}
                      >
                        <span
                          className="grid h-5 w-5 shrink-0 place-items-center rounded"
                          style={{
                            border: sel ? "none" : "1.5px solid var(--line)",
                            background: sel ? "var(--maiz)" : "transparent",
                          }}
                        >
                          {sel && <IconCheck size={12} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-medium text-sm truncate" style={{ color: "var(--ink)" }}>
                            {c.nombre}
                          </span>
                          <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>
                            {c.zona ? `${c.zona} · ` : ""}{c.kgHabituales ? `${c.kgHabituales} kg` : "sin kg habitual"}
                          </span>
                        </span>
                        {c.saldoPendiente > 0 && (
                          <Badge tone="warning">{mxn(c.saldoPendiente)}</Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setConfigOpen(false)}>Cancelar</Button>
              <Button onClick={iniciar} disabled={seleccionados.length === 0 || !fecha}>
                <IconTruck size={16} /> Iniciar Rodeo ({seleccionados.length})
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ── Rodeo en curso — lista de todas las paradas ───────────────────────────
  if (verLista) {
    return (
      <div>
        <PageHeader
          title="Rodeo en curso"
          subtitle={rodeoActivo.fecha}
          actions={
            <Button variant="ghost" onClick={() => setVerLista(false)}>
              ← Volver a ruta
            </Button>
          }
        />
        <div className="mb-4">
          <ProgressBar value={completadas} max={paradas.length} />
        </div>
        <Card className="overflow-hidden">
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            {paradas.map((p, i) => {
              const c = clientes.find((cl) => cl.id === p.clienteId);
              return (
                <button
                  key={p.id}
                  onClick={() => { setParadaIdx(i); setVerLista(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#faf6ee]"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold"
                    style={{
                      background: p.completada ? "var(--maiz)" : (i === paradaIdx ? "var(--maiz-light)" : "#f3efe6"),
                      color: p.completada ? "var(--ink)" : "var(--ink-muted)",
                    }}
                  >
                    {p.completada ? <IconCheck size={14} /> : i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold" style={{ color: "var(--ink)" }}>{c?.nombre}</span>
                    <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>
                      {c?.zona}{c?.direccion ? ` · ${c.direccion}` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    {p.completada ? (
                      <span>
                        <span className="block text-sm font-semibold" style={{ color: "var(--success)" }}>{p.kgEntregados > 0 ? `${p.kgEntregados} kg` : "Salteado"}</span>
                        {p.fiado > 0 && <span className="block text-xs" style={{ color: "var(--terracota)" }}>Fiado {mxn(p.fiado)}</span>}
                      </span>
                    ) : (
                      <Badge tone={i === paradaIdx ? "accent" : "default"}>
                        {i === paradaIdx ? "Actual" : `${p.kgSugeridos} kg`}
                      </Badge>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
        {todasCompletadas && (
          <div className="mt-4">
            <Button onClick={() => { setLiquidarOpen(true); setEfectivoIngresado(resumenRodeo?.cobradoTotal ?? 0); }} className="w-full justify-center py-3 text-base">
              Ir a Liquidar
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Rodeo en curso — parada actual (vista mobile) ─────────────────────────
  if (!todasCompletadas && paradaActual) {
    const cl = clientes.find((c) => c.id === paradaActual.clienteId);
    const sugerido = paradaActual.kgSugeridos;
    const saldoCl = cl?.saldoPendiente ?? 0;

    return (
      <div>
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>En Ruta</h1>
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>{rodeoActivo.fecha}</p>
          </div>
          <Button variant="ghost" onClick={() => setVerLista(true)}>Ver lista</Button>
        </div>

        <div className="mb-3">
          <ProgressBar value={completadas} max={paradas.length} />
        </div>

        {/* Client card */}
        <Card className="p-5 mb-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--ink-muted)" }}>
                Parada {paradaIdx + 1} de {paradas.length}
              </p>
              <h2 className="text-2xl font-bold leading-tight" style={{ color: "var(--ink)" }}>{cl?.nombre}</h2>
            </div>
            {saldoCl > 0 && <Badge tone="warning">Debe {mxn(saldoCl)}</Badge>}
          </div>
          {cl?.direccion && (
            <p className="flex items-center gap-1 text-sm mt-1" style={{ color: "var(--ink-muted)" }}>
              <IconMapPin size={13} /> {cl.direccion}
            </p>
          )}
          {sugerido > 0 && (
            <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
              Habitual: <strong style={{ color: "var(--ink)" }}>{sugerido} kg</strong>
            </p>
          )}
        </Card>

        {/* Delivery form */}
        <Card className="p-5 mb-4 grid gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: "var(--ink-muted)" }}>
              Kg entregados
            </label>
            <div className="flex items-center gap-2">
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl font-bold transition-colors"
                style={{ border: "1px solid var(--line)", background: "var(--card)" }}
                onClick={() => {
                  const next = Math.max(0, kgForm - (kgForm >= 10 ? 5 : 1));
                  setKgForm(next);
                  setCobradoForm(next * precioActual);
                }}
              >
                −
              </button>
              <input
                type="number"
                value={kgForm}
                min={0}
                step={1}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value));
                  setKgForm(v);
                  setCobradoForm(v * precioActual);
                }}
                className="flex-1 text-center text-3xl font-bold rounded-xl px-3 py-2 focus:outline-none tabular-nums"
                style={{ border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }}
              />
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl font-bold transition-colors"
                style={{ border: "1px solid var(--line)", background: "var(--card)" }}
                onClick={() => {
                  const next = kgForm + (kgForm >= 10 ? 5 : 1);
                  setKgForm(next);
                  setCobradoForm(next * precioActual);
                }}
              >
                +
              </button>
            </div>
            <p className="text-center text-sm mt-1" style={{ color: "var(--ink-muted)" }}>
              Total: <strong>{mxn(totalActual)}</strong> a {mxn(precioActual)}/kg
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--success)" }}>Cobrado $</label>
              <input
                type="number"
                value={cobradoForm}
                min={0}
                step={0.5}
                onChange={(e) => setCobradoForm(Math.min(totalActual, Math.max(0, Number(e.target.value))))}
                className="w-full rounded-xl px-3 py-2.5 text-right text-lg font-bold tabular-nums focus:outline-none"
                style={{ border: "2px solid var(--success)", background: "var(--card)", color: "var(--ink)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--terracota)" }}>Fiado $</label>
              <div
                className="w-full rounded-xl px-3 py-2.5 text-right text-lg font-bold tabular-nums"
                style={{ border: "2px solid var(--terracota)", background: "#fef9f6", color: "var(--terracota)" }}
              >
                {fiadoActual.toFixed(2)}
              </div>
            </div>
          </div>
        </Card>

        {/* Action buttons */}
        <div className="grid gap-2">
          <button
            onClick={marcarEntregado}
            disabled={kgForm === 0}
            className="w-full py-4 rounded-2xl text-lg font-bold flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
            style={{ background: "var(--maiz)", color: "var(--ink)" }}
          >
            <IconCheck size={22} /> Entregado
          </button>
          <div className="flex gap-2">
            <button
              onClick={saltear}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors"
              style={{ border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink-muted)" }}
            >
              Saltear parada
            </button>
            <button
              onClick={() => {
                if (confirm("¿Cancelar el rodeo? Se perderá el progreso.")) cancelarRodeo();
              }}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors"
              style={{ border: "1px solid var(--terracota)", background: "var(--card)", color: "var(--terracota)" }}
            >
              Cancelar rodeo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Todas completadas — liquidar ───────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Liquidar Rodeo" subtitle={rodeoActivo.fecha} />

      {/* Summary stats */}
      {resumenRodeo && (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <StatCard label="Kg entregados" value={`${resumenRodeo.kgTotal.toFixed(1)} kg`} tone="accent" />
          <StatCard label="Kg de regreso" value={`${resumenRodeo.kgRegreso.toFixed(1)} kg`} />
          <StatCard label="Cobrado en ruta" value={mxn(resumenRodeo.cobradoTotal)} tone="success" />
          <StatCard label="Fiado (a cartera)" value={mxn(resumenRodeo.fiadoTotal)} tone={resumenRodeo.fiadoTotal > 0 ? "warning" : "default"} />
        </div>
      )}

      {/* Stop summary */}
      <SectionTitle className="mb-2">Resumen de paradas</SectionTitle>
      <Card className="overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#faf6ee", color: "var(--ink-muted)" }}>
                <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                <th className="px-3 py-2 text-right font-semibold">Kg</th>
                <th className="px-3 py-2 text-right font-semibold">Cobrado</th>
                <th className="px-3 py-2 text-right font-semibold">Fiado</th>
              </tr>
            </thead>
            <tbody>
              {paradas.map((p) => {
                const c = clientes.find((cl) => cl.id === p.clienteId);
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td className="px-3 py-2 font-medium">{c?.nombre}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.kgEntregados > 0 ? `${p.kgEntregados} kg` : <span style={{ color: "var(--ink-muted)" }}>Salteado</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--success)" }}>{mxn(p.cobrado)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: p.fiado > 0 ? "var(--terracota)" : "var(--ink-muted)" }}>{mxn(p.fiado)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Efectivo reconciliation */}
      <Card className="p-5 mb-5">
        <SectionTitle className="mb-3">Cuadre de caja</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-3 rounded-xl" style={{ background: "#f3efe6" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ink-muted)" }}>
              Efectivo esperado
            </p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--success)" }}>
              {mxn(resumenRodeo?.cobradoTotal ?? 0)}
            </p>
          </div>
          <div>
            <NumberField
              label="Efectivo recibido en caja"
              value={efectivoIngresado}
              onChange={setEfectivoIngresado}
              suffix="$"
              min={0}
              step={0.5}
            />
            {resumenRodeo && efectivoIngresado !== resumenRodeo.cobradoTotal && (
              <p className="mt-1 text-sm font-semibold" style={{ color: efectivoIngresado > resumenRodeo.cobradoTotal ? "var(--success)" : "var(--terracota)" }}>
                {efectivoIngresado > resumenRodeo.cobradoTotal
                  ? `+${mxn(efectivoIngresado - resumenRodeo.cobradoTotal)} de sobra`
                  : `${mxn(efectivoIngresado - resumenRodeo.cobradoTotal)} de diferencia`}
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        <button
          onClick={() => setVerLista(true)}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold"
          style={{ border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink-muted)" }}
        >
          Revisar paradas
        </button>
        <button
          onClick={confirmarLiquidacion}
          className="flex-1 py-4 rounded-2xl text-lg font-bold transition-colors"
          style={{ background: "var(--maiz)", color: "var(--ink)" }}
        >
          Liquidar y Registrar Ventas
        </button>
      </div>

      {/* Unused liquidarOpen modal — keep for future use */}
      <Modal open={liquidarOpen} onClose={() => setLiquidarOpen(false)} title="Confirmar liquidación">
        <div className="grid gap-3">
          <NumberField label="Efectivo recibido" value={efectivoIngresado} onChange={setEfectivoIngresado} suffix="$" />
          <div className="flex gap-2 mt-2">
            <Button variant="ghost" onClick={() => setLiquidarOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarLiquidacion}>Confirmar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
