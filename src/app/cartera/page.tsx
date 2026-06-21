"use client";

import { useMemo, useState } from "react";
import {
  PageHeader,
  StatCard,
  Card,
  SectionTitle,
  Button,
  Modal,
  NumberField,
  TextInput,
  Badge,
  EmptyState,
} from "@/components/ui";
import { ModuleIntro } from "@/components/ModuleIntro";
import { useClientes } from "@/lib/clientesStore";
import { useCartera } from "@/lib/carteraStore";
import { useVentas } from "@/lib/ventasStore";
import { mxn } from "@/lib/engine";
import type { AbonoCartera } from "@/lib/types";

const TODAY = "2026-06-21";

function diasDesde(fecha: string): number {
  const ms = new Date(TODAY).getTime() - new Date(fecha).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function tonDeuda(dias: number): "success" | "warning" | "danger" {
  if (dias <= 7) return "success";
  if (dias <= 30) return "warning";
  return "danger";
}

export default function CarteraPage() {
  const { clientes, updateSaldo } = useClientes();
  const { abonos, addAbono } = useCartera();
  const { ventas } = useVentas();

  const [pagoId, setPagoId] = useState<string | null>(null);
  const [pagoMonto, setPagoMonto] = useState(0);
  const [pagaNota, setPagaNota] = useState("");

  // Clients with balance, sorted by amount desc
  const clientesConDeuda = useMemo(
    () => clientes.filter((c) => c.saldoPendiente > 0 && c.activo).sort((a, b) => b.saldoPendiente - a.saldoPendiente),
    [clientes]
  );

  // Last credit sale per client
  const ultimaVentaCredito = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of ventas) {
      if (v.formaPago !== "99") continue;
      if (!map[v.clienteId] || v.fecha > map[v.clienteId]) map[v.clienteId] = v.fecha;
    }
    return map;
  }, [ventas]);

  const totalCartera = clientesConDeuda.reduce((a, c) => a + c.saldoPendiente, 0);
  const vencida30 = clientesConDeuda.filter((c) => {
    const ultima = ultimaVentaCredito[c.id];
    return ultima ? diasDesde(ultima) > 30 : false;
  }).reduce((a, c) => a + c.saldoPendiente, 0);

  function abrirPago(clienteId: string, saldo: number) {
    setPagoId(clienteId);
    setPagoMonto(saldo);
    setPagaNota("");
  }

  function confirmarPago() {
    if (!pagoId || pagoMonto <= 0) return;
    const abono: AbonoCartera = {
      id: `ab-${Date.now()}`,
      fecha: TODAY,
      clienteId: pagoId,
      monto: pagoMonto,
      nota: pagaNota.trim() || undefined,
    };
    addAbono(abono);
    updateSaldo(pagoId, -pagoMonto);
    setPagoId(null);
  }

  // Historial de abonos enriquecido con nombre cliente
  const historialEnriquecido = useMemo(() => {
    return abonos.map((a) => ({
      ...a,
      nombreCliente: clientes.find((c) => c.id === a.clienteId)?.nombre ?? a.clienteId,
    })).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [abonos, clientes]);

  const pagoCliente = clientes.find((c) => c.id === pagoId);

  return (
    <div>
      <PageHeader
        title="Cartera"
        subtitle="Saldos por cobrar y antigüedad de deuda"
      />

      <ModuleIntro
        id="cartera"
        title="Cómo funciona este módulo"
        description="Muestra todos los clientes con saldo pendiente, cuántos días llevan sin pagar y el riesgo de cada cuenta. Registra abonos aquí o directamente desde Clientes. Las ventas a crédito del Rodeo alimentan este saldo automáticamente."
        connections={["Recibe de: Ventas (crédito), Rodeo (fiado)", "Alimenta: Clientes (saldo)"]}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total por cobrar" value={mxn(totalCartera)} tone={totalCartera > 0 ? "danger" : "success"} />
        <StatCard label="Clientes con deuda" value={String(clientesConDeuda.length)} tone={clientesConDeuda.length > 0 ? "warning" : "default"} />
        <StatCard label="Vencida +30 días" value={mxn(vencida30)} tone={vencida30 > 0 ? "danger" : "default"} />
      </div>

      <SectionTitle className="mb-2">Saldos actuales</SectionTitle>
      {clientesConDeuda.length === 0 ? (
        <EmptyState message="No hay saldos pendientes. ¡Todo cobrado!" />
      ) : (
        <Card className="overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#faf6ee", color: "var(--ink-muted)" }}>
                  <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                  <th className="px-3 py-2 text-left font-semibold">Zona</th>
                  <th className="px-3 py-2 text-right font-semibold">Saldo</th>
                  <th className="px-3 py-2 text-right font-semibold">Última compra</th>
                  <th className="px-3 py-2 text-right font-semibold">Días</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {clientesConDeuda.map((c) => {
                  const ultima = ultimaVentaCredito[c.id];
                  const dias = ultima ? diasDesde(ultima) : null;
                  return (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td className="px-3 py-2">
                        <p className="font-medium" style={{ color: "var(--ink)" }}>{c.nombre}</p>
                        {c.direccion && <p className="text-xs" style={{ color: "var(--ink-muted)" }}>{c.direccion}</p>}
                      </td>
                      <td className="px-3 py-2" style={{ color: "var(--ink-muted)" }}>{c.zona ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: "var(--terracota)" }}>
                        {mxn(c.saldoPendiente)}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--ink-muted)" }}>
                        {ultima ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {dias !== null ? (
                          <Badge tone={tonDeuda(dias)}>{dias} días</Badge>
                        ) : (
                          <span style={{ color: "var(--ink-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button onClick={() => abrirPago(c.id, c.saldoPendiente)}>Abonar</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <SectionTitle className="mb-2">Historial de abonos</SectionTitle>
      {historialEnriquecido.length === 0 ? (
        <EmptyState message="Sin abonos registrados aún." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#faf6ee", color: "var(--ink-muted)" }}>
                  <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                  <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                  <th className="px-3 py-2 text-right font-semibold">Monto</th>
                  <th className="px-3 py-2 text-left font-semibold">Nota</th>
                </tr>
              </thead>
              <tbody>
                {historialEnriquecido.map((a) => (
                  <tr key={a.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td className="px-3 py-2 tabular-nums">{a.fecha}</td>
                    <td className="px-3 py-2 font-medium">{a.nombreCliente}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: "var(--success)" }}>
                      {mxn(a.monto)}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--ink-muted)" }}>{a.nota ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal pago */}
      <Modal open={pagoId !== null} onClose={() => setPagoId(null)} title={`Abonar — ${pagoCliente?.nombre}`}>
        <div className="grid gap-3">
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Saldo actual: <strong style={{ color: "var(--terracota)" }}>{mxn(pagoCliente?.saldoPendiente ?? 0)}</strong>
          </p>
          <NumberField label="Monto del abono" value={pagoMonto} onChange={setPagoMonto} suffix="$" min={0} />
          <TextInput label="Nota (opcional)" value={pagaNota} onChange={setPagaNota} placeholder="Ej: pago en efectivo" />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPagoId(null)}>Cancelar</Button>
            <Button onClick={confirmarPago} disabled={pagoMonto <= 0}>Registrar abono</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
