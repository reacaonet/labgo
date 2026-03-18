import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Loader2, Pencil, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { MovType, typeConfig } from "@/components/movements/types";

const iconMap: Record<MovType, React.ElementType> = {
  entrada: ArrowDownCircle,
  saida: ArrowUpCircle,
  transferencia: ArrowLeftRight,
};

export default function EditMovement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<MovType>("entrada");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState("");
  const [destUnitId, setDestUnitId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function load() {
      const [movRes, prodRes, unitRes] = await Promise.all([
        supabase.from("movements").select("*").eq("id", id!).single(),
        supabase.from("products").select("id, name").order("name"),
        supabase.from("units").select("id, name").order("name"),
      ]);

      if (movRes.error || !movRes.data) {
        toast.error("Movimentação não encontrada.");
        navigate("/movements");
        return;
      }

      const m = movRes.data;
      setType(m.type as MovType);
      setProductId(m.product_id);
      setQuantity(String(m.quantity));
      setUnitId(m.unit_id);
      setDestUnitId(m.destination_unit_id ?? "");
      setNotes(m.notes ?? "");
      setProducts(prodRes.data ?? []);
      setUnits(unitRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [id, navigate]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !quantity || Number(quantity) <= 0) {
      toast.error("Preencha produto e quantidade válida.");
      return;
    }
    if (!unitId) { toast.error("Selecione a unidade."); return; }
    if (type === "transferencia" && !destUnitId) {
      toast.error("Selecione a unidade de destino.");
      return;
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
      .eq("id", id!);

    if (error) {
      toast.error(error.message.includes("insuficiente") ? "Estoque insuficiente!" : error.message);
    } else {
      toast.success("Movimentação atualizada!");
      navigate("/movements");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cfg = typeConfig[type];
  const TypeIcon = iconMap[type];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/movements")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Editar Movimentação</h1>
          <p className="text-sm text-muted-foreground mt-1">Altere os dados da movimentação</p>
        </div>
      </div>

      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Movimentação
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

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TypeIcon className="mr-2 h-4 w-4" />}
                {saving ? "Salvando..." : `Confirmar ${cfg.label}`}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/movements")} disabled={saving}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
