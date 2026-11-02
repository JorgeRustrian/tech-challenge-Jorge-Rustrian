/*
    022_SP_Usuarios.sql
    Administración de usuarios. Nunca se borran: se desactivan. Bitácora en el módulo SEGURIDAD.
    Ninguna consulta devuelve el hash de la contraseña.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===== Apoyo ===== */

CREATE OR ALTER FUNCTION dbo.FU_Usuarios_UsuarioJson (@IDUsuario INT)
RETURNS TABLE
AS
RETURN
(
    SELECT
    (
        SELECT u.IDUsuario, u.Nombres, u.Apellidos, u.Correo, u.Telefono, r.Codigo AS Rol, u.Activo
        FROM dbo.Usuarios u
        INNER JOIN dbo.Roles r ON r.IDRol = u.IDRol
        WHERE u.IDUsuario = @IDUsuario
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
    ) AS Valor
);
GO

CREATE OR ALTER VIEW dbo.VW_Usuarios_Detalle
AS
SELECT
    u.IDUsuario, u.Nombres, u.Apellidos, u.Correo, u.Telefono, r.Codigo AS Rol, u.Activo,
    u.FechaCreacion, u.FechaModificacion,
    (SELECT MAX(t.FechaCreacion) FROM dbo.RefreshTokens t WHERE t.IDUsuario = u.IDUsuario) AS UltimaSesion,
    (SELECT COUNT(*) FROM dbo.Pedidos p WHERE p.IDUsuario = u.IDUsuario) AS CantidadPedidos
FROM dbo.Usuarios u
INNER JOIN dbo.Roles r ON r.IDRol = u.IDRol;
GO

-- Quien ejecuta debe ser Administrador activo según la base de datos, no solo según su token:
-- un administrador desactivado o degradado no puede gestionar usuarios aunque su token siga vigente.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_ValidarAdministrador
    @IDUsuarioAccion INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Usuarios u
        INNER JOIN dbo.Roles r ON r.IDRol = u.IDRol
        WHERE u.IDUsuario = @IDUsuarioAccion
          AND u.Activo = 1
          AND r.Codigo = 'ADMIN'
    )
        THROW 50403, 'No tiene permiso para administrar usuarios.', 1;
END
GO

IF USER_ID('shopcart_app') IS NOT NULL
    DENY EXECUTE ON dbo.SP_Usuarios_ValidarAdministrador TO shopcart_app;
GO

/* ===== Consultas ===== */

CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Listar
    @Texto              NVARCHAR(100) = NULL,
    @Rol                VARCHAR(20) = NULL,
    @Activo             BIT = NULL,
    @Pagina             INT = 1,
    @TamanioPagina      INT = 20,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC dbo.SP_Usuarios_ValidarAdministrador @IDUsuarioAccion = @IDUsuarioAccion;

    IF @Pagina < 1 OR @TamanioPagina NOT BETWEEN 1 AND 100
        THROW 50400, 'Parametros de paginacion invalidos.', 1;

    SELECT
        IDUsuario, Nombres, Apellidos, Correo, Telefono, Rol, Activo,
        FechaCreacion, FechaModificacion, UltimaSesion, CantidadPedidos
    INTO #Resultado
    FROM dbo.VW_Usuarios_Detalle
    WHERE (@Rol IS NULL OR Rol = @Rol)
      AND (@Activo IS NULL OR Activo = @Activo)
      AND (
            @Texto IS NULL
            OR CHARINDEX(@Texto COLLATE Modern_Spanish_CI_AI, CONCAT(Nombres, N' ', Apellidos) COLLATE Modern_Spanish_CI_AI) > 0
            OR CHARINDEX(@Texto COLLATE Modern_Spanish_CI_AI, Correo COLLATE Modern_Spanish_CI_AI) > 0
          )
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total FROM #Resultado;

    SELECT
        IDUsuario, Nombres, Apellidos, Correo, Telefono, Rol, Activo,
        FechaCreacion, FechaModificacion, UltimaSesion, CantidadPedidos
    FROM #Resultado
    ORDER BY FechaCreacion DESC, IDUsuario DESC
    OFFSET (@Pagina - 1) * @TamanioPagina ROWS
    FETCH NEXT @TamanioPagina ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Obtener
    @IDUsuario          INT,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC dbo.SP_Usuarios_ValidarAdministrador @IDUsuarioAccion = @IDUsuarioAccion;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE IDUsuario = @IDUsuario)
        THROW 50404, 'Usuario no encontrado.', 1;

    SELECT
        IDUsuario, Nombres, Apellidos, Correo, Telefono, Rol, Activo,
        FechaCreacion, FechaModificacion, UltimaSesion, CantidadPedidos
    FROM dbo.VW_Usuarios_Detalle
    WHERE IDUsuario = @IDUsuario;
