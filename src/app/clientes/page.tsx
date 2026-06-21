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
  Select,
  TextInput,
  Badge,
  EmptyState,
} from "@/components/ui";
import { ModuleIntro } from "@/components/ModuleIntro";
import { IconPlus, IconMapPin } from "@/components/Icons";
import { useClientes } from "@/lib/clientesStore";
import { useVentas } from "@/lib/ventasStore";
import { mxn } from "@/lib/engine";
import type { Cliente, TipoCliente } from "@/lib/types";

export default function ClientesPage() {
  const { clientes, addCliente, updateCliente, darDeBaja, updateSaldo } = useClientes();
  const { ventas } = useVentas();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [pagoOpen, setPagoOpen] = useState<string | null>(null);
  const [pagoMonto, setPagoMonto] = useState(0);

  // Form state (shared for alta y edición)
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCliente>("mayoreo");
  const [rfc, setRfc] = useState("");
  const [tel, setTel] = useState("");
  const [direccion, setDireccion] = useState("");
  const [zona, setZona] = useState("");
  const [kgHabituales, setKgHabituales] = useState(0);

  const totalSaldo = clientes.reduce((a, c) => a + c.saldoPendiente, 0);
  const activos = clientes.filter((c) => c.activo).length;
  const conDeuda = clientes.filter((c) => c.saldoPendiente > 0).length;

  const ventasCliente = useMemo(() => {
    if (!detalle) return [];
    return ventas.filter((v) => v.clienteId === detalle).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [detalle, ventas]);

  function resetForm() {
    setNombre(""); setTipo("mayoreo"); setRfc(""); setTel("");
    setDireccion(""); setZona(""); setKgHabituales(0);
    setEditId(null);
  }

  function abrirEdicion(c: Cliente) {
    setNombre(c.nombre); setTipo(c.tipo); setRfc(c.rfc); setTel(c.telefono ?? "");
    setDireccion(c.direccion ?? ""); setZona(c.zona ?? ""); setKgHabituales(c.kgHabituales ?? 0);
    setEditId(c.id); setOpen(true);
  }

  function guardar() {
    if (!nombre.trim()) return;
    const campos = {
      nombre: nombre.trim(),
      tipo,
      rfc: rfc.trim() || "XAXX010101000",
      telefono: tel.trim() || undefined,
      direccion: direccion.trim() || undefined,
      zona: zona.trim() || undefined,
      kgHabituales: kgHabituales > 0 ? kgHabituales : undefined,
    };
    if (editId) {
      updateCliente(editId, campos);
    } else {
      const nuevo: Cliente = { id: `cl-${Date.now()}`, saldoPendiente: 0, activo: true, ...campos };
      addCliente(nuevo);
    }
    setOpen(false);
    resetForm();
  }

  function registrarPago() {
    if (pagoOpen && pagoMonto > 0) updateSaldo(pagoOpen, -pagoMonto);
    setPagoOpen(null); setPagoMonto(0);
  }

  const detalleCliente = clientes.find((c) => c.id === detalle);

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Catálogo de clientes, saldos y datos de entrega"
        actions={
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <IconPlus size={16} /> Alta Cliente
          </Button>
        }
      />

      <ModuleIntro
        id="clientes"
        title="Cómo funciona este módulo"
        description="Administra tus clientes de menudeo y mayoreo, su dirección y zona de entrega, el kg habitual por visita y el saldo pendiente de ventas a crédito. Haz clic en un cliente para ver su historial."
        connections={["Recibe de: Ventas y Rodeo (saldo)", "Alimenta: Cartera, Rodeo, Impuestos"]}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Clientes activos" value={String(activos)} tone="accent" />
        <StatCard label="Saldo total por cobrar" value={mxn(totalSaldo)} tone={totalSaldo > 0 ? "danger" : "success"} />
        <StatCard label="Clientes con deuda" value={String(conDeuda)} tone={conDeuda > 0 ? "warning" : "default"} />
      </div>

      <SectionTitle className="mb-2">Catálogo</SectionTitle>
      {clientes.length === 0 ? (
        <EmptyState message="No hay clientes registrados." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#faf6ee", color: "var(--ink-muted)" }}>
                  <th className="px-3 py-2 text-left font-semibold">Nombre</th>
                  <th className="px-3 py-2 text-left font-semibold">Zona</th>
                  <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                  <th className="px-3 py-2 text-right font-semibold">Kg/día</th>
                  <th className="px-3 py-2 text-right font-semibold">Saldo</th>
                  <th className="px-3 py-2 text-left font-semibold">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td className="px-3 py-2">
                      <button onClick={() => setDetalle(c.id)} className="font-medium hover:underline text-left" style={{ color: "var(--ink)" }}>
                        {c.nombre}
                      </button>
                      {c.direccion && (
                        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--ink-muted)" }}>
                          <IconMapPin size={11} /> {c.direccion}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm" style={{ color: "var(--ink-muted)" }}>{c.zona ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={c.tipo === "mayoreo" ? "accent" : "default"}>{c.tipo}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.kgHabituales ? `${c.kgHabituales} kg` : "—"}</td>
                    <td
                      className="px-3 py-2 text-right tabular-nums font-semibold"
                      style={{ color: c.saldoPendiente > 0 ? "var(--terracota)" : "var(--ink)" }}
                    >
                      {mxn(c.saldoPendiente)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={c.activo ? "success" : "default"}>{c.activo ? "Activo" : "Baja"}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        {c.saldoPendiente > 0 && (
                          <Button variant="ghost" onClick={() => { setPagoOpen(c.id); setPagoMonto(c.saldoPendiente); }}>
                            Abonar
                          </Button>
                        )}
                        {c.id !== "pub-gen" && (
                          <Button variant="ghost" onClick={() => abrirEdicion(c)}>Editar</Button>
                        )}
                        {c.activo && c.id !== "pub-gen" && (
                          <Button variant="danger" onClick={() => darDeBaja(c.id)}>Baja</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Alta / Edición cliente */}
      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title={editId ? "Editar Cliente" : "Alta de Cliente"}>
        <div className="grid gap-3">
          <TextInput label="Nombre" value={nombre} onChange={setNombre} placeholder="Nombre del cliente" />
          <Select
            label="Tipo"
            value={tipo}
            onChange={(v) => setTipo(v as TipoCliente)}
            options={[
              { value: "menudeo", label: "Menudeo" },
              { value: "mayoreo", label: "Mayoreo" },
            ]}
          />
          <TextInput label="RFC" value={rfc} onChange={setRfc} placeholder="XAXX010101000" />
          <TextInput label="Teléfono" value={tel} onChange={setTel} placeholder="Opcional" />
          <TextInput label="Dirección de entrega" value={direccion} onChange={setDireccion} placeholder="Calle, número, colonia" />
          <TextInput label="Zona / Ruta" value={zona} onChange={setZona} placeholder="Ej: Centro, Norte, Sur" />
          <NumberField label="Kg habituales por visita" value={kgHabituales} onChange={setKgHabituales} suffix="kg" min={0} />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={guardar}>{editId ? "Guardar cambios" : "Guardar cliente"}</Button>
          </div>
        </div>
      </Modal>

      {/* Registrar pago */}
      <Modal open={pagoOpen !== null} onClose={() => setPagoOpen(null)} title="Registrar abono">
        <div className="grid gap-3">
          <NumberField label="Monto del abono" value={pagoMonto} onChange={setPagoMonto} suffix="$" />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPagoOpen(null)}>Cancelar</Button>
            <Button onClick={registrarPago}>Registrar</Button>
          </div>
        </div>
      </Modal>

      {/* Detalle / historial */}
      <Modal open={detalle !== null} onClose={() => setDetalle(null)} title={detalleCliente?.nombre ?? "Cliente"}>
        <div>
          <div className="mb-3 text-sm space-y-1" style={{ color: "var(--ink-muted)" }}>
            <p>RFC: {detalleCliente?.rfc}</p>
            {detalleCliente?.zona && <p>Zona: {detalleCliente.zona} · {detalleCliente.direccion}</p>}
            {detalleCliente?.kgHabituales && <p>Pedido habitual: {detalleCliente.kgHabituales} kg</p>}
            <p className="font-semibold" style={{ color: detalleCliente && detalleCliente.saldoPendiente > 0 ? "var(--terracota)" : "var(--ink)" }}>
              Saldo: {mxn(detalleCliente?.saldoPendiente ?? 0)}
            </p>
          </div>
          {ventasCliente.length === 0 ? (
            <EmptyState message="Sin ventas registradas." />
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--ink-muted)" }}>
                    <th className="px-2 py-1 text-left">Fecha</th>
                    <th className="px-2 py-1 text-right">Kg</th>
                    <th className="px-2 py-1 text-right">Total</th>
                    <th className="px-2 py-1 text-left">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasCliente.map((v) => (
                    <tr key={v.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td className="px-2 py-1">{v.fecha}</td>
                      <td className="px-2 py-1 text-right">{v.lineas.reduce((a, l) => a + l.kgVendidos, 0)}</td>
                      <td className="px-2 py-1 text-right">{mxn(v.total)}</td>
                      <td className="px-2 py-1">
                        <Badge tone={v.formaPago === "99" ? "warning" : "success"}>
                          {v.formaPago === "99" ? "Crédito" : "Contado"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
