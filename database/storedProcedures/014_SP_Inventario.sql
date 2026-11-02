/*
    014_SP_Inventario.sql
    Movimientos de existencia (kardex), consultas de inventario, conciliación y liberación de reservas.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===== Movimiento de existencia (uso interno) ===== */

-- Único punto que modifica Variantes.ExistenciaFisica: actualiza la variante, escribe el kardex
-- y la bitácora en una sola transacción. Lo usan entradas, ajustes, ventas, cancelaciones y devoluciones.
-- @AjusteReservada: en una venta la unidad sale de lo físico y de lo reservado al mismo tiempo.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarMovimiento
    @IDVariante         INT,
    @TipoMovimiento     VARCHAR(15),
    @Cantidad           INT,
    @Motivo             NVARCHAR(250) = NULL,
    @IDPedido           INT = NULL,
    @IDUsuario          INT,
    @AjusteReservada    INT = 0,
    @IDKardex           INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Saldo TABLE (Anterior INT, Nueva INT);
    DECLARE @Anterior INT, @Nueva INT, @Antes NVARCHAR(MAX), @Despues NVARCHAR(MAX);

    BEGIN TRAN;

    -- Validación y cambio en una sola sentencia: dos movimientos simultáneos no pueden
    -- leer el mismo saldo y dejar la existencia por debajo de lo reservado.
    UPDATE dbo.Variantes
    SET ExistenciaFisica = ExistenciaFisica + @Cantidad,
        ExistenciaReservada = ExistenciaReservada + @AjusteReservada,
        FechaModificacion = SYSUTCDATETIME()
    OUTPUT deleted.ExistenciaFisica, inserted.ExistenciaFisica INTO @Saldo (Anterior, Nueva)
    WHERE IDVariante = @IDVariante
      AND ExistenciaFisica + @Cantidad >= ExistenciaReservada + @AjusteReservada;

    IF @@ROWCOUNT = 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Variantes WHERE IDVariante = @IDVariante)
            THROW 50404, 'Variante no encontrada.', 1;
        THROW 50409, 'Existencia insuficiente: el movimiento dejaria la existencia en negativo o por debajo de las unidades reservadas.', 1;
    END

    SELECT @Anterior = Anterior, @Nueva = Nueva FROM @Saldo;

    INSERT INTO dbo.Kardex (IDVariante, TipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo, IDPedido, IDUsuario)
    VALUES (@IDVariante, @TipoMovimiento, @Cantidad, @Anterior, @Nueva, @Motivo, @IDPedido, @IDUsuario);

    SET @IDKardex = SCOPE_IDENTITY();

    SET @Antes = (SELECT @Anterior AS ExistenciaFisica FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    SET @Despues =
    (
        SELECT @Nueva AS ExistenciaFisica, @TipoMovimiento AS TipoMovimiento, @Cantidad AS Cantidad,
               @Motivo AS Motivo, @IDPedido AS IDPedido, @IDKardex AS IDKardex
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
    );

    EXEC dbo.SP_Bitacora_Registrar @IDUsuario, 'INVENTARIO', 'Variantes', @IDVariante, 'MODIFICAR', @Antes, @Despues;

    COMMIT;
END
GO

IF USER_ID('shopcart_app') IS NOT NULL
    DENY EXECUTE ON dbo.SP_Inventario_RegistrarMovimiento TO shopcart_app;
GO

/* ===== Consultas ===== */

CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ObtenerMovimiento
    @IDKardex INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        k.IDKardex, k.Fecha, k.TipoMovimiento, k.Cantidad, k.ExistenciaAnterior, k.ExistenciaNueva,
        k.Motivo, k.IDPedido, k.IDUsuario, u.Nombres, u.Apellidos,
        v.IDVariante, v.SKU, v.ExistenciaFisica, v.ExistenciaReservada, v.ExistenciaDisponible
    FROM dbo.Kardex k
    INNER JOIN dbo.Variantes v ON v.IDVariante = k.IDVariante
    INNER JOIN dbo.Usuarios u ON u.IDUsuario = k.IDUsuario
    WHERE k.IDKardex = @IDKardex;
END
GO

-- @ExistenciaMaxima: variantes con disponible <= N (0 = agotadas, 5 = existencia baja).
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarExistencias
    @Texto              NVARCHAR(100) = NULL,
    @IDCategoria        INT = NULL,
    @ExistenciaMaxima   INT = NULL,
    @Activo             BIT = NULL,
    @Orden              VARCHAR(20) = 'sku',
    @Pagina             INT = 1,
    @TamanioPagina      INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @TamanioPagina NOT BETWEEN 1 AND 100
        THROW 50400, 'Parametros de paginacion invalidos.', 1;

    SELECT
        v.IDVariante, v.SKU, v.IDProducto, p.Nombre AS Producto, c.Nombre AS Categoria,
        v.Talla, v.Color, v.Precio,
        v.ExistenciaFisica, v.ExistenciaReservada, v.ExistenciaDisponible,
        v.Activo, p.Activo AS ProductoActivo
    INTO #Resultado
    FROM dbo.Variantes v
    INNER JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    INNER JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
    WHERE (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
      AND (@ExistenciaMaxima IS NULL OR v.ExistenciaDisponible <= @ExistenciaMaxima)
      AND (@Activo IS NULL OR v.Activo = @Activo)
      AND (
            @Texto IS NULL
            OR CHARINDEX(@Texto COLLATE Modern_Spanish_CI_AI, v.SKU COLLATE Modern_Spanish_CI_AI) > 0
            OR CHARINDEX(@Texto COLLATE Modern_Spanish_CI_AI, p.Nombre COLLATE Modern_Spanish_CI_AI) > 0
          )
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total FROM #Resultado;

    SELECT
        IDVariante, SKU, IDProducto, Producto, Categoria, Talla, Color, Precio,
        ExistenciaFisica, ExistenciaReservada, ExistenciaDisponible, Activo, ProductoActivo
    FROM #Resultado
    ORDER BY
        CASE WHEN @Orden = 'disponible' THEN ExistenciaDisponible END ASC,
        SKU
    OFFSET (@Pagina - 1) * @TamanioPagina ROWS
    FETCH NEXT @TamanioPagina ROWS ONLY;
END
GO

-- Las fechas del filtro son días calendario de Guatemala; el kardex guarda UTC.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarKardex
    @IDVariante         INT,
    @TipoMovimiento     VARCHAR(15) = NULL,
    @FechaDesde         DATE = NULL,
    @FechaHasta         DATE = NULL,
    @Pagina             INT = 1,
    @TamanioPagina      INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @TamanioPagina NOT BETWEEN 1 AND 100
        THROW 50400, 'Parametros de paginacion invalidos.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Variantes WHERE IDVariante = @IDVariante)
        THROW 50404, 'Variante no encontrada.', 1;

    DECLARE @DesdeUtc DATETIME2(3) =
        CAST(CAST(@FechaDesde AS DATETIME2(3)) AT TIME ZONE 'Central America Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(3));
    DECLARE @HastaUtc DATETIME2(3) =
        CAST(CAST(DATEADD(DAY, 1, @FechaHasta) AS DATETIME2(3)) AT TIME ZONE 'Central America Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(3));

    SELECT
        v.IDVariante, v.SKU, p.Nombre AS Producto, v.Talla, v.Color,
        v.ExistenciaFisica, v.ExistenciaReservada, v.ExistenciaDisponible
    FROM dbo.Variantes v
    INNER JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    WHERE v.IDVariante = @IDVariante;

    SELECT COUNT(*) AS Total
    FROM dbo.Kardex k
    WHERE k.IDVariante = @IDVariante
      AND (@TipoMovimiento IS NULL OR k.TipoMovimiento = @TipoMovimiento)
      AND (@DesdeUtc IS NULL OR k.Fecha >= @DesdeUtc)
      AND (@HastaUtc IS NULL OR k.Fecha < @HastaUtc);

    SELECT
        k.IDKardex, k.Fecha, k.TipoMovimiento, k.Cantidad, k.ExistenciaAnterior, k.ExistenciaNueva,
        k.Motivo, k.IDPedido, k.IDUsuario, u.Nombres, u.Apellidos
    FROM dbo.Kardex k
    INNER JOIN dbo.Usuarios u ON u.IDUsuario = k.IDUsuario
    WHERE k.IDVariante = @IDVariante
      AND (@TipoMovimiento IS NULL OR k.TipoMovimiento = @TipoMovimiento)
      AND (@DesdeUtc IS NULL OR k.Fecha >= @DesdeUtc)
      AND (@HastaUtc IS NULL OR k.Fecha < @HastaUtc)
    ORDER BY k.Fecha DESC, k.IDKardex DESC
    OFFSET (@Pagina - 1) * @TamanioPagina ROWS
    FETCH NEXT @TamanioPagina ROWS ONLY;
END
GO

/* ===== Movimientos manuales ===== */

CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarEntrada
    @IDVariante         INT,
    @Cantidad           INT,
    @Motivo             NVARCHAR(250),
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDKardex INT;

    IF @Cantidad IS NULL OR @Cantidad <= 0
        THROW 50400, 'La cantidad de una entrada debe ser mayor que cero.', 1;

    IF LEN(LTRIM(ISNULL(@Motivo, N''))) = 0
        THROW 50400, 'La entrada requiere un motivo.', 1;

    EXEC dbo.SP_Inventario_RegistrarMovimiento
        @IDVariante = @IDVariante,
        @TipoMovimiento = 'ENTRADA',
        @Cantidad = @Cantidad,
        @Motivo = @Motivo,
        @IDUsuario = @IDUsuarioAccion,
        @IDKardex = @IDKardex OUTPUT;

    EXEC dbo.SP_Inventario_ObtenerMovimiento @IDKardex = @IDKardex;
END
GO

-- Cantidad positiva suma, negativa resta. No puede dejar la existencia en negativo
-- ni por debajo de lo que está reservado en checkouts en curso.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarAjuste
    @IDVariante         INT,
    @Cantidad           INT,
    @Motivo             NVARCHAR(250),
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDKardex INT;

    IF @Cantidad IS NULL OR @Cantidad = 0
        THROW 50400, 'La cantidad del ajuste no puede ser cero.', 1;

    IF LEN(LTRIM(ISNULL(@Motivo, N''))) = 0
        THROW 50400, 'El ajuste requiere un motivo.', 1;

    EXEC dbo.SP_Inventario_RegistrarMovimiento
        @IDVariante = @IDVariante,
        @TipoMovimiento = 'AJUSTE',
        @Cantidad = @Cantidad,
        @Motivo = @Motivo,
        @IDUsuario = @IDUsuarioAccion,
        @IDKardex = @IDKardex OUTPUT;

    EXEC dbo.SP_Inventario_ObtenerMovimiento @IDKardex = @IDKardex;
END
GO

/* ===== Conciliación ===== */

-- Lo que la existencia dice contra lo que dicen los movimientos.
CREATE OR ALTER VIEW dbo.VW_Inventario_Conciliacion
AS
SELECT
    v.IDVariante,
    v.SKU,
    v.ExistenciaFisica,
    ISNULL(k.SumaKardex, 0) AS SumaKardex,
    v.ExistenciaReservada,
    ISNULL(r.ReservasActivas, 0) AS ReservasActivas
FROM dbo.Variantes v
LEFT JOIN
(
    SELECT IDVariante, SUM(Cantidad) AS SumaKardex
    FROM dbo.Kardex
    GROUP BY IDVariante
) k ON k.IDVariante = v.IDVariante
LEFT JOIN
(
    SELECT IDVariante, SUM(Cantidad) AS ReservasActivas
    FROM dbo.Reservas
    WHERE Estado = 'ACTIVA'
    GROUP BY IDVariante
) r ON r.IDVariante = v.IDVariante;
GO

-- Primer resultado: cuántas variantes se revisaron. Segundo: las que no cuadran (debería venir vacío).
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_Conciliar
AS
BEGIN
    SET NOCOUNT ON;

    SELECT COUNT(*) AS VariantesRevisadas FROM dbo.VW_Inventario_Conciliacion;

    SELECT IDVariante, SKU, ExistenciaFisica, SumaKardex, ExistenciaReservada, ReservasActivas
    FROM dbo.VW_Inventario_Conciliacion
    WHERE ExistenciaFisica <> SumaKardex
       OR ExistenciaReservada <> ReservasActivas
    ORDER BY SKU;
END
GO

/* ===== Reservas ===== */

-- Libera reservas activas y devuelve las unidades a lo disponible (uso interno).
-- @IDCarrito NULL: todas las vencidas. Con valor: todas las de ese carrito
-- (el cliente modificó el carrito o reinicia el checkout).
-- Orden de bloqueo en todo el sistema: Reservas antes que Variantes.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_LiberarReservas
    @IDCarrito  INT = NULL,
    @Liberadas  INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Filas TABLE (IDVariante INT, Cantidad INT);

    BEGIN TRAN;

    UPDATE dbo.Reservas
    SET Estado = 'LIBERADA',
        FechaCierre = SYSUTCDATETIME()
    OUTPUT inserted.IDVariante, inserted.Cantidad INTO @Filas (IDVariante, Cantidad)
    WHERE Estado = 'ACTIVA'
      AND (
            (@IDCarrito IS NULL AND FechaExpiracion <= SYSUTCDATETIME())
            OR IDCarrito = @IDCarrito
          )
    OPTION (RECOMPILE);

    UPDATE v
    SET v.ExistenciaReservada = v.ExistenciaReservada - l.Total
    FROM dbo.Variantes v
    INNER JOIN
    (
        SELECT IDVariante, SUM(Cantidad) AS Total
        FROM @Filas
        GROUP BY IDVariante
    ) l ON l.IDVariante = v.IDVariante;

    COMMIT;

    SET @Liberadas = (SELECT COUNT(*) FROM @Filas);
END
GO

IF USER_ID('shopcart_app') IS NOT NULL
    DENY EXECUTE ON dbo.SP_Inventario_LiberarReservas TO shopcart_app;
GO

-- Reserva todas las líneas de un carrito por @MinutosReserva y congela su precio vigente (uso interno).
-- Todo o nada: si una variante no alcanza, se revierte y no queda ninguna reserva.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ReservarExistencia
    @IDCarrito      INT,
    @MinutosReserva INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Lineas INT, @Reservadas INT, @Mensaje NVARCHAR(300);
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @Hechas TABLE (IDVariante INT PRIMARY KEY);

    BEGIN TRAN;

    -- Reiniciar: lo que este carrito tuviera reservado vuelve a estar disponible.
    EXEC dbo.SP_Inventario_LiberarReservas @IDCarrito = @IDCarrito;

    SELECT @Lineas = COUNT(*) FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito;

    -- Cada fila se valida y se reserva en la misma sentencia. Si dos clientes van por la última
    -- unidad, el segundo espera el bloqueo de la fila, la encuentra ya reservada y no la toma.
    -- CK_Variantes_Reservada (reservado <= físico) es la barrera final.
    UPDATE v
    SET v.ExistenciaReservada = v.ExistenciaReservada + cd.Cantidad
    OUTPUT inserted.IDVariante INTO @Hechas (IDVariante)
    FROM dbo.Variantes v
    INNER JOIN dbo.CarritoDetalle cd ON cd.IDVariante = v.IDVariante
    INNER JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    INNER JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
    WHERE cd.IDCarrito = @IDCarrito
      AND v.Activo = 1 AND p.Activo = 1 AND c.Activo = 1
      AND v.ExistenciaFisica - v.ExistenciaReservada >= cd.Cantidad;

    SET @Reservadas = @@ROWCOUNT;

    IF @Reservadas < @Lineas
    BEGIN
        SELECT TOP (1) @Mensaje =
            CASE
                WHEN v.Activo = 0 OR p.Activo = 0 OR c.Activo = 0
                    THEN CONCAT(N'El producto ', v.SKU, N' ya no esta disponible. Quitelo del carrito para continuar.')
                WHEN v.ExistenciaFisica - v.ExistenciaReservada <= 0
                    THEN CONCAT(N'Ya no hay existencia de ', v.SKU, N'.')
                ELSE CONCAT(N'No hay existencia suficiente de ', v.SKU, N': quedan ', v.ExistenciaFisica - v.ExistenciaReservada, N' unidades.')
            END
        FROM dbo.CarritoDetalle cd
        INNER JOIN dbo.Variantes v ON v.IDVariante = cd.IDVariante
        INNER JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
        INNER JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
        WHERE cd.IDCarrito = @IDCarrito
          AND NOT EXISTS (SELECT 1 FROM @Hechas h WHERE h.IDVariante = cd.IDVariante)
        ORDER BY v.SKU;

        THROW 50409, @Mensaje, 1;
    END

    INSERT INTO dbo.Reservas (IDCarrito, IDVariante, Cantidad, PrecioUnitario, FechaCreacion, FechaExpiracion)
    SELECT @IDCarrito, cd.IDVariante, cd.Cantidad, v.Precio, @Ahora, DATEADD(MINUTE, @MinutosReserva, @Ahora)
    FROM dbo.CarritoDetalle cd
    INNER JOIN dbo.Variantes v ON v.IDVariante = cd.IDVariante
    WHERE cd.IDCarrito = @IDCarrito;

    COMMIT;
END
GO

IF USER_ID('shopcart_app') IS NOT NULL
    DENY EXECUTE ON dbo.SP_Inventario_ReservarExistencia TO shopcart_app;
GO

-- Lo ejecuta un proceso del backend cada minuto. Es seguro correrlo en paralelo:
-- el UPDATE bloquea las filas que cambia y una segunda ejecución ya no las encuentra activas.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_LiberarReservasVencidas
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Liberadas INT;

    EXEC dbo.SP_Inventario_LiberarReservas @IDCarrito = NULL, @Liberadas = @Liberadas OUTPUT;

    SELECT @Liberadas AS ReservasLiberadas;
END
GO
