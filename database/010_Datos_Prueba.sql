/*
    010_Datos_Prueba.sql
    Usuarios, catálogo, existencias iniciales y cupones de prueba.
    Contraseña de todos los usuarios: ShopCart2026!  (bcrypt, costo 10)
*/
USE ShopCart;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- No todos los inserts tienen UNIQUE que los frene (Productos, Kardex): si ya hay datos, no se ejecuta nada.
IF EXISTS (SELECT 1 FROM dbo.Usuarios)
BEGIN
    RAISERROR('Los datos de prueba ya estan cargados. Recrear la BD para volver a cargarlos.', 16, 1);
    SET NOEXEC ON;
END
GO

INSERT INTO dbo.Usuarios (IDRol, Nombres, Apellidos, Correo, PasswordHash, Telefono)
SELECT r.IDRol, u.Nombres, u.Apellidos, u.Correo, u.PasswordHash, u.Telefono
FROM
(
    VALUES
        ('ADMIN',    N'Andrea', N'Morales', N'admin@shopcart.com',    '$2a$10$7YJPm/Vn/n.FSf4w4O9cOeiLzMbNXJA.vxn7nhZ/9e1ul/FJvWI8.', '55550001'),
        ('OPERADOR', N'Carlos', N'Pérez',   N'operador@shopcart.com', '$2a$10$/E8dcGxVmj9ks82DbvYome0L2geZ5DBixt1V/qW7iy4c57jpW4yku', '55550002'),
        ('CLIENTE',  N'María',  N'López',   N'cliente1@shopcart.com', '$2a$10$q7Jlj1FmbDtNsMruuFoUa.HwckpcGrpM.FlhZWbp6wd7sftJLN5pm', '55550003'),
        ('CLIENTE',  N'José',   N'García',  N'cliente2@shopcart.com', '$2a$10$99kdyRLGD7r./7awTYI60.BCRuKctlYjCGvCStONDvDuycV8hV/Le', '55550004')
) u (Rol, Nombres, Apellidos, Correo, PasswordHash, Telefono)
INNER JOIN dbo.Roles r ON r.Codigo = u.Rol;
GO

INSERT INTO dbo.Direcciones (IDUsuario, Alias, NombreDestinatario, Telefono, DireccionLinea, Zona, Municipio, Departamento, Referencias, EsPredeterminada)
SELECT us.IDUsuario, d.Alias, d.NombreDestinatario, d.Telefono, d.DireccionLinea, d.Zona, d.Municipio, d.Departamento, d.Referencias, d.EsPredeterminada
FROM
(
    VALUES
        (N'cliente1@shopcart.com', N'Casa',    N'María López', '55550003', N'4a. Avenida 12-45',        10, N'Guatemala', N'Guatemala',  N'Edificio azul, apto 3B', 1),
        (N'cliente1@shopcart.com', N'Oficina', N'María López', '55550003', N'Diagonal 6 10-01',         10, N'Guatemala', N'Guatemala',  N'Torre 2, nivel 8',      0),
        (N'cliente2@shopcart.com', N'Casa',    N'José García', '55550004', N'Calle Real 3-20',        NULL, N'Antigua Guatemala', N'Sacatepéquez', NULL,       1)
) d (Correo, Alias, NombreDestinatario, Telefono, DireccionLinea, Zona, Municipio, Departamento, Referencias, EsPredeterminada)
INNER JOIN dbo.Usuarios us ON us.Correo = d.Correo;
GO

INSERT INTO dbo.Categorias (Nombre, Descripcion)
VALUES
    (N'Camisas',    N'Camisas, polos y playeras'),
    (N'Pantalones', N'Jeans y pantalones de vestir'),
    (N'Calzado',    N'Tenis y botas'),
    (N'Accesorios', N'Gorras, cinturones y mochilas'),
    (N'Deportes',   N'Ropa y artículos deportivos');
GO

