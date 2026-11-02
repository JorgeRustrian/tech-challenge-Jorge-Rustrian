/*
    002_Tablas_Seguridad.sql
    Roles, usuarios, refresh tokens y direcciones.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- El backend identifica los roles por Codigo, no por IDRol.
CREATE TABLE dbo.Roles
(
    IDRol   INT IDENTITY(1,1) NOT NULL,
    Codigo  VARCHAR(20)       NOT NULL,
    Nombre  NVARCHAR(50)      NOT NULL,

    CONSTRAINT PK_Roles PRIMARY KEY (IDRol),
    CONSTRAINT UQ_Roles_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_Roles_Codigo CHECK (Codigo IN ('CLIENTE', 'OPERADOR', 'ADMIN'))
);
GO

CREATE TABLE dbo.Usuarios
(
    IDUsuario           INT IDENTITY(1,1) NOT NULL,
    IDRol               INT               NOT NULL,
    Nombres             NVARCHAR(100)     NOT NULL,
    Apellidos           NVARCHAR(100)     NOT NULL,
    Correo              NVARCHAR(254)     NOT NULL,
    PasswordHash        VARCHAR(255)      NOT NULL,
    Telefono            VARCHAR(20)       NULL,
    Activo              BIT               NOT NULL CONSTRAINT DF_Usuarios_Activo DEFAULT (1),
    FechaCreacion       DATETIME2(3)      NOT NULL CONSTRAINT DF_Usuarios_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaModificacion   DATETIME2(3)      NULL,

    CONSTRAINT PK_Usuarios PRIMARY KEY (IDUsuario),
    CONSTRAINT FK_Usuarios_Roles FOREIGN KEY (IDRol) REFERENCES dbo.Roles (IDRol),
    CONSTRAINT UQ_Usuarios_Correo UNIQUE (Correo),
    CONSTRAINT CK_Usuarios_Correo CHECK (Correo LIKE '%_@_%._%'),
    CONSTRAINT CK_Usuarios_Nombres CHECK (LEN(LTRIM(Nombres)) > 0),
    CONSTRAINT CK_Usuarios_Apellidos CHECK (LEN(LTRIM(Apellidos)) > 0)
);
GO

CREATE INDEX IX_Usuarios_IDRol ON dbo.Usuarios (IDRol);
GO

-- Se guarda el hash del token. IDFamilia agrupa los tokens de un mismo login
-- para revocarlos todos si llega un token ya rotado.
CREATE TABLE dbo.RefreshTokens
(
    IDRefreshToken      INT IDENTITY(1,1) NOT NULL,
    IDUsuario           INT               NOT NULL,
    TokenHash           CHAR(64)          NOT NULL,
    IDFamilia           UNIQUEIDENTIFIER  NOT NULL,
    FechaCreacion       DATETIME2(3)      NOT NULL CONSTRAINT DF_RefreshTokens_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaExpiracion     DATETIME2(3)      NOT NULL,
    FechaRevocacion     DATETIME2(3)      NULL,
    IDTokenReemplazo    INT               NULL,

    CONSTRAINT PK_RefreshTokens PRIMARY KEY (IDRefreshToken),
    CONSTRAINT FK_RefreshTokens_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
    CONSTRAINT FK_RefreshTokens_Reemplazo FOREIGN KEY (IDTokenReemplazo) REFERENCES dbo.RefreshTokens (IDRefreshToken),
    CONSTRAINT UQ_RefreshTokens_TokenHash UNIQUE (TokenHash),
    CONSTRAINT CK_RefreshTokens_Expiracion CHECK (FechaExpiracion > FechaCreacion),
    CONSTRAINT CK_RefreshTokens_Reemplazo CHECK (IDTokenReemplazo IS NULL OR FechaRevocacion IS NOT NULL)
);
GO

CREATE INDEX IX_RefreshTokens_IDUsuario ON dbo.RefreshTokens (IDUsuario);
CREATE INDEX IX_RefreshTokens_IDFamilia ON dbo.RefreshTokens (IDFamilia);
GO

CREATE TABLE dbo.Direcciones
(
    IDDireccion         INT IDENTITY(1,1) NOT NULL,
    IDUsuario           INT               NOT NULL,
    Alias               NVARCHAR(50)      NOT NULL,
    NombreDestinatario  NVARCHAR(150)     NOT NULL,
    Telefono            VARCHAR(20)       NOT NULL,
    DireccionLinea      NVARCHAR(250)     NOT NULL,
    Zona                TINYINT           NULL,
    Municipio           NVARCHAR(100)     NOT NULL,
    Departamento        NVARCHAR(100)     NOT NULL,
    Referencias         NVARCHAR(250)     NULL,
    EsPredeterminada    BIT               NOT NULL CONSTRAINT DF_Direcciones_EsPredeterminada DEFAULT (0),
    Activo              BIT               NOT NULL CONSTRAINT DF_Direcciones_Activo DEFAULT (1),
    FechaCreacion       DATETIME2(3)      NOT NULL CONSTRAINT DF_Direcciones_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaModificacion   DATETIME2(3)      NULL,

    CONSTRAINT PK_Direcciones PRIMARY KEY (IDDireccion),
    CONSTRAINT FK_Direcciones_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
    CONSTRAINT CK_Direcciones_Zona CHECK (Zona BETWEEN 1 AND 25),
    CONSTRAINT CK_Direcciones_DireccionLinea CHECK (LEN(LTRIM(DireccionLinea)) > 0)
);
GO

CREATE INDEX IX_Direcciones_IDUsuario ON dbo.Direcciones (IDUsuario);

-- Solo una dirección predeterminada activa por cliente.
CREATE UNIQUE INDEX UX_Direcciones_Predeterminada
    ON dbo.Direcciones (IDUsuario)
    WHERE EsPredeterminada = 1 AND Activo = 1;
GO
