/*
    006_Tablas_Pedidos.sql
    Estados, pedidos, historial, uso de cupones y devoluciones.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE dbo.EstadosPedido
(
    IDEstadoPedido  INT IDENTITY(1,1) NOT NULL,
    Codigo          VARCHAR(20)       NOT NULL,
    Nombre          NVARCHAR(50)      NOT NULL,
    EsFinal         BIT               NOT NULL CONSTRAINT DF_EstadosPedido_EsFinal DEFAULT (0),

    CONSTRAINT PK_EstadosPedido PRIMARY KEY (IDEstadoPedido),
    CONSTRAINT UQ_EstadosPedido_Codigo UNIQUE (Codigo)
);
GO

-- Transiciones permitidas. TR_Pedidos_ValidarTransicion rechaza cualquier otra.
CREATE TABLE dbo.TransicionesEstado
(
    IDTransicionEstado  INT IDENTITY(1,1) NOT NULL,
    IDEstadoOrigen      INT               NOT NULL,
    IDEstadoDestino     INT               NOT NULL,

    CONSTRAINT PK_TransicionesEstado PRIMARY KEY (IDTransicionEstado),
    CONSTRAINT FK_TransicionesEstado_Origen FOREIGN KEY (IDEstadoOrigen) REFERENCES dbo.EstadosPedido (IDEstadoPedido),
    CONSTRAINT FK_TransicionesEstado_Destino FOREIGN KEY (IDEstadoDestino) REFERENCES dbo.EstadosPedido (IDEstadoPedido),
    CONSTRAINT UQ_TransicionesEstado_OrigenDestino UNIQUE (IDEstadoOrigen, IDEstadoDestino),
    CONSTRAINT CK_TransicionesEstado_Distintos CHECK (IDEstadoOrigen <> IDEstadoDestino)
);
GO

-- Montos y dirección se copian al confirmar; no cambian si cambia el catálogo o la dirección.
-- ClaveIdempotencia la genera el cliente por intento de pago: un reintento devuelve el mismo pedido.
CREATE TABLE dbo.Pedidos
(
    IDPedido                INT IDENTITY(1,1) NOT NULL,
    IDUsuario               INT               NOT NULL,
    IDEstadoPedido          INT               NOT NULL,
    IDDireccion             INT               NOT NULL,
    IDCupon                 INT               NULL,
    ClaveIdempotencia       UNIQUEIDENTIFIER  NOT NULL,
    NombreDestinatario      NVARCHAR(150)     NOT NULL,
    TelefonoDestinatario    VARCHAR(20)       NOT NULL,
    DireccionEntrega        NVARCHAR(600)     NOT NULL,
    Subtotal                DECIMAL(12,2)     NOT NULL,
    Descuento               DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Pedidos_Descuento DEFAULT (0),
    CostoEnvio              DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Pedidos_CostoEnvio DEFAULT (0),
    Total                   DECIMAL(12,2)     NOT NULL,
    IVA                     DECIMAL(12,2)     NOT NULL,
    ReferenciaPago          VARCHAR(50)       NULL,
    FechaCreacion           DATETIME2(3)      NOT NULL CONSTRAINT DF_Pedidos_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaModificacion       DATETIME2(3)      NULL,

    CONSTRAINT PK_Pedidos PRIMARY KEY (IDPedido),
    CONSTRAINT FK_Pedidos_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
    CONSTRAINT FK_Pedidos_EstadosPedido FOREIGN KEY (IDEstadoPedido) REFERENCES dbo.EstadosPedido (IDEstadoPedido),
    CONSTRAINT FK_Pedidos_Direcciones FOREIGN KEY (IDDireccion) REFERENCES dbo.Direcciones (IDDireccion),
    CONSTRAINT FK_Pedidos_Cupones FOREIGN KEY (IDCupon) REFERENCES dbo.Cupones (IDCupon),
    CONSTRAINT UQ_Pedidos_ClaveIdempotencia UNIQUE (ClaveIdempotencia),
    CONSTRAINT CK_Pedidos_Subtotal CHECK (Subtotal >= 0),
    CONSTRAINT CK_Pedidos_Descuento CHECK (Descuento >= 0 AND Descuento <= Subtotal),
    CONSTRAINT CK_Pedidos_CostoEnvio CHECK (CostoEnvio >= 0),
    CONSTRAINT CK_Pedidos_Total CHECK (Total = Subtotal - Descuento + CostoEnvio),
    CONSTRAINT CK_Pedidos_IVA CHECK (IVA >= 0 AND IVA <= Total)
);
GO

CREATE INDEX IX_Pedidos_IDUsuario_Fecha ON dbo.Pedidos (IDUsuario, FechaCreacion);
CREATE INDEX IX_Pedidos_Estado_Fecha ON dbo.Pedidos (IDEstadoPedido, FechaCreacion);
CREATE INDEX IX_Pedidos_FechaCreacion ON dbo.Pedidos (FechaCreacion);
GO

-- Descuento = parte del cupón prorrateada a la línea; sirve para calcular reembolsos parciales.
-- CantidadDevuelta se incrementa con cada devolución y el CHECK impide devolver de más.
CREATE TABLE dbo.PedidoDetalle
(
    IDPedidoDetalle     INT IDENTITY(1,1) NOT NULL,
    IDPedido            INT               NOT NULL,
    IDVariante          INT               NOT NULL,
    SKU                 VARCHAR(50)       NOT NULL,
    NombreProducto      NVARCHAR(150)     NOT NULL,
    Talla               NVARCHAR(20)      NULL,
    Color               NVARCHAR(30)      NULL,
    PrecioUnitario      DECIMAL(12,2)     NOT NULL,
    Cantidad            INT               NOT NULL,
    Descuento           DECIMAL(12,2)     NOT NULL CONSTRAINT DF_PedidoDetalle_Descuento DEFAULT (0),
    Total               DECIMAL(12,2)     NOT NULL,
    CantidadDevuelta    INT               NOT NULL CONSTRAINT DF_PedidoDetalle_CantidadDevuelta DEFAULT (0),

    CONSTRAINT PK_PedidoDetalle PRIMARY KEY (IDPedidoDetalle),
    CONSTRAINT FK_PedidoDetalle_Pedidos FOREIGN KEY (IDPedido) REFERENCES dbo.Pedidos (IDPedido),
    CONSTRAINT FK_PedidoDetalle_Variantes FOREIGN KEY (IDVariante) REFERENCES dbo.Variantes (IDVariante),
    CONSTRAINT UQ_PedidoDetalle_PedidoVariante UNIQUE (IDPedido, IDVariante),
    CONSTRAINT CK_PedidoDetalle_PrecioUnitario CHECK (PrecioUnitario > 0),
    CONSTRAINT CK_PedidoDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_PedidoDetalle_Descuento CHECK (Descuento >= 0 AND Descuento <= PrecioUnitario * Cantidad),
    CONSTRAINT CK_PedidoDetalle_Total CHECK (Total = PrecioUnitario * Cantidad - Descuento),
    CONSTRAINT CK_PedidoDetalle_CantidadDevuelta CHECK (CantidadDevuelta >= 0 AND CantidadDevuelta <= Cantidad)
);
GO

CREATE INDEX IX_PedidoDetalle_IDVariante ON dbo.PedidoDetalle (IDVariante);
GO

-- IDEstadoAnterior NULL = creación del pedido.
CREATE TABLE dbo.PedidoHistorial
(
    IDPedidoHistorial   INT IDENTITY(1,1) NOT NULL,
    IDPedido            INT               NOT NULL,
    IDEstadoAnterior    INT               NULL,
    IDEstadoNuevo       INT               NOT NULL,
    IDUsuario           INT               NOT NULL,
    Comentario          NVARCHAR(250)     NULL,
    Fecha               DATETIME2(3)      NOT NULL CONSTRAINT DF_PedidoHistorial_Fecha DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_PedidoHistorial PRIMARY KEY (IDPedidoHistorial),
    CONSTRAINT FK_PedidoHistorial_Pedidos FOREIGN KEY (IDPedido) REFERENCES dbo.Pedidos (IDPedido),
    CONSTRAINT FK_PedidoHistorial_EstadoAnterior FOREIGN KEY (IDEstadoAnterior) REFERENCES dbo.EstadosPedido (IDEstadoPedido),
    CONSTRAINT FK_PedidoHistorial_EstadoNuevo FOREIGN KEY (IDEstadoNuevo) REFERENCES dbo.EstadosPedido (IDEstadoPedido),
    CONSTRAINT FK_PedidoHistorial_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario)
);
GO

CREATE INDEX IX_PedidoHistorial_IDPedido ON dbo.PedidoHistorial (IDPedido);
GO

-- UQ en IDPedido: un solo cupón por pedido.
CREATE TABLE dbo.CuponUsos
(
    IDCuponUso  INT IDENTITY(1,1) NOT NULL,
    IDCupon     INT               NOT NULL,
    IDUsuario   INT               NOT NULL,
    IDPedido    INT               NOT NULL,
    FechaUso    DATETIME2(3)      NOT NULL CONSTRAINT DF_CuponUsos_FechaUso DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_CuponUsos PRIMARY KEY (IDCuponUso),
    CONSTRAINT FK_CuponUsos_Cupones FOREIGN KEY (IDCupon) REFERENCES dbo.Cupones (IDCupon),
    CONSTRAINT FK_CuponUsos_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
    CONSTRAINT FK_CuponUsos_Pedidos FOREIGN KEY (IDPedido) REFERENCES dbo.Pedidos (IDPedido),
    CONSTRAINT UQ_CuponUsos_IDPedido UNIQUE (IDPedido)
);
GO

CREATE INDEX IX_CuponUsos_Cupon_Usuario ON dbo.CuponUsos (IDCupon, IDUsuario);
GO

CREATE TABLE dbo.Devoluciones
(
    IDDevolucion    INT IDENTITY(1,1) NOT NULL,
    IDPedido        INT               NOT NULL,
    IDUsuario       INT               NOT NULL,
    Motivo          NVARCHAR(250)     NOT NULL,
    MontoReembolso  DECIMAL(12,2)     NOT NULL,
    Fecha           DATETIME2(3)      NOT NULL CONSTRAINT DF_Devoluciones_Fecha DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Devoluciones PRIMARY KEY (IDDevolucion),
    CONSTRAINT FK_Devoluciones_Pedidos FOREIGN KEY (IDPedido) REFERENCES dbo.Pedidos (IDPedido),
    CONSTRAINT FK_Devoluciones_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
    CONSTRAINT CK_Devoluciones_Motivo CHECK (LEN(LTRIM(Motivo)) > 0),
    CONSTRAINT CK_Devoluciones_MontoReembolso CHECK (MontoReembolso >= 0)
);
GO

CREATE INDEX IX_Devoluciones_IDPedido ON dbo.Devoluciones (IDPedido);
GO

CREATE TABLE dbo.DevolucionDetalle
(
    IDDevolucionDetalle INT IDENTITY(1,1) NOT NULL,
    IDDevolucion        INT               NOT NULL,
    IDPedidoDetalle     INT               NOT NULL,
    Cantidad            INT               NOT NULL,
    Monto               DECIMAL(12,2)     NOT NULL,

    CONSTRAINT PK_DevolucionDetalle PRIMARY KEY (IDDevolucionDetalle),
    CONSTRAINT FK_DevolucionDetalle_Devoluciones FOREIGN KEY (IDDevolucion) REFERENCES dbo.Devoluciones (IDDevolucion),
    CONSTRAINT FK_DevolucionDetalle_PedidoDetalle FOREIGN KEY (IDPedidoDetalle) REFERENCES dbo.PedidoDetalle (IDPedidoDetalle),
    CONSTRAINT UQ_DevolucionDetalle_DevolucionLinea UNIQUE (IDDevolucion, IDPedidoDetalle),
    CONSTRAINT CK_DevolucionDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_DevolucionDetalle_Monto CHECK (Monto >= 0)
);
GO

CREATE INDEX IX_DevolucionDetalle_IDPedidoDetalle ON dbo.DevolucionDetalle (IDPedidoDetalle);
GO

-- Rechaza en la BD cualquier cambio de estado que no esté en TransicionesEstado,
-- aunque alguien actualice la tabla sin pasar por los SPs.
CREATE TRIGGER dbo.TR_Pedidos_ValidarTransicion
ON dbo.Pedidos
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(IDEstadoPedido)
        RETURN;

    IF EXISTS
    (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.IDPedido = i.IDPedido
        WHERE i.IDEstadoPedido <> d.IDEstadoPedido
          AND NOT EXISTS
          (
              SELECT 1
              FROM dbo.TransicionesEstado t
              WHERE t.IDEstadoOrigen = d.IDEstadoPedido
                AND t.IDEstadoDestino = i.IDEstadoPedido
          )
    )
        THROW 50409, 'Transicion de estado de pedido no permitida.', 1;
END
GO
