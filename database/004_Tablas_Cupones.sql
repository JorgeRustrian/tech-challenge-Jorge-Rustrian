/*
    004_Tablas_Cupones.sql
    Cupones de descuento.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- IDCategoria NULL = aplica a todo el carrito.
-- UsosActuales se incrementa con UPDATE condicionado; el CHECK evita pasarse del límite.
CREATE TABLE dbo.Cupones
(
    IDCupon             INT IDENTITY(1,1) NOT NULL,
    Codigo              VARCHAR(30)       NOT NULL,
    Descripcion         NVARCHAR(250)     NULL,
    TipoDescuento       VARCHAR(10)       NOT NULL,
    Valor               DECIMAL(12,2)     NOT NULL,
    MontoMinimo         DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Cupones_MontoMinimo DEFAULT (0),
    FechaInicio         DATETIME2(3)      NOT NULL,
    FechaFin            DATETIME2(3)      NOT NULL,
    LimiteUsosTotal     INT               NOT NULL,
    LimiteUsosCliente   INT               NOT NULL CONSTRAINT DF_Cupones_LimiteUsosCliente DEFAULT (1),
    UsosActuales        INT               NOT NULL CONSTRAINT DF_Cupones_UsosActuales DEFAULT (0),
    IDCategoria         INT               NULL,
    Activo              BIT               NOT NULL CONSTRAINT DF_Cupones_Activo DEFAULT (1),
    FechaCreacion       DATETIME2(3)      NOT NULL CONSTRAINT DF_Cupones_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaModificacion   DATETIME2(3)      NULL,

    CONSTRAINT PK_Cupones PRIMARY KEY (IDCupon),
    CONSTRAINT FK_Cupones_Categorias FOREIGN KEY (IDCategoria) REFERENCES dbo.Categorias (IDCategoria),
    CONSTRAINT UQ_Cupones_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_Cupones_TipoDescuento CHECK (TipoDescuento IN ('PORCENTAJE', 'MONTO')),
    CONSTRAINT CK_Cupones_Valor CHECK (Valor > 0),
    CONSTRAINT CK_Cupones_Porcentaje CHECK (TipoDescuento <> 'PORCENTAJE' OR Valor <= 100),
    CONSTRAINT CK_Cupones_MontoMinimo CHECK (MontoMinimo >= 0),
    CONSTRAINT CK_Cupones_Vigencia CHECK (FechaFin > FechaInicio),
    CONSTRAINT CK_Cupones_LimiteUsosTotal CHECK (LimiteUsosTotal > 0),
    CONSTRAINT CK_Cupones_LimiteUsosCliente CHECK (LimiteUsosCliente > 0 AND LimiteUsosCliente <= LimiteUsosTotal),
    CONSTRAINT CK_Cupones_UsosActuales CHECK (UsosActuales >= 0 AND UsosActuales <= LimiteUsosTotal)
);
GO
