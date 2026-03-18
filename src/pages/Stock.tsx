import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, PackageSearch, Pencil } from "lucide-react";
import { toast } from "sonner";

interface StockRow {
  id: string;
  quantity: number;
  updated_at: string;
  product_id: string;
  unit_id: string;
  products: { name: string; min_stock: number | null; sku: string | null; category_id: string | null } | null;
  units: { name: string } | null;
}

export default function Stock() {
  const { user } = useAuth();
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Adjust dialog
  const [adjustItem, setAdjustItem] = useState<StockRow | null>(null);
  const [newQty, setNewQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("stock")
      .select("*, products(name, min_stock, sku, category_id), units(name)")
      .order("updated_at", { ascending: false });
    setStock((data ?? []) as StockRow[]);
    setLoading(false);
  }

  const filtered = stock.filter((s) =>
    s.products?.name.toLowerCase().includes(search.toLowerCase()) ||
    s.units?.name.toLowerCase().includes(search.toLowerCase()) ||
    s.products?.sku?.toLowerCase().includes(search.toLowerCase())
  );

  function getStockStatus(s: StockRow) {
    if (!s.products?.min_stock) return "ok";
    if (s.quantity === 0) return "empty";
    if (s.quantity <= s.products.min_stock) return "low";
    return "ok";
  }

  const statusBadge: Record<string, JSX.Element> = {
    ok: <Badge variant="outline" className="text-success border-success/40">Normal</Badge>,
    low: <Badge variant="outline" className="text-warning border-warning/40">Baixo</Badge>,
    empty: <Badge variant="destructive">Zerado</Badge>,
  };

  function openAdjust(s: StockRow) {
    setAdjustItem(s);
    setNewQty(String(s.quantity));
    setAdjustNotes("");
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustItem || !user) return;
    const target = Number(newQty);
    if (isNaN(target) || target < 0) { toast.error("Quantidade inválida."); return; }
    const diff = target - adjustItem.quantity;
    if (diff === 0) { toast.info("Nenhuma alteração."); setAdjustItem(null); return; }

    setSaving(true);
    const movType = diff > 0 ? "entrada" : "saida";
    const { error } = await supabase.from("movements").insert({
      product_id: adjustItem.product_id,
      unit_id: adjustItem.unit_id,
      type: movType,
      quantity: Math.abs(diff),
      notes: adjustNotes || `Ajuste de inventário (${adjustItem.quantity} → ${target})`,
      user_id: user.id,
    } as never);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Estoque ajustado: ${adjustItem.quantity} → ${target}`);
      setAdjustItem(null);
      load();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PackageSearch className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Posição de Estoque</h1>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar produto ou unidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Nenhum item encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Mínimo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const status = getStockStatus(s);
                  return (
                    <TableRow key={s.id} className={status === "empty" ? "bg-destructive/5" : status === "low" ? "bg-warning/5" : ""}>
                      <TableCell className="font-medium">{s.products?.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.products?.sku ?? "—"}</TableCell>
                      <TableCell>{s.units?.name}</TableCell>
                      <TableCell className={`font-bold ${status === "empty" ? "text-destructive" : status === "low" ? "text-warning" : ""}`}>
                        {s.quantity}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.products?.min_stock ?? "—"}</TableCell>
                      <TableCell>{statusBadge[status]}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => openAdjust(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Adjust Stock Dialog */}
      <Dialog open={!!adjustItem} onOpenChange={(open) => { if (!open) setAdjustItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste de Estoque</DialogTitle>
          </DialogHeader>
          {adjustItem && (
            <form onSubmit={handleAdjust} className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                <p className="font-medium">{adjustItem.products?.name}</p>
                <p className="text-sm text-muted-foreground">{adjustItem.units?.name}</p>
                <p className="text-sm">Quantidade atual: <span className="font-bold">{adjustItem.quantity}</span></p>
              </div>
              <div className="space-y-2">
                <Label>Nova Quantidade *</Label>
                <Input type="number" min="0" step="1" value={newQty}
                  onChange={(e) => setNewQty(e.target.value)} required autoFocus />
                {newQty && Number(newQty) !== adjustItem.quantity && (
                  <p className="text-xs text-muted-foreground">
                    Será registrada uma movimentação de{" "}
                    <span className={Number(newQty) > adjustItem.quantity ? "text-success font-medium" : "text-warning font-medium"}>
                      {Number(newQty) > adjustItem.quantity ? "entrada" : "saída"}
                    </span>{" "}
                    de <span className="font-medium">{Math.abs(Number(newQty) - adjustItem.quantity)}</span> unidade(s)
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Input value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Ex: Contagem de inventário" />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Ajuste
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
