-- Remove duplicate triggers, keep only trigger_handle_movement
DROP TRIGGER IF EXISTS on_movement_created ON public.movements;
DROP TRIGGER IF EXISTS on_movement_insert ON public.movements;