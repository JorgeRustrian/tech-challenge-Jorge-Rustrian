/*
    016_SP_Cupones.sql
    Cálculo y validación de descuentos (los usan carrito y checkout) y administración de cupones.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===== Cálculo del descuento ===== */

-- Descuento de un cupón sobre las líneas de un carrito.
-- @UsarReservas = 0: precios vigentes, solo productos que se pueden vender (vista del carrito).
-- @UsarReservas = 1: precios congelados en las reservas activas (creación del pedido).
--
-- Todo se calcula en centavos enteros. El descuento total se reparte entre las líneas elegibles
-- por el método del mayor residuo: cada línea recibe la parte entera de su proporción y los
-- centavos que sobran van a las líneas con mayor fracción. Así la suma de los descuentos por
-- línea es exactamente el descuento total y ninguna línea recibe más que su propio subtotal.
CREATE OR ALTER FUNCTION dbo.FU_Cupones_CalculoDescuento
(
    @IDCarrito      INT,
    @IDCupon        INT,
    @UsarReservas   BIT
)
RETURNS TABLE
AS
RETURN
(
    WITH Lineas AS
    (
        SELECT cd.IDVariante, cd.Cantidad, v.Precio AS PrecioUnitario, p.IDCategoria
        FROM dbo.CarritoDetalle cd
        INNER JOIN dbo.Variantes v ON v.IDVariante = cd.IDVariante
        INNER JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
        INNER JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
        WHERE @UsarReservas = 0
          AND cd.IDCarrito = @IDCarrito
          AND v.Activo = 1 AND p.Activo = 1 AND c.Activo = 1

        UNION ALL

        SELECT r.IDVariante, r.Cantidad, r.PrecioUnitario, p.IDCategoria
        FROM dbo.Reservas r
        INNER JOIN dbo.Variantes v ON v.IDVariante = r.IDVariante
        INNER JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
        WHERE @UsarReservas = 1
          AND r.IDCarrito = @IDCarrito
          AND r.Estado = 'ACTIVA'
    ),
    Cupon AS
    (
        SELECT TipoDescuento, Valor, IDCategoria
        FROM dbo.Cupones
        WHERE IDCupon = @IDCupon
    ),
    Elegibles AS
    (
        SELECT
            l.IDVariante,
            l.Cantidad,
            l.PrecioUnitario,
            CAST(l.PrecioUnitario * l.Cantidad AS DECIMAL(12,2)) AS Subtotal,
            CAST(l.PrecioUnitario * l.Cantidad * 100 AS DECIMAL(38,0)) AS SubtotalCent,
            CASE
                WHEN cu.TipoDescuento IS NOT NULL AND (cu.IDCategoria IS NULL OR cu.IDCategoria = l.IDCategoria) THEN 1
                ELSE 0
            END AS Aplica,
            cu.TipoDescuento,
            cu.Valor
        FROM Lineas l
        LEFT JOIN Cupon cu ON 1 = 1
    ),
    Totales AS
    (
        SELECT
            e.*,
            SUM(CASE WHEN e.Aplica = 1 THEN e.SubtotalCent ELSE 0 END) OVER () AS BaseCent
        FROM Elegibles e
    ),
    Descuento AS
    (
        -- Porcentaje sobre la base elegible; monto fijo nunca mayor que la base.
        SELECT
            t.*,
            CAST(
                CASE
                    WHEN t.TipoDescuento IS NULL OR t.BaseCent = 0 THEN 0
                    WHEN t.TipoDescuento = 'PORCENTAJE' THEN ROUND(t.BaseCent * t.Valor / 100, 0)
                    WHEN t.Valor * 100 > t.BaseCent THEN t.BaseCent
                    ELSE t.Valor * 100
                END
            AS DECIMAL(38,0)) AS DescuentoCent
        FROM Totales t
    ),
    Reparto AS
    (
        SELECT
            d.*,
            CASE WHEN d.Aplica = 1 AND d.BaseCent > 0
                 THEN FLOOR(d.DescuentoCent * d.SubtotalCent / d.BaseCent) ELSE 0 END AS PisoCent,
            CASE WHEN d.Aplica = 1 AND d.BaseCent > 0
                 THEN (d.DescuentoCent * d.SubtotalCent) % d.BaseCent ELSE 0 END AS Residuo
        FROM Descuento d
    ),
    Turnos AS
    (
        SELECT
            r.*,
            r.DescuentoCent - SUM(r.PisoCent) OVER () AS CentavosPendientes,
            ROW_NUMBER() OVER (ORDER BY r.Aplica DESC, r.Residuo DESC, r.IDVariante) AS Turno
        FROM Reparto r
    )
    SELECT
        t.IDVariante,
        t.Cantidad,
        t.PrecioUnitario,
        t.Subtotal,
        CAST(t.Aplica AS BIT) AS Aplica,
        CAST(
            (t.PisoCent + CASE WHEN t.Aplica = 1 AND t.Turno <= t.CentavosPendientes THEN 1 ELSE 0 END) / 100
        AS DECIMAL(12,2)) AS Descuento
    FROM Turnos t
);
GO

