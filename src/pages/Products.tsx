import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2, Pencil, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, isPast } from "date-fns";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  category_id: string | null;
  unit_measure: string;
  min_stock: number | null;
  expiry_date: string | null;
  current_stock?: number;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    category_id: "",
    unit_measure: "un",
    min_stock: "0",
    expiry_date: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [prodRes, catRes, stockRes] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("categories").select("id, name").order("name"),
      supabase.from("stock").select("product_id, quantity"),
    ]);
    const stockMap = new Map<string, number>();
    (stockRes.data ?? []).forEach((s: { product_id: string; quantity: number }) => {
      stockMap.set(s.product_id, (stockMap.get(s.product_id) ?? 0) + s.quantity);
    });
    const productsWithStock = ((prodRes.data ?? []) as Product[]).map((p) => ({
      ...p,
      current_stock: stockMap.get(p.id) ?? 0,
    }));
    setProducts(productsWithStock);
    setCategories(catRes.data ?? []);
    setLoading(false);
  }

  function openNew() {
    setEditId(null);
    setForm({ name: "", sku: "", category: "", category_id: "", unit_measure: "un", min_stock: "0", expiry_date: "" });
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditId(p.id);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      category: p.category ?? "",
      category_id: p.category_id ?? "",
      unit_measure: p.unit_measure,
      min_stock: String(p.min_stock ?? 0),
      expiry_date: p.expiry_date ?? "",
    });
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      sku: form.sku || null,
      category: form.category || null,
      category_id: form.category_id || null,
      unit_measure: form.unit_measure,
      min_stock: Number(form.min_stock),
      expiry_date: form.expiry_date || null,
    };

    if (editId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editId);
      if (error) toast.error(error.message);
      else toast.success("Produto atualizado!");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Produto cadastrado!");
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja excluir este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Produto excluído!"); load(); }
  }

  function expiryBadge(expiry_date: string | null) {
    if (!expiry_date) return null;
    const date = new Date(expiry_date);
    const days = differenceInDays(date, new Date());
    if (isPast(date)) return <Badge variant="destructive">Vencido</Badge>;
    if (days <= 7) return <Badge className="bg-destructive/80 text-white">Vence em {days}d</Badge>;
    if (days <= 30) return <Badge className="bg-warning text-white">Vence em {days}d</Badge>;
    return <Badge variant="outline" className="text-success border-success/40">{format(date, "dd/MM/yyyy")}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo Produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(v) => {
                    const cat = categories.find((c) => c.id === v);
                    setForm({ ...form, category_id: v, category: cat?.name ?? "" });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unidade de Medida</Label>
                  <Input value={form.unit_measure} onChange={(e) => setForm({ ...form, unit_measure: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Estoque Mínimo</Label>
                  <Input type="number" min="0" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><CalendarClock className="h-4 w-4" /> Data de Validade</Label>
                <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editId ? "Salvar" : "Cadastrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : products.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Nenhum produto cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoria</TableHead>
                   <TableHead>Medida</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Mín.</TableHead>
                    <TableHead>Validade</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku ?? "—"}</TableCell>
                    <TableCell>{p.category ?? "—"}</TableCell>
                    <TableCell>{p.unit_measure}</TableCell>
                    <TableCell className={`font-bold ${(p.current_stock ?? 0) === 0 ? "text-destructive" : (p.current_stock ?? 0) <= (p.min_stock ?? 0) ? "text-warning" : ""}`}>
                      {p.current_stock ?? 0}
                    </TableCell>
                    <TableCell>{p.min_stock ?? 0}</TableCell>
                    <TableCell>{expiryBadge(p.expiry_date)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
