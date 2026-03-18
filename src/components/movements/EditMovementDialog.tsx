import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Loader2, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Movement, MovType, typeConfig } from "./types";

const iconMap: Record<MovType, React.ElementType> = {
  entrada: ArrowDownCircle,
  saida: ArrowUpCircle,
  transferencia: ArrowLeftRight,
};

interface Props {
  movement: Movement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: { id: string; name: string }[];
  units: { id: string; name: string }[];
  onSaved: () => void;
}

export function EditMovementDialog({ movement, open, onOpenChange, products, units, onSaved }: Props) {
  const [type, setType] = useState<MovType>("entrada");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState("");
  const [destUnitId, setDestUnitId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && movement) {
      setType(movement.type);
      setProductId(movement.product_id);
      setQuantity(String(movement.quantity));
      setUnitId(movement.unit_id);
      setDestUnitId(movement.destination_unit_id ?? "");
      setNotes(movement.notes ?? "");
    }
  }, [open, movement]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!movement) return;
    if (!productId || !quantity || Number(quantity) <= 0) {
      toast.error("Preencha produto e quantidade válida."); return;
    }
    if (!unitId) { toast.error("Selecione a unidade."); return; }
    if (type === "transferencia" && !destUnitId) {
      toast.error("Selecione a unidade de destino."); return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("movements")
      .update({
        type,
        product_id: productId,
        quantity: Number(quantity),
        unit_id: unitId,
        destination_unit_id: type === "transferencia" ? destUnitId : null,
        notes: notes || null,
      } as never)
      .eq("id", movement.id);

    if (error) {
      toast.error(error.message.includes("insuficiente") ? "Estoque insuficiente!" : error.message);
    } else {
      toast.success("Movimentação atualizada!");
      onOpenChange(false);
      onSaved();
    }
    setSaving(false);
  }

  const cfg = typeConfig[type];
  const TypeIcon = iconMap[type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base">Editar Movimentação</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6">
          {/* ── CABEÇALHO ── */}
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

          {/* ── ITEM ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item</p>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[60%]">Produto *</TableHead>
                    <TableHead className="w-[40%]">Quantidade *</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="py-2">
                      <Select value={productId} onValueChange={setProductId}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                        <SelectContent>{products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2">
                      <Input type="number" min="1" step="1" placeholder="0" value={quantity}
                        onChange={(e) => setQuantity(e.target.value)} className="h-9" />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── AÇÕES ── */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TypeIcon className="mr-2 h-4 w-4" />}
              {saving ? "Salvando..." : `Confirmar ${cfg.label}`}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
