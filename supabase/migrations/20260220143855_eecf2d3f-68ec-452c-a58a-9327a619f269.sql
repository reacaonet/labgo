-- Criar trigger que dispara handle_movement() após cada inserção na tabela movements
CREATE TRIGGER trigger_handle_movement
  AFTER INSERT ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_movement();
