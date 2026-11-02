/*
    007_Tablas_Inventario.sql
    Kardex y reservas de existencia.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Cantidad con signo: positiva entra, negativa sale.
-- Se cumple siempre: Variantes.ExistenciaFisica = SUM(Kardex.Cantidad) de la variante.
CREATE TABLE dbo.Kardex
(
    IDKardex            INT IDENTITY(1,1) NOT NULL,
    IDVariante          INT               NOT NULL,
    TipoMovimiento      VARCHAR(15)       NOT NULL,
    Cantidad            INT               NOT NULL,
    ExistenciaAnterior  INT               NOT NULL,
    ExistenciaNueva     INT               NOT NULL,
    Motivo              NVARCHAR(250)     NULL,
    IDPedido            INT               NULL,
    IDUsuario           INT               NOT NULL,
    Fecha               DATETIME2(3)      NOT NULL CONSTRAINT DF_Kardex_Fecha DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Kardex PRIMARY KEY (IDKardex),
    CONSTRAINT FK_Kardex_Variantes FOREIGN KEY (IDVariante) REFERENCES dbo.Variantes (IDVariante),
    CONSTRAINT FK_Kardex_Pedidos FOREIGN KEY (IDPedido) REFERENCES dbo.Pedidos (IDPedido),
    CONSTRAINT FK_Kardex_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
    CONSTRAINT CK_Kardex_TipoMovimiento CHECK (TipoMovimiento IN ('ENTRADA', 'VENTA', 'AJUSTE', 'DEVOLUCION', 'CANCELACION')),
    CONSTRAINT CK_Kardex_Signo CHECK
    (
        (TipoMovimiento IN ('ENTRADA', 'DEVOLUCION', 'CANCELACION') AND Cantidad > 0)
        OR (TipoMovimiento = 'VENTA' AND Cantidad < 0)
        OR (TipoMovimiento = 'AJUSTE' AND Cantidad <> 0)
    ),
    CONSTRAINT CK_Kardex_Saldo CHECK (ExistenciaNueva = ExistenciaAnterior + Cantidad),
    CONSTRAINT CK_Kardex_ExistenciaNueva CHECK (ExistenciaNueva >= 0),
    CONSTRAINT CK_Kardex_MotivoAjuste CHECK (TipoMovimiento <> 'AJUSTE' OR (Motivo IS NOT NULL AND LEN(LTRIM(Motivo)) > 0)),
    CONSTRAINT CK_Kardex_Pedido CHECK (TipoMovimiento NOT IN ('VENTA', 'DEVOLUCION', 'CANCELACION') OR IDPedido IS NOT NULL)
);
GO

CREATE INDEX IX_Kardex_Variante_Fecha ON dbo.Kardex (IDVariante, Fecha);
CREATE INDEX IX_Kardex_IDPedido ON dbo.Kardex (IDPedido) WHERE IDPedido IS NOT NULL;
GO

-- Se crean al iniciar el pago y duran 15 minutos (minutos vienen del backend).
-- PrecioUnitario congela el precio que vio el cliente; el pedido se arma con este precio.
CREATE TABLE dbo.Reservas
(
    IDReserva           INT IDENTITY(1,1) NOT NULL,
    IDCarrito           INT               NOT NULL,
    IDVariante          INT               NOT NULL,
    Cantidad            INT               NOT NULL,
    PrecioUnitario      DECIMAL(12,2)     NOT NULL,
    Estado              VARCHAR(10)       NOT NULL CONSTRAINT DF_Reservas_Estado DEFAULT ('ACTIVA'),
    IDPedido            INT               NULL,
    FechaCreacion       DATETIME2(3)      NOT NULL CONSTRAINT DF_Reservas_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaExpiracion     DATETIME2(3)      NOT NULL,
    FechaCierre         DATETIME2(3)      NULL,

    CONSTRAINT PK_Reservas PRIMARY KEY (IDReserva),
    CONSTRAINT FK_Reservas_Carritos FOREIGN KEY (IDCarrito) REFERENCES dbo.Carritos (IDCarrito),
    CONSTRAINT FK_Reservas_Variantes FOREIGN KEY (IDVariante) REFERENCES dbo.Variantes (IDVariante),
    CONSTRAINT FK_Reservas_Pedidos FOREIGN KEY (IDPedido) REFERENCES dbo.Pedidos (IDPedido),
    CONSTRAINT CK_Reservas_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_Reservas_PrecioUnitario CHECK (PrecioUnitario > 0),
    CONSTRAINT CK_Reservas_Estado CHECK (Estado IN ('ACTIVA', 'CONSUMIDA', 'LIBERADA')),
    CONSTRAINT CK_Reservas_Expiracion CHECK (FechaExpiracion > FechaCreacion),
    CONSTRAINT CK_Reservas_Consumida CHECK (Estado <> 'CONSUMIDA' OR IDPedido IS NOT NULL),
    CONSTRAINT CK_Reservas_Cierre CHECK ((Estado = 'ACTIVA' AND FechaCierre IS NULL) OR (Estado <> 'ACTIVA' AND FechaCierre IS NOT NULL))
);
GO

CREATE UNIQUE INDEX UX_Reservas_CarritoVarianteActiva
    ON dbo.Reservas (IDCarrito, IDVariante)
    WHERE Estado = 'ACTIVA';

-- Para el job que libera reservas vencidas.
CREATE INDEX IX_Reservas_ExpiracionActiva
    ON dbo.Reservas (FechaExpiracion)
    INCLUDE (IDVariante, Cantidad)
    WHERE Estado = 'ACTIVA';
GO
