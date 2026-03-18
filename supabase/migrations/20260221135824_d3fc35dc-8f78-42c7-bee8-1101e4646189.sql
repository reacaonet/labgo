
-- Allow users to delete their own movements
CREATE POLICY "Users can delete own movements"
ON public.movements
FOR DELETE
USING (auth.uid() = user_id);

-- Update trigger to handle DELETE and reverse stock
CREATE OR REPLACE FUNCTION public.handle_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- On DELETE, reverse the movement
  IF TG_OP = 'DELETE' THEN
    IF OLD.type = 'entrada' THEN
      UPDATE public.stock SET quantity = quantity - OLD.quantity, updated_at = now()
      WHERE product_id = OLD.product_id AND unit_id = OLD.unit_id;
    ELSIF OLD.type = 'saida' THEN
      UPDATE public.stock SET quantity = quantity + OLD.quantity, updated_at = now()
      WHERE product_id = OLD.product_id AND unit_id = OLD.unit_id;
    ELSIF OLD.type = 'transferencia' THEN
      UPDATE public.stock SET quantity = quantity + OLD.quantity, updated_at = now()
      WHERE product_id = OLD.product_id AND unit_id = OLD.unit_id;
      UPDATE public.stock SET quantity = quantity - OLD.quantity, updated_at = now()
      WHERE product_id = OLD.product_id AND unit_id = OLD.destination_unit_id;
    END IF;
    RETURN OLD;
  END IF;

  -- On UPDATE, reverse the OLD movement first
  IF TG_OP = 'UPDATE' THEN
    IF OLD.type = 'entrada' THEN
      UPDATE public.stock SET quantity = quantity - OLD.quantity, updated_at = now()
      WHERE product_id = OLD.product_id AND unit_id = OLD.unit_id;
    ELSIF OLD.type = 'saida' THEN
      UPDATE public.stock SET quantity = quantity + OLD.quantity, updated_at = now()
      WHERE product_id = OLD.product_id AND unit_id = OLD.unit_id;
    ELSIF OLD.type = 'transferencia' THEN
      UPDATE public.stock SET quantity = quantity + OLD.quantity, updated_at = now()
      WHERE product_id = OLD.product_id AND unit_id = OLD.unit_id;
      UPDATE public.stock SET quantity = quantity - OLD.quantity, updated_at = now()
      WHERE product_id = OLD.product_id AND unit_id = OLD.destination_unit_id;
    END IF;
  END IF;

  -- Apply the NEW movement
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
    UPDATE public.stock SET quantity = quantity - NEW.quantity, updated_at = now()
    WHERE product_id = NEW.product_id AND unit_id = NEW.unit_id;
    INSERT INTO public.stock (product_id, unit_id, quantity)
    VALUES (NEW.product_id, NEW.destination_unit_id, NEW.quantity)
    ON CONFLICT (product_id, unit_id)
    DO UPDATE SET quantity = stock.quantity + NEW.quantity, updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate trigger to include DELETE
DROP TRIGGER IF EXISTS trigger_handle_movement ON public.movements;
CREATE TRIGGER trigger_handle_movement
  AFTER INSERT OR UPDATE OR DELETE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.handle_movement();
