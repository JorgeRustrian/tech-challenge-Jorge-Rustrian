/*
    005_Tablas_Carrito.sql
    Carritos de clientes e invitados.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Invitado: IDUsuario NULL y TokenInvitado con valor.
-- FUSIONADO = carrito de invitado que se pasó al del cliente al iniciar sesión.
CREATE TABLE dbo.Carritos
(
    IDCarrito               INT IDENTITY(1,1) NOT NULL,
    IDUsuario               INT               NULL,
    TokenInvitado           UNIQUEIDENTIFIER  NULL,
    IDCupon                 INT               NULL,
    Estado                  VARCHAR(15)       NOT NULL CONSTRAINT DF_Carritos_Estado DEFAULT ('ACTIVO'),
    FechaCreacion           DATETIME2(3)      NOT NULL CONSTRAINT DF_Carritos_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaUltimaActividad    DATETIME2(3)      NOT NULL CONSTRAINT DF_Carritos_FechaUltimaActividad DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Carritos PRIMARY KEY (IDCarrito),
    CONSTRAINT FK_Carritos_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
    CONSTRAINT FK_Carritos_Cupones FOREIGN KEY (IDCupon) REFERENCES dbo.Cupones (IDCupon),
    CONSTRAINT CK_Carritos_Duenio CHECK (IDUsuario IS NOT NULL OR TokenInvitado IS NOT NULL),
    CONSTRAINT CK_Carritos_Estado CHECK (Estado IN ('ACTIVO', 'CONVERTIDO', 'FUSIONADO'))
);
GO

-- Un solo carrito activo por cliente.
CREATE UNIQUE INDEX UX_Carritos_UsuarioActivo
    ON dbo.Carritos (IDUsuario)
    WHERE IDUsuario IS NOT NULL AND Estado = 'ACTIVO';

CREATE UNIQUE INDEX UX_Carritos_TokenInvitado
    ON dbo.Carritos (TokenInvitado)
    WHERE TokenInvitado IS NOT NULL;

-- Reporte de carritos abandonados.
CREATE INDEX IX_Carritos_Estado_Actividad ON dbo.Carritos (Estado, FechaUltimaActividad);
GO

-- No guarda precio: el carrito siempre muestra el precio vigente.
CREATE TABLE dbo.CarritoDetalle
(
    IDCarritoDetalle    INT IDENTITY(1,1) NOT NULL,
    IDCarrito           INT               NOT NULL,
    IDVariante          INT               NOT NULL,
    Cantidad            INT               NOT NULL,
    FechaAgregado       DATETIME2(3)      NOT NULL CONSTRAINT DF_CarritoDetalle_FechaAgregado DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_CarritoDetalle PRIMARY KEY (IDCarritoDetalle),
    CONSTRAINT FK_CarritoDetalle_Carritos FOREIGN KEY (IDCarrito) REFERENCES dbo.Carritos (IDCarrito),
    CONSTRAINT FK_CarritoDetalle_Variantes FOREIGN KEY (IDVariante) REFERENCES dbo.Variantes (IDVariante),
    CONSTRAINT UQ_CarritoDetalle_CarritoVariante UNIQUE (IDCarrito, IDVariante),
    CONSTRAINT CK_CarritoDetalle_Cantidad CHECK (Cantidad > 0)
);
GO
