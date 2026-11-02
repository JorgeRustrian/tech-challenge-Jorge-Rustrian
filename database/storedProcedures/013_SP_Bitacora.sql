/*
    013_SP_Bitacora.sql
    Registro en bitácora. Lo llaman los demás SPs dentro de su propia transacción.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_Registrar
    @IDUsuario      INT,
    @Modulo         VARCHAR(20),
    @Entidad        VARCHAR(50),
    @IDEntidad      INT,
    @Accion         VARCHAR(15),
    @ValorAnterior  NVARCHAR(MAX) = NULL,
    @ValorNuevo     NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
    VALUES (@IDUsuario, @Modulo, @Entidad, @IDEntidad, @Accion, @ValorAnterior, @ValorNuevo);
END
GO

-- El backend no puede llamarlo directo (no puede inventar registros).
-- Los SPs sí pueden, porque al ser todos de dbo no se revisan permisos (encadenamiento de propiedad).
IF USER_ID('shopcart_app') IS NOT NULL
    DENY EXECUTE ON dbo.SP_Bitacora_Registrar TO shopcart_app;
GO

-- Consulta para Administradores. Todos los filtros son opcionales; las fechas son días de Guatemala.
CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_Consultar
    @Modulo         VARCHAR(20) = NULL,
    @Entidad        VARCHAR(50) = NULL,
    @IDEntidad      INT = NULL,
    @Accion         VARCHAR(15) = NULL,
    @IDUsuario      INT = NULL,
    @FechaDesde     DATE = NULL,
    @FechaHasta     DATE = NULL,
    @Pagina         INT = 1,
    @TamanioPagina  INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @TamanioPagina NOT BETWEEN 1 AND 100
        THROW 50400, 'Parametros de paginacion invalidos.', 1;

    DECLARE @DesdeUtc DATETIME2(3) =
        CAST(CAST(@FechaDesde AS DATETIME2(3)) AT TIME ZONE 'Central America Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(3));
    DECLARE @HastaUtc DATETIME2(3) =
        CAST(CAST(DATEADD(DAY, 1, @FechaHasta) AS DATETIME2(3)) AT TIME ZONE 'Central America Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(3));

    SELECT COUNT(*) AS Total
    FROM dbo.Bitacora b
    WHERE (@Modulo IS NULL OR b.Modulo = @Modulo)
      AND (@Entidad IS NULL OR b.Entidad = @Entidad)
      AND (@IDEntidad IS NULL OR b.IDEntidad = @IDEntidad)
      AND (@Accion IS NULL OR b.Accion = @Accion)
      AND (@IDUsuario IS NULL OR b.IDUsuario = @IDUsuario)
      AND (@DesdeUtc IS NULL OR b.Fecha >= @DesdeUtc)
      AND (@HastaUtc IS NULL OR b.Fecha < @HastaUtc)
    OPTION (RECOMPILE);

    SELECT
        b.IDBitacora, b.Fecha, b.Modulo, b.Entidad, b.IDEntidad, b.Accion,
        b.IDUsuario, u.Nombres, u.Apellidos, u.Correo,
        b.ValorAnterior, b.ValorNuevo
    FROM dbo.Bitacora b
    INNER JOIN dbo.Usuarios u ON u.IDUsuario = b.IDUsuario
    WHERE (@Modulo IS NULL OR b.Modulo = @Modulo)
      AND (@Entidad IS NULL OR b.Entidad = @Entidad)
      AND (@IDEntidad IS NULL OR b.IDEntidad = @IDEntidad)
      AND (@Accion IS NULL OR b.Accion = @Accion)
      AND (@IDUsuario IS NULL OR b.IDUsuario = @IDUsuario)
      AND (@DesdeUtc IS NULL OR b.Fecha >= @DesdeUtc)
      AND (@HastaUtc IS NULL OR b.Fecha < @HastaUtc)
    ORDER BY b.Fecha DESC, b.IDBitacora DESC
    OFFSET (@Pagina - 1) * @TamanioPagina ROWS
    FETCH NEXT @TamanioPagina ROWS ONLY
    OPTION (RECOMPILE);
END
GO