/* ===== Validación ===== */

-- Devuelve el mensaje de la primera regla que no se cumple; sin filas = el cupón es válido.
-- Con @IDUsuario NULL (invitado) el límite por cliente se revisa al crear el pedido.
CREATE OR ALTER FUNCTION dbo.FU_Cupones_Validar
(
    @IDCupon        INT,
    @IDUsuario      INT,
    @Subtotal       DECIMAL(12,2),
    @BaseElegible   DECIMAL(12,2)
)
RETURNS TABLE
AS
RETURN
(
    SELECT TOP (1) r.Mensaje
    FROM dbo.Cupones c
    LEFT JOIN dbo.Categorias cat ON cat.IDCategoria = c.IDCategoria
    OUTER APPLY
    (
        SELECT COUNT(*) AS Usos
        FROM dbo.CuponUsos u
        WHERE u.IDCupon = c.IDCupon
          AND u.IDUsuario = @IDUsuario
    ) uc
    CROSS APPLY
    (
        VALUES
            (1, CASE WHEN c.Activo = 0 THEN N'El cupon no esta disponible.' END),
            (2, CASE WHEN c.FechaInicio > SYSUTCDATETIME() THEN N'El cupon todavia no esta vigente.' END),
            (3, CASE WHEN c.FechaFin < SYSUTCDATETIME() THEN N'El cupon esta vencido.' END),
            (4, CASE WHEN c.UsosActuales >= c.LimiteUsosTotal THEN N'El cupon esta agotado.' END),
            (5, CASE WHEN @IDUsuario IS NOT NULL AND uc.Usos >= c.LimiteUsosCliente
                     THEN N'Ya alcanzo el limite de usos de este cupon.' END),
            (6, CASE WHEN c.IDCategoria IS NOT NULL AND @BaseElegible = 0
                     THEN CONCAT(N'El cupon solo aplica a productos de la categoria ', cat.Nombre, N'.') END),
            (7, CASE WHEN @Subtotal < c.MontoMinimo
                     THEN CONCAT(N'El cupon requiere una compra minima de Q', CAST(c.MontoMinimo AS NVARCHAR(20)), N'.') END)
    ) r (Orden, Mensaje)
    WHERE c.IDCupon = @IDCupon
      AND r.Mensaje IS NOT NULL
    ORDER BY r.Orden
);
GO

/* ===== Administración ===== */

CREATE OR ALTER FUNCTION dbo.FU_Cupones_CuponJson (@IDCupon INT)
RETURNS TABLE
AS
RETURN
(
    SELECT
    (
        SELECT
            c.IDCupon, c.Codigo, c.Descripcion, c.TipoDescuento, c.Valor, c.MontoMinimo,
            c.FechaInicio, c.FechaFin, c.LimiteUsosTotal, c.LimiteUsosCliente, c.UsosActuales,
            c.IDCategoria, c.Activo
        FROM dbo.Cupones c
        WHERE c.IDCupon = @IDCupon
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
    ) AS Valor
);
GO

-- Estado calculado en un solo lugar para listados y detalle.
CREATE OR ALTER VIEW dbo.VW_Cupones_Detalle
AS
SELECT
    c.IDCupon, c.Codigo, c.Descripcion, c.TipoDescuento, c.Valor, c.MontoMinimo,
    c.FechaInicio, c.FechaFin, c.LimiteUsosTotal, c.LimiteUsosCliente, c.UsosActuales,
    c.IDCategoria, cat.Nombre AS Categoria, c.Activo, c.FechaCreacion,
    CASE
        WHEN c.Activo = 0 THEN 'INACTIVO'
        WHEN c.FechaFin < SYSUTCDATETIME() THEN 'VENCIDO'
        WHEN c.UsosActuales >= c.LimiteUsosTotal THEN 'AGOTADO'
        WHEN c.FechaInicio > SYSUTCDATETIME() THEN 'PROGRAMADO'
        ELSE 'VIGENTE'
    END AS Estado
