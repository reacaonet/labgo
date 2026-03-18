import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  CalendarClock, TrendingDown, ShieldAlert, Activity,
} from "lucide-react";
import { differenceInDays, isPast, startOfDay, endOfDay } from "date-fns";

interface StockItem {
  product_id: string;
  unit_id: string;
  quantity: number;
  products: { name: string; min_stock: number | null } | null;
  units: { name: string } | null;
}

interface ExpiringProduct {
  id: string;
  name: string;
  expiry_date: string;
  category: string | null;
}

export default function Dashboard() {
  const [stats, setStats] = useState({ products: 0, lowStock: 0, expired: 0, todayMovements: 0 });
  const [lowStock, setLowStock] = useState<StockItem[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const today = new Date();
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();

    const [productsRes, stockRes, movRes, expRes, todayMovRes] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("stock").select("product_id, unit_id, quantity, products(name, min_stock), units(name)"),
      supabase.from("movements").select("*, products(name), unit:units!movements_unit_id_fkey(name)").order("created_at", { ascending: false }).limit(5),
      supabase.from("products").select("id, name, expiry_date, category").not("expiry_date", "is", null).order("expiry_date"),
      supabase.from("movements").select("id", { count: "exact", head: true }).gte("created_at", todayStart).lte("created_at", todayEnd),
    ]);

    const allStock = (stockRes.data ?? []) as StockItem[];
    const low = allStock.filter((s: any) => s.products?.min_stock != null && s.quantity <= s.products.min_stock);

    const allExpiring = ((expRes.data ?? []) as ExpiringProduct[]).filter((p) => {
      const days = differenceInDays(new Date(p.expiry_date), new Date());
      return days <= 30;
    });
    const expiredCount = allExpiring.filter((p) => isPast(new Date(p.expiry_date))).length;

    setStats({
      products: productsRes.count ?? 0,
      lowStock: low.length,
      expired: expiredCount,
      todayMovements: todayMovRes.count ?? 0,
    });

    setLowStock(low);
    setRecentMovements(movRes.data ?? []);
    setExpiringProducts(allExpiring);
    setLoading(false);
  }

  const kpiCards = [
    {
      label: "Total de Produtos",
      value: stats.products,
      icon: Package,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      borderColor: "border-l-primary",
      description: "cadastrados no sistema",
    },
    {
      label: "Estoque Baixo",
      value: stats.lowStock,
      icon: TrendingDown,
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
      borderColor: "border-l-warning",
      description: stats.lowStock === 0 ? "nenhum alerta" : "produto(s) abaixo do mínimo",
      alert: stats.lowStock > 0,
    },
    {
      label: "Produtos Vencidos",
      value: stats.expired,
      icon: ShieldAlert,
      iconBg: "bg-destructive/10",
      iconColor: "text-destructive",
      borderColor: "border-l-destructive",
      description: stats.expired === 0 ? "nenhum vencido" : "produto(s) expirado(s)",
      alert: stats.expired > 0,
    },
    {
      label: "Movimentações Hoje",
      value: stats.todayMovements,
      icon: Activity,
      iconBg: "bg-success/10",
      iconColor: "text-success",
      borderColor: "border-l-success",
      description: "registradas hoje",
    },
  ];

  function expiryBadge(expiry_date: string) {
    const days = differenceInDays(new Date(expiry_date), new Date());
    if (isPast(new Date(expiry_date))) return <Badge variant="destructive">Vencido</Badge>;
    if (days <= 7) return <Badge className="bg-destructive/80 text-destructive-foreground">Vence em {days}d</Badge>;
    return <Badge className="bg-warning/20 text-warning border-warning/30">Vence em {days}d</Badge>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do estoque e operações</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <Card
            key={card.label}
            className={`border-l-4 ${card.borderColor} transition-shadow hover:shadow-md`}
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                    {card.label}
                  </p>
                  <p className={`text-3xl font-extrabold mt-1 ${card.alert ? (card.iconColor) : "text-foreground"}`}>
                    {loading ? "—" : card.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{card.description}</p>
                </div>
                <div className={`rounded-xl p-2.5 ${card.iconBg} shrink-0`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Low stock */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="bg-warning/10 rounded-lg p-1.5">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              Estoque Baixo
              {lowStock.length > 0 && (
                <Badge className="ml-auto bg-warning/20 text-warning border-warning/30 text-xs">
                  {lowStock.length} alerta{lowStock.length > 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="bg-success/10 rounded-full p-3 mb-2">
                  <AlertTriangle className="h-5 w-5 text-success" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Tudo em ordem!</p>
                <p className="text-xs text-muted-foreground">Nenhum produto abaixo do estoque mínimo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lowStock.map((s) => (
                  <div key={`${s.product_id}-${s.unit_id}`} className="flex justify-between items-center text-sm py-2 border-b last:border-0">
                    <div>
                      <span className="font-medium">{s.products?.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">({s.units?.name})</span>
                    </div>
                    <Badge variant="destructive" className="text-xs font-semibold">
                      {s.quantity} un
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring products */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="bg-destructive/10 rounded-lg p-1.5">
                <CalendarClock className="h-4 w-4 text-destructive" />
              </div>
              Validade Próxima / Vencidos
              {expiringProducts.length > 0 && (
                <Badge className="ml-auto bg-destructive/10 text-destructive border-destructive/20 text-xs">
                  {expiringProducts.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringProducts.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="bg-success/10 rounded-full p-3 mb-2">
                  <CalendarClock className="h-5 w-5 text-success" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Validades OK!</p>
                <p className="text-xs text-muted-foreground">Nenhum produto vencido ou próximo do vencimento.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {expiringProducts.map((p) => (
                  <div key={p.id} className="flex justify-between items-center text-sm py-2 border-b last:border-0">
                    <div>
                      <span className="font-medium">{p.name}</span>
                      {p.category && <span className="text-muted-foreground ml-2 text-xs">({p.category})</span>}
                    </div>
                    {expiryBadge(p.expiry_date)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent movements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="bg-primary/10 rounded-lg p-1.5">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            Últimas Movimentações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="space-y-1">
              {recentMovements.map((m: any) => (
                <div key={m.id} className="flex justify-between items-center text-sm py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    {m.type === "entrada" ? (
                      <div className="bg-success/10 rounded-full p-1">
                        <ArrowDownCircle className="h-3.5 w-3.5 text-success" />
                      </div>
                    ) : m.type === "transferencia" ? (
                      <div className="bg-primary/10 rounded-full p-1">
                        <ArrowUpCircle className="h-3.5 w-3.5 text-primary" />
                      </div>
                    ) : (
                      <div className="bg-warning/10 rounded-full p-1">
                        <ArrowUpCircle className="h-3.5 w-3.5 text-warning" />
                      </div>
                    )}
                    <div>
                      <span className="font-medium">{m.products?.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground capitalize">
                        {m.type === "entrada" ? "Entrada" : m.type === "saida" ? "Saída" : "Transferência"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{m.quantity}</span>
                    <span className="text-muted-foreground ml-1 text-xs">{m.unit?.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

