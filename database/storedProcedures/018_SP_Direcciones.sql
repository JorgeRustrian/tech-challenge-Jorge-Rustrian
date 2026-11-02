/*
    018_SP_Direcciones.sql
    Direcciones de entrega del cliente. Todas filtran por el usuario de la sesión:
    una dirección ajena responde 404, igual que una que no existe.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Listar
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        IDDireccion, Alias, NombreDestinatario, Telefono, DireccionLinea, Zona,
        Municipio, Departamento, Referencias, EsPredeterminada
    FROM dbo.Direcciones
    WHERE IDUsuario = @IDUsuario
      AND Activo = 1
    ORDER BY EsPredeterminada DESC, FechaCreacion, IDDireccion;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Obtener
    @IDUsuario      INT,
    @IDDireccion    INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1 FROM dbo.Direcciones
        WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND Activo = 1
    )
        THROW 50404, 'Direccion no encontrada.', 1;

    SELECT
        IDDireccion, Alias, NombreDestinatario, Telefono, DireccionLinea, Zona,
        Municipio, Departamento, Referencias, EsPredeterminada
    FROM dbo.Direcciones
    WHERE IDDireccion = @IDDireccion;
END
GO

-- La primera dirección del cliente queda como predeterminada. Máximo 10 activas.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Crear
    @IDUsuario          INT,
    @Alias              NVARCHAR(50),
    @NombreDestinatario NVARCHAR(150),
    @Telefono           VARCHAR(20),
    @DireccionLinea     NVARCHAR(250),
    @Zona               TINYINT = NULL,
    @Municipio          NVARCHAR(100),
    @Departamento       NVARCHAR(100),
    @Referencias        NVARCHAR(250) = NULL,
    @EsPredeterminada   BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDDireccion INT, @Activas INT;

    BEGIN TRAN;

    -- Bloquea las direcciones del cliente: dos altas simultáneas no pueden dejar dos predeterminadas.
    SELECT @Activas = COUNT(*)
    FROM dbo.Direcciones WITH (UPDLOCK, HOLDLOCK)
    WHERE IDUsuario = @IDUsuario AND Activo = 1;

    IF @Activas >= 10
        THROW 50409, 'Se permiten como maximo 10 direcciones por cliente.', 1;

    IF @Activas = 0
        SET @EsPredeterminada = 1;

    IF @EsPredeterminada = 1
        UPDATE dbo.Direcciones
        SET EsPredeterminada = 0,
            FechaModificacion = SYSUTCDATETIME()
        WHERE IDUsuario = @IDUsuario AND EsPredeterminada = 1;

    INSERT INTO dbo.Direcciones
        (IDUsuario, Alias, NombreDestinatario, Telefono, DireccionLinea, Zona, Municipio, Departamento, Referencias, EsPredeterminada)
    VALUES
        (@IDUsuario, @Alias, @NombreDestinatario, @Telefono, @DireccionLinea, @Zona, @Municipio, @Departamento, @Referencias, @EsPredeterminada);

    SET @IDDireccion = SCOPE_IDENTITY();

    COMMIT;

    EXEC dbo.SP_Direcciones_Obtener @IDUsuario = @IDUsuario, @IDDireccion = @IDDireccion;
END
GO

-- Los pedidos ya hechos no cambian: guardan su propia copia de la dirección.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Actualizar
    @IDUsuario          INT,
    @IDDireccion        INT,
    @Alias              NVARCHAR(50),
    @NombreDestinatario NVARCHAR(150),
    @Telefono           VARCHAR(20),
    @DireccionLinea     NVARCHAR(250),
    @Zona               TINYINT = NULL,
    @Municipio          NVARCHAR(100),
    @Departamento       NVARCHAR(100),
    @Referencias        NVARCHAR(250) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Direcciones
    SET Alias = @Alias,
        NombreDestinatario = @NombreDestinatario,
        Telefono = @Telefono,
        DireccionLinea = @DireccionLinea,
        Zona = @Zona,
        Municipio = @Municipio,
        Departamento = @Departamento,
        Referencias = @Referencias,
        FechaModificacion = SYSUTCDATETIME()
    WHERE IDDireccion = @IDDireccion
      AND IDUsuario = @IDUsuario
      AND Activo = 1;

    IF @@ROWCOUNT = 0
        THROW 50404, 'Direccion no encontrada.', 1;

    EXEC dbo.SP_Direcciones_Obtener @IDUsuario = @IDUsuario, @IDDireccion = @IDDireccion;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_MarcarPredeterminada
    @IDUsuario      INT,
    @IDDireccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;

    IF NOT EXISTS
    (
        SELECT 1 FROM dbo.Direcciones WITH (UPDLOCK, HOLDLOCK)
        WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND Activo = 1
    )
        THROW 50404, 'Direccion no encontrada.', 1;

    -- Primero se quita la anterior para no chocar con UX_Direcciones_Predeterminada.
    UPDATE dbo.Direcciones
    SET EsPredeterminada = 0,
        FechaModificacion = SYSUTCDATETIME()
    WHERE IDUsuario = @IDUsuario
      AND EsPredeterminada = 1
      AND IDDireccion <> @IDDireccion;

    UPDATE dbo.Direcciones
    SET EsPredeterminada = 1,
        FechaModificacion = SYSUTCDATETIME()
    WHERE IDDireccion = @IDDireccion;

    COMMIT;

    EXEC dbo.SP_Direcciones_Listar @IDUsuario = @IDUsuario;
END
GO

-- Se desactiva (los pedidos la referencian). Si era la predeterminada, pasa a serlo la más reciente.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Eliminar
    @IDUsuario      INT,
    @IDDireccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @EraPredeterminada BIT;

    BEGIN TRAN;

    SELECT @EraPredeterminada = EsPredeterminada
    FROM dbo.Direcciones WITH (UPDLOCK, HOLDLOCK)
    WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND Activo = 1;

    IF @EraPredeterminada IS NULL
        THROW 50404, 'Direccion no encontrada.', 1;

    UPDATE dbo.Direcciones
    SET Activo = 0,
        EsPredeterminada = 0,
        FechaModificacion = SYSUTCDATETIME()
    WHERE IDDireccion = @IDDireccion;

    IF @EraPredeterminada = 1
        UPDATE dbo.Direcciones
        SET EsPredeterminada = 1,
            FechaModificacion = SYSUTCDATETIME()
        WHERE IDDireccion =
        (
            SELECT TOP (1) IDDireccion
            FROM dbo.Direcciones
            WHERE IDUsuario = @IDUsuario AND Activo = 1
            ORDER BY FechaCreacion DESC, IDDireccion DESC
        );

    COMMIT;
END
GO