END
GO

/* ===== Altas y cambios ===== */

-- El hash lo calcula el backend (bcrypt); aquí nunca llega la contraseña en claro.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Crear
    @Nombres            NVARCHAR(100),
    @Apellidos          NVARCHAR(100),
    @Correo             NVARCHAR(254),
    @PasswordHash       VARCHAR(255),
    @Telefono           VARCHAR(20) = NULL,
    @Rol                VARCHAR(20),
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDUsuario INT, @IDRol INT, @Despues NVARCHAR(MAX);

    EXEC dbo.SP_Usuarios_ValidarAdministrador @IDUsuarioAccion = @IDUsuarioAccion;

    SELECT @IDRol = IDRol FROM dbo.Roles WHERE Codigo = @Rol;

    IF @IDRol IS NULL
        THROW 50400, 'Rol invalido.', 1;

    BEGIN TRY
        BEGIN TRAN;

        INSERT INTO dbo.Usuarios (IDRol, Nombres, Apellidos, Correo, PasswordHash, Telefono)
        VALUES (@IDRol, @Nombres, @Apellidos, LOWER(LTRIM(RTRIM(@Correo))), @PasswordHash, @Telefono);

        SET @IDUsuario = SCOPE_IDENTITY();
        SELECT @Despues = Valor FROM dbo.FU_Usuarios_UsuarioJson(@IDUsuario);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'SEGURIDAD', 'Usuarios', @IDUsuario, 'CREAR', NULL, @Despues;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 50409, 'El correo ya esta registrado.', 1;
        THROW;
    END CATCH

    EXEC dbo.SP_Usuarios_Obtener @IDUsuario = @IDUsuario, @IDUsuarioAccion = @IDUsuarioAccion;
END
GO

-- Al quitar el rol de Administrador: nadie se lo quita a sí mismo y siempre queda al menos uno activo.
-- El nuevo rol aplica en el siguiente refresh (el SP de rotación lee el rol de la base de datos).
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Actualizar
    @IDUsuario          INT,
    @Nombres            NVARCHAR(100),
    @Apellidos          NVARCHAR(100),
    @Correo             NVARCHAR(254),
    @Telefono           VARCHAR(20) = NULL,
    @Rol                VARCHAR(20),
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDRolNuevo INT, @RolActual VARCHAR(20), @Activo BIT, @Antes NVARCHAR(MAX), @Despues NVARCHAR(MAX);

    EXEC dbo.SP_Usuarios_ValidarAdministrador @IDUsuarioAccion = @IDUsuarioAccion;

    SELECT @IDRolNuevo = IDRol FROM dbo.Roles WHERE Codigo = @Rol;

    IF @IDRolNuevo IS NULL
        THROW 50400, 'Rol invalido.', 1;

    BEGIN TRY
        BEGIN TRAN;

        SELECT @RolActual = r.Codigo, @Activo = u.Activo
        FROM dbo.Usuarios u WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Roles r ON r.IDRol = u.IDRol
        WHERE u.IDUsuario = @IDUsuario;

        IF @RolActual IS NULL
            THROW 50404, 'Usuario no encontrado.', 1;

        IF @RolActual = 'ADMIN' AND @Rol <> 'ADMIN'
        BEGIN
            IF @IDUsuario = @IDUsuarioAccion
                THROW 50409, 'No puede quitarse a si mismo el rol de Administrador.', 1;

            -- El bloqueo sobre los administradores activos evita que dos cambios simultáneos dejen cero.
            IF @Activo = 1 AND NOT EXISTS
            (
                SELECT 1
                FROM dbo.Usuarios u WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN dbo.Roles r ON r.IDRol = u.IDRol
                WHERE r.Codigo = 'ADMIN' AND u.Activo = 1 AND u.IDUsuario <> @IDUsuario
            )
                THROW 50409, 'Debe quedar al menos un Administrador activo.', 1;
        END

        SELECT @Antes = Valor FROM dbo.FU_Usuarios_UsuarioJson(@IDUsuario);

        UPDATE dbo.Usuarios
        SET IDRol = @IDRolNuevo,
            Nombres = @Nombres,
            Apellidos = @Apellidos,
            Correo = LOWER(LTRIM(RTRIM(@Correo))),
            Telefono = @Telefono,
            FechaModificacion = SYSUTCDATETIME()
        WHERE IDUsuario = @IDUsuario;

        SELECT @Despues = Valor FROM dbo.FU_Usuarios_UsuarioJson(@IDUsuario);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'SEGURIDAD', 'Usuarios', @IDUsuario, 'MODIFICAR', @Antes, @Despues;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 50409, 'El correo ya esta registrado.', 1;
        THROW;
    END CATCH

    EXEC dbo.SP_Usuarios_Obtener @IDUsuario = @IDUsuario, @IDUsuarioAccion = @IDUsuarioAccion;
