/*
    012_SP_Seguridad.sql
    Registro, credenciales y refresh tokens.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_ObtenerUsuario
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT u.IDUsuario, u.Nombres, u.Apellidos, u.Correo, u.Telefono, r.Codigo AS Rol, u.Activo
    FROM dbo.Usuarios u
    INNER JOIN dbo.Roles r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END
GO

-- Único SP que devuelve el hash. La contraseña se compara en el backend (bcrypt).
CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_ObtenerCredenciales
    @Correo NVARCHAR(254)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT u.IDUsuario, u.Nombres, u.Apellidos, u.Correo, u.Telefono, r.Codigo AS Rol, u.Activo, u.PasswordHash
    FROM dbo.Usuarios u
    INNER JOIN dbo.Roles r ON r.IDRol = u.IDRol
    WHERE u.Correo = LOWER(LTRIM(RTRIM(@Correo)));
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_RegistrarCliente
    @Nombres        NVARCHAR(100),
    @Apellidos      NVARCHAR(100),
    @Correo         NVARCHAR(254),
    @PasswordHash   VARCHAR(255),
    @Telefono       VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDUsuario INT;
    DECLARE @IDRol INT = (SELECT IDRol FROM dbo.Roles WHERE Codigo = 'CLIENTE');

    -- El UNIQUE de Correo decide; así no hay carrera entre dos registros simultáneos.
    BEGIN TRY
        INSERT INTO dbo.Usuarios (IDRol, Nombres, Apellidos, Correo, PasswordHash, Telefono)
        VALUES (@IDRol, @Nombres, @Apellidos, LOWER(LTRIM(RTRIM(@Correo))), @PasswordHash, @Telefono);

        SET @IDUsuario = SCOPE_IDENTITY();
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 50409, 'El correo ya esta registrado.', 1;
        THROW;
    END CATCH

    EXEC dbo.SP_Seguridad_ObtenerUsuario @IDUsuario = @IDUsuario;
END
GO

-- Cada login abre una familia nueva de tokens.
CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_CrearRefreshToken
    @IDUsuario      INT,
    @TokenHash      CHAR(64),
    @IDFamilia      UNIQUEIDENTIFIER,
    @DiasVigencia   INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();

    INSERT INTO dbo.RefreshTokens (IDUsuario, TokenHash, IDFamilia, FechaCreacion, FechaExpiracion)
    VALUES (@IDUsuario, @TokenHash, @IDFamilia, @Ahora, DATEADD(DAY, @DiasVigencia, @Ahora));
END
GO

-- Rotación: el token presentado se revoca y se emite uno nuevo en la misma familia.
-- Si el token presentado ya estaba revocado, alguien lo está reutilizando (posible robo):
-- se revoca toda la familia y ambas partes tienen que volver a iniciar sesión.
CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_RotarRefreshToken
    @TokenHashActual    CHAR(64),
    @TokenHashNuevo     CHAR(64),
    @DiasVigencia       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @IDToken INT, @IDTokenNuevo INT, @IDUsuario INT, @IDFamilia UNIQUEIDENTIFIER;
    DECLARE @FechaExpiracion DATETIME2(3), @FechaRevocacion DATETIME2(3), @UsuarioActivo BIT;

    BEGIN TRAN;

    -- UPDLOCK: dos rotaciones simultáneas del mismo token se atienden una después de la otra.
    SELECT
        @IDToken = t.IDRefreshToken,
        @IDUsuario = t.IDUsuario,
        @IDFamilia = t.IDFamilia,
        @FechaExpiracion = t.FechaExpiracion,
        @FechaRevocacion = t.FechaRevocacion,
        @UsuarioActivo = u.Activo
    FROM dbo.RefreshTokens t WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN dbo.Usuarios u ON u.IDUsuario = t.IDUsuario
    WHERE t.TokenHash = @TokenHashActual;

    IF @IDToken IS NULL
    BEGIN
        ROLLBACK;
        THROW 50401, 'Sesion invalida. Inicie sesion de nuevo.', 1;
    END

    IF @FechaRevocacion IS NOT NULL OR @UsuarioActivo = 0
    BEGIN
        UPDATE dbo.RefreshTokens
        SET FechaRevocacion = @Ahora
        WHERE IDFamilia = @IDFamilia
          AND FechaRevocacion IS NULL;

        COMMIT;
        THROW 50401, 'Sesion invalida. Inicie sesion de nuevo.', 1;
    END

    IF @FechaExpiracion <= @Ahora
    BEGIN
        ROLLBACK;
        THROW 50401, 'La sesion expiro. Inicie sesion de nuevo.', 1;
    END

    INSERT INTO dbo.RefreshTokens (IDUsuario, TokenHash, IDFamilia, FechaCreacion, FechaExpiracion)
    VALUES (@IDUsuario, @TokenHashNuevo, @IDFamilia, @Ahora, DATEADD(DAY, @DiasVigencia, @Ahora));

    SET @IDTokenNuevo = SCOPE_IDENTITY();

    UPDATE dbo.RefreshTokens
    SET FechaRevocacion = @Ahora,
        IDTokenReemplazo = @IDTokenNuevo
    WHERE IDRefreshToken = @IDToken;

    COMMIT;

    EXEC dbo.SP_Seguridad_ObtenerUsuario @IDUsuario = @IDUsuario;
END
GO

-- Logout: revoca la familia completa del token. Si el token no existe no hace nada.
CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_RevocarRefreshToken
    @TokenHash CHAR(64)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.RefreshTokens
    SET FechaRevocacion = SYSUTCDATETIME()
    WHERE IDFamilia = (SELECT IDFamilia FROM dbo.RefreshTokens WHERE TokenHash = @TokenHash)
      AND FechaRevocacion IS NULL;
END
GO
