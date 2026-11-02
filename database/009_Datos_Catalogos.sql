/*
    009_Datos_Catalogos.sql
    Roles, estados de pedido y transiciones permitidas.
*/
USE ShopCart;
GO

SET NOCOUNT ON;
GO

INSERT INTO dbo.Roles (Codigo, Nombre)
VALUES
    ('CLIENTE',  N'Cliente'),
    ('OPERADOR', N'Operador'),
    ('ADMIN',    N'Administrador');
GO

INSERT INTO dbo.EstadosPedido (Codigo, Nombre, EsFinal)
VALUES
    ('PAGADO',           N'Pagado',           0),
    ('EN_PREPARACION',   N'En preparación',   0),
    ('DESPACHADO',       N'Despachado',       0),
    ('ENTREGADO',        N'Entregado',        0),
    ('CANCELADO',        N'Cancelado',        1),
    ('DEVUELTO_PARCIAL', N'Devuelto parcial', 0),
    ('DEVUELTO',         N'Devuelto',         1);
GO

-- Cancelar solo antes de DESPACHADO.
INSERT INTO dbo.TransicionesEstado (IDEstadoOrigen, IDEstadoDestino)
SELECT o.IDEstadoPedido, d.IDEstadoPedido
FROM
(
    VALUES
        ('PAGADO',           'EN_PREPARACION'),
        ('EN_PREPARACION',   'DESPACHADO'),
        ('DESPACHADO',       'ENTREGADO'),
        ('PAGADO',           'CANCELADO'),
        ('EN_PREPARACION',   'CANCELADO'),
        ('ENTREGADO',        'DEVUELTO_PARCIAL'),
        ('ENTREGADO',        'DEVUELTO'),
        ('DEVUELTO_PARCIAL', 'DEVUELTO')
) t (Origen, Destino)
INNER JOIN dbo.EstadosPedido o ON o.Codigo = t.Origen
INNER JOIN dbo.EstadosPedido d ON d.Codigo = t.Destino;
GO