END
GO

-- Desactivar no borra nada y cierra todas sus sesiones: el refresh token deja de servir y el acceso
-- dura a lo sumo lo que le quede al access token. Nadie se desactiva a sí mismo y siempre queda un Administrador.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_CambiarEstado
    @IDUsuario          INT,
    @Activo             BIT,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ActivoActual BIT, @Rol VARCHAR(20), @Antes NVARCHAR(MAX), @Despues NVARCHAR(MAX);
    DECLARE @Accion VARCHAR(15) = CASE WHEN @Activo = 1 THEN 'ACTIVAR' ELSE 'DESACTIVAR' END;

    EXEC dbo.SP_Usuarios_ValidarAdministrador @IDUsuarioAccion = @IDUsuarioAccion;

    BEGIN TRAN;

    SELECT @ActivoActual = u.Activo, @Rol = r.Codigo
    FROM dbo.Usuarios u WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN dbo.Roles r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;

    IF @ActivoActual IS NULL
        THROW 50404, 'Usuario no encontrado.', 1;

    IF @Activo = 0 AND @IDUsuario = @IDUsuarioAccion
        THROW 50409, 'No puede desactivarse a si mismo.', 1;

    IF @Activo = 0 AND @ActivoActual = 1 AND @Rol = 'ADMIN' AND NOT EXISTS
    (
        SELECT 1
        FROM dbo.Usuarios u WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Roles r ON r.IDRol = u.IDRol
        WHERE r.Codigo = 'ADMIN' AND u.Activo = 1 AND u.IDUsuario <> @IDUsuario
    )
        THROW 50409, 'Debe quedar al menos un Administrador activo.', 1;

    IF @ActivoActual <> @Activo
    BEGIN
        SELECT @Antes = Valor FROM dbo.FU_Usuarios_UsuarioJson(@IDUsuario);

        UPDATE dbo.Usuarios
        SET Activo = @Activo,
            FechaModificacion = SYSUTCDATETIME()
        WHERE IDUsuario = @IDUsuario;

        IF @Activo = 0
            UPDATE dbo.RefreshTokens
            SET FechaRevocacion = SYSUTCDATETIME()
            WHERE IDUsuario = @IDUsuario AND FechaRevocacion IS NULL;

        SELECT @Despues = Valor FROM dbo.FU_Usuarios_UsuarioJson(@IDUsuario);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'SEGURIDAD', 'Usuarios', @IDUsuario, @Accion, @Antes, @Despues;
    END

    COMMIT;

    EXEC dbo.SP_Usuarios_Obtener @IDUsuario = @IDUsuario, @IDUsuarioAccion = @IDUsuarioAccion;
END
GO

-- Restablecer la contraseña cierra todas las sesiones abiertas de ese usuario.
-- En la bitácora no queda ningún hash: solo que la contraseña se restableció.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_CambiarPassword
    @IDUsuario          INT,
    @PasswordHash       VARCHAR(255),
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Usuarios_ValidarAdministrador @IDUsuarioAccion = @IDUsuarioAccion;

    BEGIN TRAN;

    UPDATE dbo.Usuarios
    SET PasswordHash = @PasswordHash,
        FechaModificacion = SYSUTCDATETIME()
    WHERE IDUsuario = @IDUsuario;

    IF @@ROWCOUNT = 0
        THROW 50404, 'Usuario no encontrado.', 1;

    UPDATE dbo.RefreshTokens
    SET FechaRevocacion = SYSUTCDATETIME()
    WHERE IDUsuario = @IDUsuario AND FechaRevocacion IS NULL;

    EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'SEGURIDAD', 'Usuarios', @IDUsuario, 'MODIFICAR', NULL, N'{"Contrasena":"restablecida"}';

    COMMIT;
END
GO
