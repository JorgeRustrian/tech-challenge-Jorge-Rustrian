/*
    003_Tablas_Catalogo.sql
    Categorías, productos, imágenes y variantes.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE dbo.Categorias
(
    IDCategoria         INT IDENTITY(1,1) NOT NULL,
    Nombre              NVARCHAR(100)     NOT NULL,
    Descripcion         NVARCHAR(500)     NULL,
    Activo              BIT               NOT NULL CONSTRAINT DF_Categorias_Activo DEFAULT (1),
    FechaCreacion       DATETIME2(3)      NOT NULL CONSTRAINT DF_Categorias_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaModificacion   DATETIME2(3)      NULL,

    CONSTRAINT PK_Categorias PRIMARY KEY (IDCategoria),
    CONSTRAINT UQ_Categorias_Nombre UNIQUE (Nombre),
    CONSTRAINT CK_Categorias_Nombre CHECK (LEN(LTRIM(Nombre)) > 0)
);
GO

-- Precio y existencia van en Variantes.
CREATE TABLE dbo.Productos
(
    IDProducto          INT IDENTITY(1,1) NOT NULL,
    IDCategoria         INT               NOT NULL,
    Nombre              NVARCHAR(150)     NOT NULL,
    Descripcion         NVARCHAR(2000)    NULL,
    Activo              BIT               NOT NULL CONSTRAINT DF_Productos_Activo DEFAULT (1),
    FechaCreacion       DATETIME2(3)      NOT NULL CONSTRAINT DF_Productos_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaModificacion   DATETIME2(3)      NULL,

    CONSTRAINT PK_Productos PRIMARY KEY (IDProducto),
    CONSTRAINT FK_Productos_Categorias FOREIGN KEY (IDCategoria) REFERENCES dbo.Categorias (IDCategoria),
    CONSTRAINT CK_Productos_Nombre CHECK (LEN(LTRIM(Nombre)) > 0)
);
GO

CREATE INDEX IX_Productos_IDCategoria ON dbo.Productos (IDCategoria);
CREATE INDEX IX_Productos_Nombre ON dbo.Productos (Nombre);
GO

-- Orden = 1 es la imagen principal.
CREATE TABLE dbo.ProductoImagenes
(
    IDProductoImagen    INT IDENTITY(1,1) NOT NULL,
    IDProducto          INT               NOT NULL,
    Url                 NVARCHAR(500)     NOT NULL,
    Orden               TINYINT           NOT NULL CONSTRAINT DF_ProductoImagenes_Orden DEFAULT (1),
    FechaCreacion       DATETIME2(3)      NOT NULL CONSTRAINT DF_ProductoImagenes_FechaCreacion DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_ProductoImagenes PRIMARY KEY (IDProductoImagen),
    CONSTRAINT FK_ProductoImagenes_Productos FOREIGN KEY (IDProducto) REFERENCES dbo.Productos (IDProducto),
    CONSTRAINT UQ_ProductoImagenes_ProductoOrden UNIQUE (IDProducto, Orden),
    CONSTRAINT CK_ProductoImagenes_Orden CHECK (Orden >= 1),
    CONSTRAINT CK_ProductoImagenes_Url CHECK (LEN(LTRIM(Url)) > 0)
);
GO

-- Precio con IVA incluido. ExistenciaFisica solo se mueve junto con su registro en Kardex.
CREATE TABLE dbo.Variantes
(
    IDVariante              INT IDENTITY(1,1) NOT NULL,
    IDProducto              INT               NOT NULL,
    SKU                     VARCHAR(50)       NOT NULL,
    Talla                   NVARCHAR(20)      NULL,
    Color                   NVARCHAR(30)      NULL,
    Precio                  DECIMAL(12,2)     NOT NULL,
    ExistenciaFisica        INT               NOT NULL CONSTRAINT DF_Variantes_ExistenciaFisica DEFAULT (0),
    ExistenciaReservada     INT               NOT NULL CONSTRAINT DF_Variantes_ExistenciaReservada DEFAULT (0),
    ExistenciaDisponible    AS (ExistenciaFisica - ExistenciaReservada),
    Activo                  BIT               NOT NULL CONSTRAINT DF_Variantes_Activo DEFAULT (1),
    FechaCreacion           DATETIME2(3)      NOT NULL CONSTRAINT DF_Variantes_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaModificacion       DATETIME2(3)      NULL,

    CONSTRAINT PK_Variantes PRIMARY KEY (IDVariante),
    CONSTRAINT FK_Variantes_Productos FOREIGN KEY (IDProducto) REFERENCES dbo.Productos (IDProducto),
    CONSTRAINT UQ_Variantes_SKU UNIQUE (SKU),
    CONSTRAINT UQ_Variantes_ProductoTallaColor UNIQUE (IDProducto, Talla, Color),
    CONSTRAINT CK_Variantes_SKU CHECK (LEN(LTRIM(SKU)) > 0),
    CONSTRAINT CK_Variantes_Precio CHECK (Precio > 0),
    CONSTRAINT CK_Variantes_ExistenciaFisica CHECK (ExistenciaFisica >= 0),
    CONSTRAINT CK_Variantes_ExistenciaReservada CHECK (ExistenciaReservada >= 0),
    -- Barrera final contra sobreventa.
    CONSTRAINT CK_Variantes_Reservada CHECK (ExistenciaReservada <= ExistenciaFisica)
);
GO

CREATE INDEX IX_Variantes_Precio ON dbo.Variantes (Precio);
GO
