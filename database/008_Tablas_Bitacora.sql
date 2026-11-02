/*
    008_Tablas_Bitacora.sql
    Bitácora de auditoría. Solo admite INSERT.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ValorAnterior / ValorNuevo en JSON con solo los campos que cambiaron.
CREATE TABLE dbo.Bitacora
(
    IDBitacora      BIGINT IDENTITY(1,1) NOT NULL,
    IDUsuario       INT                  NOT NULL,
    Fecha           DATETIME2(3)         NOT NULL CONSTRAINT DF_Bitacora_Fecha DEFAULT (SYSUTCDATETIME()),
    Modulo          VARCHAR(20)          NOT NULL,
    Entidad         VARCHAR(50)          NOT NULL,
    IDEntidad       INT                  NOT NULL,
    Accion          VARCHAR(15)          NOT NULL,
    ValorAnterior   NVARCHAR(MAX)        NULL,
    ValorNuevo      NVARCHAR(MAX)        NULL,

    CONSTRAINT PK_Bitacora PRIMARY KEY (IDBitacora),
    CONSTRAINT FK_Bitacora_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
    CONSTRAINT CK_Bitacora_Modulo CHECK (Modulo IN ('CATALOGO', 'INVENTARIO', 'CUPONES', 'PEDIDOS', 'SEGURIDAD')),
    CONSTRAINT CK_Bitacora_Accion CHECK (Accion IN ('CREAR', 'MODIFICAR', 'DESACTIVAR', 'ACTIVAR')),
    CONSTRAINT CK_Bitacora_ValorAnterior CHECK (ValorAnterior IS NULL OR ISJSON(ValorAnterior) = 1),
    CONSTRAINT CK_Bitacora_ValorNuevo CHECK (ValorNuevo IS NULL OR ISJSON(ValorNuevo) = 1)
);
GO

CREATE INDEX IX_Bitacora_Modulo_Fecha ON dbo.Bitacora (Modulo, Fecha);
CREATE INDEX IX_Bitacora_Entidad ON dbo.Bitacora (Entidad, IDEntidad);
GO

CREATE TRIGGER dbo.TR_Bitacora_Inmutable
ON dbo.Bitacora
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    THROW 50020, 'La bitacora no se puede modificar ni eliminar.', 1;
END
GO
