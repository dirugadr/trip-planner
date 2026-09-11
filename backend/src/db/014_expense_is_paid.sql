-- Ajuste a HU-3.3/HU-3.4: estado de pago por gasto. Default 1 (pagado) so
-- every expense already in production keeps the implicit "paid" behavior it
-- had before this column existed.

ALTER TABLE expenses ADD COLUMN is_paid INTEGER NOT NULL DEFAULT 1;
