import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MovType, typeConfig } from "./types";

interface Props {
  filterType: string;
  setFilterType: (v: string) => void;
  filterProductId: string;
  setFilterProductId: (v: string) => void;
  filterDateFrom: Date | undefined;
  setFilterDateFrom: (v: Date | undefined) => void;
  filterDateTo: Date | undefined;
  setFilterDateTo: (v: Date | undefined) => void;
  products: { id: string; name: string }[];
  onClear: () => void;
  hasFilters: boolean;
}

export function MovementFilters({
  filterType, setFilterType,
  filterProductId, setFilterProductId,
  filterDateFrom, setFilterDateFrom,
  filterDateTo, setFilterDateTo,
  products, onClear, hasFilters,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-lg">
      <div className="space-y-1.5 min-w-[140px]">
        <label className="text-xs font-medium text-muted-foreground">Tipo</label>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(["entrada", "saida", "transferencia"] as MovType[]).map((t) => (
              <SelectItem key={t} value={t}>{typeConfig[t].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 min-w-[180px]">
        <label className="text-xs font-medium text-muted-foreground">Produto</label>
        <Select value={filterProductId} onValueChange={setFilterProductId}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Data início</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-9 w-[140px] justify-start text-left font-normal", !filterDateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {filterDateFrom ? format(filterDateFrom, "dd/MM/yy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filterDateFrom} onSelect={setFilterDateFrom} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Data fim</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-9 w-[140px] justify-start text-left font-normal", !filterDateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {filterDateTo ? format(filterDateTo, "dd/MM/yy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filterDateTo} onSelect={setFilterDateTo} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
          </PopoverContent>
        </Popover>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-9">
          <X className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
      )}
    </div>
  );
}