INSERT INTO dbo.Productos (IDCategoria, Nombre, Descripcion, Activo)
SELECT c.IDCategoria, p.Nombre, p.Descripcion, p.Activo
FROM
(
    VALUES
        (N'Camisas',    N'Camisa Polo Clásica',         N'Polo de piqué 100 % algodón, corte regular.', 1),
        (N'Camisas',    N'Camisa Oxford Manga Larga',   N'Camisa Oxford con botones en el cuello.',      1),
        (N'Camisas',    N'Playera Básica Algodón',      N'Playera cuello redondo, algodón peinado.',     1),
        (N'Camisas',    N'Camisa Hawaiana',             N'Temporada pasada, fuera de catálogo.',         0),
        (N'Pantalones', N'Jeans Slim Fit',              N'Mezclilla elástica, corte slim.',              1),
        (N'Pantalones', N'Pantalón Chino',              N'Gabardina de algodón, corte recto.',           1),
        (N'Calzado',    N'Tenis Urbanos',               N'Tenis de lona con suela de hule.',             1),
        (N'Calzado',    N'Botas de Cuero',              N'Botas de cuero genuino con suela antideslizante.', 1),
        (N'Accesorios', N'Gorra Bordada',               N'Gorra ajustable con logo bordado.',            1),
        (N'Accesorios', N'Cinturón de Cuero',           N'Cinturón de cuero con hebilla metálica.',      1),
        (N'Accesorios', N'Mochila Urbana 20L',          N'Mochila con compartimento para laptop.',       1),
        (N'Deportes',   N'Playera Deportiva Dry',       N'Tela de secado rápido.',                       1),
        (N'Deportes',   N'Short Deportivo',             N'Short ligero con bolsa lateral.',              1),
        (N'Deportes',   N'Balón de Fútbol No. 5',       N'Balón cosido a máquina, tamaño oficial.',      1)
) p (Categoria, Nombre, Descripcion, Activo)
INNER JOIN dbo.Categorias c ON c.Nombre = p.Categoria;
GO

-- Fotos de Unsplash (licencia libre). La dirección pide un recorte cuadrado de 800 px.
INSERT INTO dbo.ProductoImagenes (IDProducto, Url, Orden)
SELECT p.IDProducto, CONCAT('https://images.unsplash.com/photo-', i.Foto, '?auto=format&fit=crop&w=800&h=800&q=80'), i.Orden
FROM
(
    VALUES
        (N'Camisa Polo Clásica',       '1623658580851-3b25bf83b4ea', 1),
        (N'Camisa Polo Clásica',       '1671438118097-479e63198629', 2),
        (N'Camisa Oxford Manga Larga', '1598032895397-b9472444bf93', 1),
        (N'Playera Básica Algodón',    '1581655353564-df123a1eb820', 1),
        (N'Camisa Hawaiana',           '1744298975062-7b1f1939f652', 1),
        (N'Jeans Slim Fit',            '1714143136372-ddaf8b606da7', 1),
        (N'Pantalón Chino',            '1473966968600-fa801b869a1a', 1),
        (N'Tenis Urbanos',             '1676379760823-ebf91f45de0b', 1),
        (N'Tenis Urbanos',             '1641997465126-c73cc4070337', 2),
        (N'Botas de Cuero',            '1608256246200-53e635b5b65f', 1),
        (N'Gorra Bordada',             '1560774358-d727658f457c',    1),
        (N'Cinturón de Cuero',         '1711443982852-b3df5c563448', 1),
        (N'Mochila Urbana 20L',        '1553062407-98eeb64c6a62',    1),
        (N'Mochila Urbana 20L',        '1581605405669-fcdf81165afa', 2),
        (N'Playera Deportiva Dry',     '1600679472183-07cc4f68b140', 1),
        (N'Short Deportivo',           '1789110519851-2c2ceaa1bc6e', 1),
        (N'Balón de Fútbol No. 5',     '1575361204480-aadea25e6e68', 1)
) i (Producto, Foto, Orden)
INNER JOIN dbo.Productos p ON p.Nombre = i.Producto;
GO