FROM dbo.Cupones c
LEFT JOIN dbo.Categorias cat ON cat.IDCategoria = c.IDCategoria;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Listar
    @Texto          NVARCHAR(100) = NULL,
    @Estado         VARCHAR(15) = NULL,
    @Pagina         INT = 1,
    @TamanioPagina  INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @TamanioPagina NOT BETWEEN 1 AND 100
        THROW 50400, 'Parametros de paginacion invalidos.', 1;

    SELECT
        IDCupon, Codigo, Descripcion, TipoDescuento, Valor, MontoMinimo, FechaInicio, FechaFin,
        LimiteUsosTotal, LimiteUsosCliente, UsosActuales, IDCategoria, Categoria, Activo, Estado, FechaCreacion
    INTO #Resultado
    FROM dbo.VW_Cupones_Detalle
    WHERE (@Estado IS NULL OR Estado = @Estado)
      AND (
            @Texto IS NULL
            OR CHARINDEX(@Texto COLLATE Modern_Spanish_CI_AI, Codigo COLLATE Modern_Spanish_CI_AI) > 0
            OR CHARINDEX(@Texto COLLATE Modern_Spanish_CI_AI, Descripcion COLLATE Modern_Spanish_CI_AI) > 0
          )
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total FROM #Resultado;

    SELECT
        IDCupon, Codigo, Descripcion, TipoDescuento, Valor, MontoMinimo, FechaInicio, FechaFin,
        LimiteUsosTotal, LimiteUsosCliente, UsosActuales, IDCategoria, Categoria, Activo, Estado
    FROM #Resultado
    ORDER BY FechaCreacion DESC, IDCupon DESC
    OFFSET (@Pagina - 1) * @TamanioPagina ROWS
    FETCH NEXT @TamanioPagina ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Obtener
    @IDCupon INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Cupones WHERE IDCupon = @IDCupon)
        THROW 50404, 'Cupon no encontrado.', 1;

    SELECT
        IDCupon, Codigo, Descripcion, TipoDescuento, Valor, MontoMinimo, FechaInicio, FechaFin,
        LimiteUsosTotal, LimiteUsosCliente, UsosActuales, IDCategoria, Categoria, Activo, Estado
    FROM dbo.VW_Cupones_Detalle
    WHERE IDCupon = @IDCupon;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Crear
    @Codigo             VARCHAR(30),
    @Descripcion        NVARCHAR(250) = NULL,
    @TipoDescuento      VARCHAR(10),
    @Valor              DECIMAL(12,2),
    @MontoMinimo        DECIMAL(12,2) = 0,
    @FechaInicio        DATETIME2(3),
    @FechaFin           DATETIME2(3),
    @LimiteUsosTotal    INT,
    @LimiteUsosCliente  INT = 1,
    @IDCategoria        INT = NULL,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCupon INT, @Despues NVARCHAR(MAX);

    BEGIN TRY
        BEGIN TRAN;

        IF @IDCategoria IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
            THROW 50400, 'La categoria indicada no existe.', 1;

        INSERT INTO dbo.Cupones
            (Codigo, Descripcion, TipoDescuento, Valor, MontoMinimo, FechaInicio, FechaFin,
             LimiteUsosTotal, LimiteUsosCliente, IDCategoria)
        VALUES
            (UPPER(@Codigo), @Descripcion, @TipoDescuento, @Valor, @MontoMinimo, @FechaInicio, @FechaFin,
             @LimiteUsosTotal, @LimiteUsosCliente, @IDCategoria);

        SET @IDCupon = SCOPE_IDENTITY();
        SELECT @Despues = Valor FROM dbo.FU_Cupones_CuponJson(@IDCupon);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CUPONES', 'Cupones', @IDCupon, 'CREAR', NULL, @Despues;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 50409, 'Ya existe un cupon con ese codigo.', 1;
        THROW;
    END CATCH

    EXEC dbo.SP_Cupones_Obtener @IDCupon = @IDCupon;
END
GO

