import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious, PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
  Loader2, Plus, Trash2, PackagePlus, ClipboardList, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Movement, MovType, DetailItem, typeConfig, newItem } from "@/components/movements/types";
import { MovementFilters } from "@/components/movements/MovementFilters";
import { DeleteMovementDialog } from "@/components/movements/DeleteMovementDialog";

const iconMap: Record<MovType, React.ElementType> = {
  entrada: ArrowDownCircle,
  saida: ArrowUpCircle,
  transferencia: ArrowLeftRight,
};

const ITEMS_PER_PAGE = 15;

export default function Movements() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // New movement form
  const [type, setType] = useState<MovType>("entrada");
  const [unitId, setUnitId] = useState("");
  const [destUnitId, setDestUnitId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DetailItem[]>([newItem()]);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterProductId, setFilterProductId] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Delete dialog
  const [deleteMovement, setDeleteMovement] = useState<Movement | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [movRes, prodRes, unitRes] = await Promise.all([
      supabase
        .from("movements")
        .select("*, products(name), unit:units!movements_unit_id_fkey(name), destination_unit:units!movements_destination_unit_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("products").select("id, name").order("name"),
      supabase.from("units").select("id, name").order("name"),
    ]);
    setMovements((movRes.data ?? []) as unknown as Movement[]);
    setProducts(prodRes.data ?? []);
    setUnits(unitRes.data ?? []);
    setLoading(false);
  }

  // Filtered movements
  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (filterType !== "all" && m.type !== filterType) return false;
      if (filterProductId !== "all" && m.product_id !== filterProductId) return false;
      if (filterDateFrom) {
        const d = new Date(m.created_at);
        if (d < startOfDay(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const d = new Date(m.created_at);
        if (d > endOfDay(filterDateTo)) return false;
      }
      return true;
    });
  }, [movements, filterType, filterProductId, filterDateFrom, filterDateTo]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filterType, filterProductId, filterDateFrom, filterDateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const hasFilters = filterType !== "all" || filterProductId !== "all" || !!filterDateFrom || !!filterDateTo;

  function clearFilters() {
    setFilterType("all"); setFilterProductId("all");
    setFilterDateFrom(undefined); setFilterDateTo(undefined);
  }

  // Item helpers
  function addItem() { setItems((prev) => [...prev, newItem()]); }
  function removeItem(id: string) { setItems((prev) => prev.filter((i) => i.id !== id)); }
  function updateItem(id: string, field: keyof Omit<DetailItem, "id">, value: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  function resetForm() {
    setType("entrada"); setUnitId(""); setDestUnitId(""); setNotes("");
    setItems([newItem()]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const validItems = items.filter((i) => i.product_id && i.quantity && Number(i.quantity) > 0);
    if (validItems.length === 0) { toast.error("Adicione pelo menos um produto com quantidade válida."); return; }
    if (!unitId) { toast.error("Selecione a unidade."); return; }
    if (type === "transferencia" && !destUnitId) { toast.error("Selecione a unidade de destino."); return; }
    const productIds = validItems.map((i) => i.product_id);
    if (new Set(productIds).size !== productIds.length) { toast.error("Há produtos duplicados."); return; }

    setSaving(true);
    const payload = validItems.map((item) => ({
      product_id: item.product_id, unit_id: unitId, type, quantity: Number(item.quantity),
      notes: notes || null, user_id: user.id,
      ...(type === "transferencia" ? { destination_unit_id: destUnitId } : {}),
    }));
    const { error } = await supabase.from("movements").insert(payload as never);
    if (error) {
      toast.error(error.message.includes("insuficiente") ? "Estoque insuficiente!" : error.message);
    } else {
      toast.success(`${validItems.length} item(s) registrado(s)!`);
      resetForm(); setShowForm(false); load();
    }
    setSaving(false);
  }

  const cfg = typeConfig[type];
  const TypeIcon = iconMap[type];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Movimentações</h1>
          <p className="text-sm text-muted-foreground mt-1">Registre entradas, saídas e transferências de múltiplos produtos</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Movimentação
          </Button>
        )}
      </div>

      {/* ── FORM MESTRE-DETALHE ── */}
      {showForm && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackagePlus className="h-5 w-5 text-primary" />
              Nova Movimentação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="bg-muted/40 rounded-xl p-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cabeçalho</p>
                <div className="flex gap-2">
                  {(["entrada", "saida", "transferencia"] as MovType[]).map((t) => {
                    const c = typeConfig[t]; const Icon = iconMap[t]; const active = type === t;
                    return (
                      <button key={t} type="button" onClick={() => { setType(t); setDestUnitId(""); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          active ? `${c.bgColor} ${c.borderColor} ${c.color}` : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40"
                        }`}>
                        <Icon className="h-4 w-4" />{c.label}
                      </button>
                    );
                  })}
                </div>
                <div className={`grid gap-4 ${type === "transferencia" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                  <div className="space-y-1.5">
                    <Label>{type === "transferencia" ? "Unidade Origem *" : "Unidade *"}</Label>
                    <Select value={unitId} onValueChange={setUnitId} required>
                      <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                      <SelectContent>{units.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  {type === "transferencia" && (
                    <div className="space-y-1.5">
                      <Label>Unidade Destino *</Label>
                      <Select value={destUnitId} onValueChange={setDestUnitId} required>
                        <SelectTrigger><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
                        <SelectContent>{units.filter((u) => u.id !== unitId).map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais (opcional)" rows={2} />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Itens ({items.length})</p>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Produto</Button>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[60%]">Produto *</TableHead>
                        <TableHead className="w-[30%]">Quantidade *</TableHead>
                        <TableHead className="w-[10%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="py-2">
                            <Select value={item.product_id} onValueChange={(v) => updateItem(item.id, "product_id", v)}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                              <SelectContent>{products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-2">
                            <Input type="number" min="1" step="1" placeholder="0" value={item.quantity}
                              onChange={(e) => updateItem(item.id, "quantity", e.target.value)} className="h-9" />
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {items.length > 1 && (
                  <p className="text-xs text-muted-foreground text-right">
                    {items.filter((i) => i.product_id && i.quantity).length} de {items.length} itens preenchidos
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TypeIcon className="mr-2 h-4 w-4" />}
                  {saving ? "Registrando..." : `Confirmar ${cfg.label}`}
                </Button>
                <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false); }} disabled={saving}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── HISTÓRICO ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" />
            Histórico de Movimentações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MovementFilters
            filterType={filterType} setFilterType={setFilterType}
            filterProductId={filterProductId} setFilterProductId={setFilterProductId}
            filterDateFrom={filterDateFrom} setFilterDateFrom={setFilterDateFrom}
            filterDateTo={filterDateTo} setFilterDateTo={setFilterDateTo}
            products={products} onClear={clearFilters} hasFilters={hasFilters}
          />

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              {hasFilters ? "Nenhuma movimentação encontrada com os filtros aplicados." : "Nenhuma movimentação registrada."}
            </p>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Obs</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((m) => {
                      const c = typeConfig[m.type] ?? typeConfig.entrada;
                      const Icon = iconMap[m.type] ?? ArrowDownCircle;
                      return (
                        <TableRow key={m.id}>
                          <TableCell>
                            <Badge className={`gap-1 text-xs font-medium border ${c.bgColor} ${c.color} ${c.borderColor}`} variant="outline">
                              <Icon className="h-3 w-3" />{c.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{m.products?.name}</TableCell>
                          <TableCell className="font-semibold tabular-nums">{m.quantity}</TableCell>
                          <TableCell className="text-sm">{m.unit?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{m.destination_unit?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(m.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">{m.notes ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => navigate(`/movements/${m.id}/edit`)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteMovement(m)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("ellipsis");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === "ellipsis" ? (
                            <PaginationItem key={`e-${idx}`}><PaginationEllipsis /></PaginationItem>
                          ) : (
                            <PaginationItem key={item}>
                              <PaginationLink
                                isActive={currentPage === item}
                                onClick={() => setCurrentPage(item as number)}
                                className="cursor-pointer"
                              >
                                {item}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <DeleteMovementDialog
        movement={deleteMovement} open={!!deleteMovement}
        onOpenChange={(open) => { if (!open) setDeleteMovement(null); }}
        onDeleted={load}
      />
    </div>
  );
}