-- Existencias en 1 y 0 a propósito para probar la última unidad y productos agotados.
INSERT INTO dbo.Variantes (IDProducto, SKU, Talla, Color, Precio, ExistenciaFisica)
SELECT p.IDProducto, v.SKU, v.Talla, v.Color, v.Precio, v.Existencia
FROM
(
    VALUES
        (N'Camisa Polo Clásica',       'POLO-S-AZU',  N'S',  N'Azul',        149.00, 15),
        (N'Camisa Polo Clásica',       'POLO-M-AZU',  N'M',  N'Azul',        149.00, 25),
        (N'Camisa Polo Clásica',       'POLO-L-AZU',  N'L',  N'Azul',        149.00, 20),
        (N'Camisa Polo Clásica',       'POLO-S-BLA',  N'S',  N'Blanco',      149.00, 10),
        (N'Camisa Polo Clásica',       'POLO-M-BLA',  N'M',  N'Blanco',      149.00, 18),
        (N'Camisa Polo Clásica',       'POLO-L-BLA',  N'L',  N'Blanco',      149.00, 12),
        (N'Camisa Oxford Manga Larga', 'OXF-M-CEL',   N'M',  N'Celeste',     249.00, 8),
        (N'Camisa Oxford Manga Larga', 'OXF-L-CEL',   N'L',  N'Celeste',     249.00, 6),
        (N'Camisa Oxford Manga Larga', 'OXF-M-BLA',   N'M',  N'Blanco',      249.00, 9),
        (N'Camisa Oxford Manga Larga', 'OXF-L-BLA',   N'L',  N'Blanco',      249.00, 5),
        (N'Playera Básica Algodón',    'PLA-S-NEG',   N'S',  N'Negro',        79.00, 30),
        (N'Playera Básica Algodón',    'PLA-M-NEG',   N'M',  N'Negro',        79.00, 40),
        (N'Playera Básica Algodón',    'PLA-L-NEG',   N'L',  N'Negro',        79.00, 35),
        (N'Playera Básica Algodón',    'PLA-XL-NEG',  N'XL', N'Negro',        89.00, 20),
        (N'Camisa Hawaiana',           'HAW-M-MUL',   N'M',  N'Multicolor',  199.00, 4),
        (N'Jeans Slim Fit',            'JEA-30-AZO',  N'30', N'Azul oscuro', 299.00, 12),
        (N'Jeans Slim Fit',            'JEA-32-AZO',  N'32', N'Azul oscuro', 299.00, 15),
        (N'Jeans Slim Fit',            'JEA-34-AZO',  N'34', N'Azul oscuro', 299.00, 0),
        (N'Pantalón Chino',            'CHI-30-BEI',  N'30', N'Beige',       259.00, 7),
        (N'Pantalón Chino',            'CHI-32-BEI',  N'32', N'Beige',       259.00, 10),
        (N'Pantalón Chino',            'CHI-34-BEI',  N'34', N'Beige',       259.00, 6),
        (N'Tenis Urbanos',             'TEN-39-BLA',  N'39', N'Blanco',      399.00, 5),
        (N'Tenis Urbanos',             'TEN-40-BLA',  N'40', N'Blanco',      399.00, 8),
        (N'Tenis Urbanos',             'TEN-41-BLA',  N'41', N'Blanco',      399.00, 8),
        (N'Tenis Urbanos',             'TEN-42-BLA',  N'42', N'Blanco',      399.00, 4),
        (N'Botas de Cuero',            'BOT-40-CAF',  N'40', N'Café',        649.00, 3),
        (N'Botas de Cuero',            'BOT-41-CAF',  N'41', N'Café',        649.00, 2),
        (N'Botas de Cuero',            'BOT-42-CAF',  N'42', N'Café',        649.00, 1),
        (N'Gorra Bordada',             'GOR-UNI-NEG', NULL,  N'Negro',        99.00, 25),
        (N'Gorra Bordada',             'GOR-UNI-AZU', NULL,  N'Azul',         99.00, 20),
        (N'Cinturón de Cuero',         'CIN-M-CAF',   N'M',  N'Café',        129.00, 10),
        (N'Cinturón de Cuero',         'CIN-L-CAF',   N'L',  N'Café',        129.00, 10),
        (N'Mochila Urbana 20L',        'MOC-UNI-GRI', NULL,  N'Gris',        349.00, 9),
        (N'Playera Deportiva Dry',     'DRY-S-ROJ',   N'S',  N'Rojo',        119.00, 12),
        (N'Playera Deportiva Dry',     'DRY-M-ROJ',   N'M',  N'Rojo',        119.00, 15),
        (N'Playera Deportiva Dry',     'DRY-L-ROJ',   N'L',  N'Rojo',        119.00, 10),
        (N'Playera Deportiva Dry',     'DRY-S-NEG',   N'S',  N'Negro',       119.00, 12),
        (N'Playera Deportiva Dry',     'DRY-M-NEG',   N'M',  N'Negro',       119.00, 15),
        (N'Playera Deportiva Dry',     'DRY-L-NEG',   N'L',  N'Negro',       119.00, 10),
        (N'Short Deportivo',           'SHO-S-NEG',   N'S',  N'Negro',       109.00, 14),
        (N'Short Deportivo',           'SHO-M-NEG',   N'M',  N'Negro',       109.00, 18),
        (N'Short Deportivo',           'SHO-L-NEG',   N'L',  N'Negro',       109.00, 11),
        (N'Balón de Fútbol No. 5',     'BAL-5',       NULL,  NULL,           189.00, 1)
) v (Producto, SKU, Talla, Color, Precio, Existencia)
INNER JOIN dbo.Productos p ON p.Nombre = v.Producto;
GO

