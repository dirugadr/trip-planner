-- Seed data for reference tables

-- POI Categories
INSERT OR IGNORE INTO poi_categories (id, name, icon, color) VALUES
('cat_attraction', 'Atracción turística', 'landmark', '#FF6B6B'),
('cat_station', 'Estación', 'train', '#4ECDC4'),
('cat_accommodation', 'Alojamiento', 'bed', '#45B7D1'),
('cat_food', 'Gastronomía', 'utensils', '#FFA07A'),
('cat_nature', 'Naturaleza/aire libre', 'leaf', '#90EE90'),
('cat_culture', 'Cultura', 'palette', '#DDA0DD'),
('cat_other', 'Otro', 'circle', '#95A5A6');

-- Transport Modes
INSERT OR IGNORE INTO transport_modes (id, name, icon, color) VALUES
('transport_walk', 'A pie', 'walk', '#95A5A6'),
('transport_car', 'Auto', 'car', '#3498DB'),
('transport_bus', 'Colectivo/Bus', 'bus', '#E74C3C'),
('transport_train', 'Tren/Metro', 'train', '#2ECC71'),
('transport_bike', 'Bicicleta', 'bike', '#F39C12');
