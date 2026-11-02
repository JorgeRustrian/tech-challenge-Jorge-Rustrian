/*
    002_Tablas_Seguridad.sql
    Módulo de seguridad: roles, usuarios, refresh tokens y direcciones de clientes.
*/
USE ShopCart;
GO

-- Requeridos por índices filtrados y columnas calculadas, sin importar el cliente usado.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ---------------------------------------------------------------------------
   Roles
   El sistema maneja exactamente tres roles. El backend los identifica por
   Codigo, nunca por IDRol.
--------------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------------
   Usuarios
   Los usuarios no se eliminan: se desactivan con Activo = 0.
   La collation CI hace que UQ_Usuarios_Correo no distinga mayúsculas.
--------------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------------
   RefreshTokens
   Se guarda el hash SHA-256 del token, nunca el token en claro.
   IDFamilia agrupa todos los tokens nacidos de un mismo login: si se presenta
   un token ya rotado (posible robo), se revoca toda la familia.
--------------------------------------------------------------------------- */
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
    -- Un token reemplazado por rotación tiene que estar revocado.
    CONSTRAINT CK_RefreshTokens_Reemplazo CHECK (IDTokenReemplazo IS NULL OR FechaRevocacion IS NOT NULL)
);
GO

CREATE INDEX IX_RefreshTokens_IDUsuario ON dbo.RefreshTokens (IDUsuario);
CREATE INDEX IX_RefreshTokens_IDFamilia ON dbo.RefreshTokens (IDFamilia);
GO

/* ---------------------------------------------------------------------------
   Direcciones
   Un cliente puede tener varias direcciones; a lo sumo una predeterminada.
   Se desactivan en lugar de eliminarse, porque los pedidos guardan su propia
   copia de la dirección al momento de la compra.
--------------------------------------------------------------------------- */
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

-- La base de datos garantiza una sola dirección predeterminada activa por cliente.
CREATE UNIQUE INDEX UX_Direcciones_Predeterminada
    ON dbo.Direcciones (IDUsuario)
    WHERE EsPredeterminada = 1 AND Activo = 1;
GO