-- Los pedidos ya hechos no cambian: guardan su propio descuento.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Actualizar
    @IDCupon            INT,
    @Codigo             VARCHAR(30),
    @Descripcion        NVARCHAR(250) = NULL,
    @TipoDescuento      VARCHAR(10),
    @Valor              DECIMAL(12,2),
    @MontoMinimo        DECIMAL(12,2) = 0,
    @FechaInicio        DATETIME2(3),
    @FechaFin           DATETIME2(3),
    @LimiteUsosTotal    INT,
    @LimiteUsosCliente  INT = 1,
    @IDCategoria        INT = NULL,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UsosActuales INT, @Antes NVARCHAR(MAX), @Despues NVARCHAR(MAX), @Mensaje NVARCHAR(200);

    BEGIN TRY
        BEGIN TRAN;

        SELECT @UsosActuales = UsosActuales
        FROM dbo.Cupones WITH (UPDLOCK, HOLDLOCK)
        WHERE IDCupon = @IDCupon;

        IF @UsosActuales IS NULL
            THROW 50404, 'Cupon no encontrado.', 1;

        IF @LimiteUsosTotal < @UsosActuales
        BEGIN
            SET @Mensaje = CONCAT(N'El limite total no puede ser menor que los usos ya registrados (', @UsosActuales, N').');
            THROW 50409, @Mensaje, 1;
        END

        IF @IDCategoria IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
            THROW 50400, 'La categoria indicada no existe.', 1;

        SELECT @Antes = Valor FROM dbo.FU_Cupones_CuponJson(@IDCupon);

        UPDATE dbo.Cupones
        SET Codigo = UPPER(@Codigo),
            Descripcion = @Descripcion,
            TipoDescuento = @TipoDescuento,
            Valor = @Valor,
            MontoMinimo = @MontoMinimo,
            FechaInicio = @FechaInicio,
            FechaFin = @FechaFin,
            LimiteUsosTotal = @LimiteUsosTotal,
            LimiteUsosCliente = @LimiteUsosCliente,
            IDCategoria = @IDCategoria,
            FechaModificacion = SYSUTCDATETIME()
        WHERE IDCupon = @IDCupon;

        SELECT @Despues = Valor FROM dbo.FU_Cupones_CuponJson(@IDCupon);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CUPONES', 'Cupones', @IDCupon, 'MODIFICAR', @Antes, @Despues;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 50409, 'Ya existe un cupon con ese codigo.', 1;
        THROW;
    END CATCH

    EXEC dbo.SP_Cupones_Obtener @IDCupon = @IDCupon;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Cupones_CambiarEstado
    @IDCupon            INT,
    @Activo             BIT,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ActivoActual BIT, @Antes NVARCHAR(MAX), @Despues NVARCHAR(MAX);
    DECLARE @Accion VARCHAR(15) = CASE WHEN @Activo = 1 THEN 'ACTIVAR' ELSE 'DESACTIVAR' END;

    BEGIN TRAN;

    SELECT @ActivoActual = Activo
    FROM dbo.Cupones WITH (UPDLOCK, HOLDLOCK)
    WHERE IDCupon = @IDCupon;

    IF @ActivoActual IS NULL
        THROW 50404, 'Cupon no encontrado.', 1;

    IF @ActivoActual <> @Activo
    BEGIN
        SELECT @Antes = Valor FROM dbo.FU_Cupones_CuponJson(@IDCupon);

        UPDATE dbo.Cupones
        SET Activo = @Activo,
            FechaModificacion = SYSUTCDATETIME()
        WHERE IDCupon = @IDCupon;

        SELECT @Despues = Valor FROM dbo.FU_Cupones_CuponJson(@IDCupon);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CUPONES', 'Cupones', @IDCupon, @Accion, @Antes, @Despues;
    END

    COMMIT;

    EXEC dbo.SP_Cupones_Obtener @IDCupon = @IDCupon;
END
GO

-- Borrado físico solo si nunca se usó. Si está aplicado en carritos, se les quita.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Eliminar
    @IDCupon            INT,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Antes NVARCHAR(MAX);

    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM dbo.Cupones WITH (UPDLOCK, HOLDLOCK) WHERE IDCupon = @IDCupon)
        THROW 50404, 'Cupon no encontrado.', 1;

    IF EXISTS (SELECT 1 FROM dbo.CuponUsos WHERE IDCupon = @IDCupon)
       OR EXISTS (SELECT 1 FROM dbo.Pedidos WHERE IDCupon = @IDCupon)
        THROW 50409, 'El cupon ya fue usado en pedidos. Desactivelo en lugar de eliminarlo.', 1;

    SELECT @Antes = Valor FROM dbo.FU_Cupones_CuponJson(@IDCupon);

    UPDATE dbo.Carritos SET IDCupon = NULL WHERE IDCupon = @IDCupon;
    DELETE FROM dbo.Cupones WHERE IDCupon = @IDCupon;

    EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CUPONES', 'Cupones', @IDCupon, 'ELIMINAR', @Antes, NULL;

    COMMIT;
END
GO
