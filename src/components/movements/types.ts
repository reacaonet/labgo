export type MovType = "entrada" | "saida" | "transferencia";

export interface Movement {
  id: string;
  type: MovType;
  quantity: number;
  notes: string | null;
  created_at: string;
  product_id: string;
  unit_id: string;
  destination_unit_id: string | null;
  user_id: string;
  products: { name: string } | null;
  unit: { name: string } | null;
  destination_unit: { name: string } | null;
}

export interface DetailItem {
  id: string;
  product_id: string;
  quantity: string;
}

export const typeConfig: Record<MovType, { label: string; color: string; bgColor: string; borderColor: string }> = {
  entrada: { label: "Entrada", color: "text-success", bgColor: "bg-success/10", borderColor: "border-success/30" },
  saida: { label: "Saída", color: "text-warning", bgColor: "bg-warning/10", borderColor: "border-warning/30" },
  transferencia: { label: "Transferência", color: "text-primary", bgColor: "bg-primary/10", borderColor: "border-primary/30" },
};

export function newItem(): DetailItem {
  return { id: crypto.randomUUID(), product_id: "", quantity: "" };
}
