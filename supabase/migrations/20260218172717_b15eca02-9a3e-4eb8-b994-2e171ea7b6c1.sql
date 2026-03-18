
-- Add expiry_date to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS expiry_date date;

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage categories"
  ON public.categories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view categories"
  ON public.categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Add category_id FK to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

-- Create company_settings table
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'Minha Empresa',
  phone text,
  email text,
  address text,
  logo_url text,
  whatsapp text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage company settings"
  ON public.company_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view company settings"
  ON public.company_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert default company settings row
INSERT INTO public.company_settings (name) VALUES ('EstoqueFoods') ON CONFLICT DO NOTHING;

-- Add destination_unit_id to movements for transfers
ALTER TABLE public.movements ADD COLUMN IF NOT EXISTS destination_unit_id uuid REFERENCES public.units(id);

-- Add 'transferencia' to movement_type enum
ALTER TYPE public.movement_type ADD VALUE IF NOT EXISTS 'transferencia';

-- Update handle_movement trigger to support transfers
CREATE OR REPLACE FUNCTION public.handle_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = 'entrada' THEN
    INSERT INTO public.stock (product_id, unit_id, quantity)
    VALUES (NEW.product_id, NEW.unit_id, NEW.quantity)
    ON CONFLICT (product_id, unit_id)
    DO UPDATE SET quantity = stock.quantity + NEW.quantity, updated_at = now();

  ELSIF NEW.type = 'saida' THEN
    IF (SELECT COALESCE(quantity, 0) FROM public.stock WHERE product_id = NEW.product_id AND unit_id = NEW.unit_id) < NEW.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente';
    END IF;
    UPDATE public.stock SET quantity = quantity - NEW.quantity, updated_at = now()
    WHERE product_id = NEW.product_id AND unit_id = NEW.unit_id;

  ELSIF NEW.type = 'transferencia' THEN
    IF NEW.destination_unit_id IS NULL THEN
      RAISE EXCEPTION 'Unidade destino obrigatória para transferência';
    END IF;
    IF (SELECT COALESCE(quantity, 0) FROM public.stock WHERE product_id = NEW.product_id AND unit_id = NEW.unit_id) < NEW.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para transferência';
    END IF;
    -- Subtract from origin
    UPDATE public.stock SET quantity = quantity - NEW.quantity, updated_at = now()
    WHERE product_id = NEW.product_id AND unit_id = NEW.unit_id;
    -- Add to destination
    INSERT INTO public.stock (product_id, unit_id, quantity)
    VALUES (NEW.product_id, NEW.destination_unit_id, NEW.quantity)
    ON CONFLICT (product_id, unit_id)
    DO UPDATE SET quantity = stock.quantity + NEW.quantity, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_movement_insert ON public.movements;
CREATE TRIGGER on_movement_insert
  AFTER INSERT ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.handle_movement();