-- Cada existencia inicial entra por kardex para que la suma de movimientos cuadre.
DECLARE @IDAdmin INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'admin@shopcart.com');

INSERT INTO dbo.Kardex (IDVariante, TipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo, IDUsuario)
SELECT IDVariante, 'ENTRADA', ExistenciaFisica, 0, ExistenciaFisica, N'Inventario inicial', @IDAdmin
FROM dbo.Variantes
WHERE ExistenciaFisica > 0;
GO

-- VERANO2025 vencido y ULTIMOUSO con un solo uso, para probar rechazos y concurrencia.
INSERT INTO dbo.Cupones (Codigo, Descripcion, TipoDescuento, Valor, MontoMinimo, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosCliente, IDCategoria)
SELECT c.Codigo, c.Descripcion, c.TipoDescuento, c.Valor, c.MontoMinimo, c.FechaInicio, c.FechaFin, c.LimiteUsosTotal, c.LimiteUsosCliente, cat.IDCategoria
FROM
(
    VALUES
        ('BIENVENIDA10', N'10 % en tu primera compra',          'PORCENTAJE', 10.00,   0.00, '2026-01-01', '2027-12-31T23:59:59', 1000, 1, NULL),
        ('DESCUENTO50',  N'Q50 en compras desde Q300',           'MONTO',      50.00, 300.00, '2026-01-01', '2027-12-31T23:59:59',  500, 3, NULL),
        ('DEPORTES15',   N'15 % en la categoría Deportes',        'PORCENTAJE', 15.00, 200.00, '2026-01-01', '2027-12-31T23:59:59',  100, 2, N'Deportes'),
        ('VERANO2025',   N'Promoción de verano 2025',             'PORCENTAJE', 20.00,   0.00, '2025-01-01', '2025-03-31T23:59:59',  100, 1, NULL),
        ('ULTIMOUSO',    N'Cupón con un solo uso disponible',     'MONTO',      25.00,   0.00, '2026-01-01', '2027-12-31T23:59:59',    1, 1, NULL)
) c (Codigo, Descripcion, TipoDescuento, Valor, MontoMinimo, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosCliente, Categoria)
LEFT JOIN dbo.Categorias cat ON cat.Nombre = c.Categoria;
GO

SET NOEXEC OFF;
GO
