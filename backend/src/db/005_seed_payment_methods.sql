-- Seed data for payment_methods (reference table)

INSERT OR IGNORE INTO payment_methods (id, name, icon, color) VALUES
('pm_cash', 'Efectivo', 'banknote', '#2ECC71'),
('pm_credit_card', 'Tarjeta de crédito', 'credit-card', '#3498DB'),
('pm_debit_card', 'Tarjeta de débito', 'credit-card', '#1ABC9C'),
('pm_transfer', 'Transferencia', 'arrow-left-right', '#9B59B6'),
('pm_digital_wallet', 'Billetera digital', 'wallet', '#E67E22'),
('pm_other', 'Otro', 'circle', '#95A5A6');
