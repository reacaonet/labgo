
-- Enum for movement types
CREATE TYPE public.movement_type AS ENUM ('entrada', 'saida');

-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Units table (matriz/filiais)
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'filial' CHECK (type IN ('matriz', 'filial')),
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  category TEXT,
  unit_measure TEXT NOT NULL DEFAULT 'un',
  min_stock NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock table (product per unit)
CREATE TABLE public.stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, unit_id)
);

-- Movements table (history)
CREATE TABLE public.movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  type movement_type NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  notes TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  unit_id UUID REFERENCES public.units(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to get user's unit
CREATE OR REPLACE FUNCTION public.get_user_unit(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit_id FROM public.profiles WHERE user_id = _user_id
$$;

-- Enable RLS on all tables
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Units policies: admin sees all, user sees own unit
CREATE POLICY "Admin can manage units" ON public.units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own unit" ON public.units FOR SELECT TO authenticated
  USING (id = public.get_user_unit(auth.uid()));

-- Products policies: all authenticated can view, admin can manage
CREATE POLICY "All can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Stock policies: admin sees all, user sees own unit
CREATE POLICY "Admin can manage stock" ON public.stock FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own unit stock" ON public.stock FOR SELECT TO authenticated
  USING (unit_id = public.get_user_unit(auth.uid()));

-- Movements policies
CREATE POLICY "Admin can view all movements" ON public.movements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own unit movements" ON public.movements FOR SELECT TO authenticated
  USING (unit_id = public.get_user_unit(auth.uid()));
CREATE POLICY "Authenticated can insert movements" ON public.movements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update stock on movement
CREATE OR REPLACE FUNCTION public.handle_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_movement_created
  BEFORE INSERT ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.handle_movement();
