/*
    021_SP_Reportes.sql
    Dashboard y reportes. Todas las ventas salen de VW_Reportes_VentasNetas.
    Fechas: días calendario de Guatemala; se filtran contra FechaCreacion en UTC.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===== Base de todos los reportes ===== */

-- Ventas netas por línea de pedido: excluye pedidos cancelados y descuenta lo devuelto de cada línea
-- (con el monto exacto reembolsado). El envío no cuenta como venta.
-- "Completado" = pagado y no cancelado; los SPs pueden restringir a entregados con @SoloEntregados.
CREATE OR ALTER VIEW dbo.VW_Reportes_VentasNetas
AS
SELECT
    p.IDPedido,
    p.FechaCreacion,
    CAST(p.FechaCreacion AT TIME ZONE 'UTC' AT TIME ZONE 'Central America Standard Time' AS DATE) AS FechaLocal,
    e.Codigo AS Estado,
    d.IDPedidoDetalle,
    d.IDVariante,
    v.IDProducto,
    pr.IDCategoria,
    d.Cantidad - d.CantidadDevuelta AS UnidadesNetas,
    d.Total - ISNULL(r.Reembolsado, 0) AS MontoNeto,
    ISNULL(r.Reembolsado, 0) AS MontoDevuelto
FROM dbo.Pedidos p
INNER JOIN dbo.EstadosPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
INNER JOIN dbo.PedidoDetalle d ON d.IDPedido = p.IDPedido
INNER JOIN dbo.Variantes v ON v.IDVariante = d.IDVariante
INNER JOIN dbo.Productos pr ON pr.IDProducto = v.IDProducto
OUTER APPLY
(
    SELECT SUM(dd.Monto) AS Reembolsado
    FROM dbo.DevolucionDetalle dd
    WHERE dd.IDPedidoDetalle = d.IDPedidoDetalle
) r
WHERE e.Codigo <> 'CANCELADO';
GO

-- Ventas netas del rango, ya filtradas. La usan todos los reportes de ventas.
CREATE OR ALTER FUNCTION dbo.FU_Reportes_Ventas
(
    @FechaDesde     DATE,
    @FechaHasta     DATE,
    @SoloEntregados BIT
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        v.IDPedido, v.FechaCreacion, v.FechaLocal, v.Estado, v.IDPedidoDetalle, v.IDVariante,
        v.IDProducto, v.IDCategoria, v.UnidadesNetas, v.MontoNeto, v.MontoDevuelto
    FROM dbo.VW_Reportes_VentasNetas v
    WHERE v.FechaCreacion >= CAST(CAST(@FechaDesde AS DATETIME2(3)) AT TIME ZONE 'Central America Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(3))
      AND v.FechaCreacion < CAST(CAST(DATEADD(DAY, 1, @FechaHasta) AS DATETIME2(3)) AT TIME ZONE 'Central America Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(3))
      AND (@SoloEntregados = 0 OR v.Estado IN ('ENTREGADO', 'DEVUELTO_PARCIAL', 'DEVUELTO'))
);
GO

/* ===== Reportes ===== */

-- Indicadores del dashboard para el rango.
-- Ticket promedio = ventas netas / pedidos pagados del periodo (definición del glosario).
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_Resumen
    @FechaDesde         DATE,
    @FechaHasta         DATE,
    @SoloEntregados     BIT = 0,
    @MinutosAbandono    INT = 60
AS
BEGIN
    SET NOCOUNT ON;

    IF @FechaDesde IS NULL OR @FechaHasta IS NULL OR @FechaDesde > @FechaHasta
        THROW 50400, 'Rango de fechas invalido.', 1;

    DECLARE @DesdeUtc DATETIME2(3) =
        CAST(CAST(@FechaDesde AS DATETIME2(3)) AT TIME ZONE 'Central America Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(3));
    DECLARE @HastaUtc DATETIME2(3) =
        CAST(CAST(DATEADD(DAY, 1, @FechaHasta) AS DATETIME2(3)) AT TIME ZONE 'Central America Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(3));

    SELECT
        ISNULL(SUM(v.MontoNeto), 0) AS VentasNetas,
        COUNT(DISTINCT v.IDPedido) AS Pedidos,
        ISNULL(SUM(v.UnidadesNetas), 0) AS Unidades,
        CAST(ROUND(ISNULL(SUM(v.MontoNeto), 0) / NULLIF(COUNT(DISTINCT v.IDPedido), 0), 2) AS DECIMAL(12,2)) AS TicketPromedio,
        ISNULL(SUM(v.MontoDevuelto), 0) AS MontoDevuelto,
        (
            SELECT COUNT(*)
            FROM dbo.Pedidos p
            INNER JOIN dbo.EstadosPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
            WHERE e.Codigo = 'CANCELADO'
              AND p.FechaCreacion >= @DesdeUtc
              AND p.FechaCreacion < @HastaUtc
        ) AS PedidosCancelados,
        -- Carritos abandonados es una foto de ahora, no depende del rango.
        (
            SELECT COUNT(*)
            FROM dbo.Carritos c
            WHERE c.Estado = 'ACTIVO'
              AND c.FechaUltimaActividad < DATEADD(MINUTE, -@MinutosAbandono, SYSUTCDATETIME())
              AND EXISTS (SELECT 1 FROM dbo.CarritoDetalle cd WHERE cd.IDCarrito = c.IDCarrito)
        ) AS CarritosAbandonados
    FROM dbo.FU_Reportes_Ventas(@FechaDesde, @FechaHasta, @SoloEntregados) v;
END
GO

-- Ventas y número de pedidos por día, semana (inicia lunes) o mes. Los periodos sin ventas
-- aparecen en cero para que la gráfica no tenga huecos. Rango máximo: dos años.
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_VentasPorPeriodo
    @FechaDesde     DATE,
    @FechaHasta     DATE,
    @Agrupacion     VARCHAR(10) = 'DIA',
    @SoloEntregados BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @FechaDesde IS NULL OR @FechaHasta IS NULL OR @FechaDesde > @FechaHasta
        THROW 50400, 'Rango de fechas invalido.', 1;

    IF DATEDIFF(DAY, @FechaDesde, @FechaHasta) > 731
        THROW 50400, 'El rango no puede ser mayor a dos anios.', 1;

    IF @Agrupacion NOT IN ('DIA', 'SEMANA', 'MES')
        THROW 50400, 'Agrupacion invalida.', 1;

    WITH Digitos AS
    (
        SELECT n FROM (VALUES (0), (1), (2), (3), (4), (5), (6), (7), (8), (9)) d (n)
    ),
    Numeros AS
    (
        SELECT a.n + b.n * 10 + c.n * 100 AS n
        FROM Digitos a CROSS JOIN Digitos b CROSS JOIN Digitos c
    ),
    Dias AS
    (
        SELECT DATEADD(DAY, n, @FechaDesde) AS Dia
        FROM Numeros
        WHERE n <= DATEDIFF(DAY, @FechaDesde, @FechaHasta)
    ),
    -- 1900-01-01 fue lunes: restando los días transcurridos módulo 7 se llega al lunes de la semana.
    Periodos AS
    (
        SELECT DISTINCT
            CASE @Agrupacion
                WHEN 'DIA' THEN Dia
                WHEN 'SEMANA' THEN DATEADD(DAY, -(DATEDIFF(DAY, '19000101', Dia) % 7), Dia)
                ELSE DATEFROMPARTS(YEAR(Dia), MONTH(Dia), 1)
            END AS Periodo
        FROM Dias
    ),
    Ventas AS
    (
        SELECT
            CASE @Agrupacion
                WHEN 'DIA' THEN v.FechaLocal
                WHEN 'SEMANA' THEN DATEADD(DAY, -(DATEDIFF(DAY, '19000101', v.FechaLocal) % 7), v.FechaLocal)
                ELSE DATEFROMPARTS(YEAR(v.FechaLocal), MONTH(v.FechaLocal), 1)
            END AS Periodo,
            v.IDPedido,
            v.MontoNeto,
            v.UnidadesNetas
        FROM dbo.FU_Reportes_Ventas(@FechaDesde, @FechaHasta, @SoloEntregados) v
    )
    SELECT
        pe.Periodo,
        ISNULL(SUM(v.MontoNeto), 0) AS Ventas,
        COUNT(DISTINCT v.IDPedido) AS Pedidos,
        ISNULL(SUM(v.UnidadesNetas), 0) AS Unidades
    FROM Periodos pe
    LEFT JOIN Ventas v ON v.Periodo = pe.Periodo
    GROUP BY pe.Periodo
    ORDER BY pe.Periodo;
END
GO

-- Ventas por categoría, con su porcentaje del total. Las categorías activas sin ventas salen en cero.
-- Se usa la categoría actual del producto.
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_VentasPorCategoria
    @FechaDesde     DATE,
    @FechaHasta     DATE,
    @SoloEntregados BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @FechaDesde IS NULL OR @FechaHasta IS NULL OR @FechaDesde > @FechaHasta
        THROW 50400, 'Rango de fechas invalido.', 1;

    WITH PorCategoria AS
    (
        SELECT
            IDCategoria,
            SUM(MontoNeto) AS Ventas,
            SUM(UnidadesNetas) AS Unidades,
            COUNT(DISTINCT IDPedido) AS Pedidos
        FROM dbo.FU_Reportes_Ventas(@FechaDesde, @FechaHasta, @SoloEntregados)
        GROUP BY IDCategoria
    )
    SELECT
        c.IDCategoria,
        c.Nombre AS Categoria,
        ISNULL(pc.Ventas, 0) AS Ventas,
        ISNULL(pc.Unidades, 0) AS Unidades,
        ISNULL(pc.Pedidos, 0) AS Pedidos,
        CAST(ISNULL(ROUND(pc.Ventas * 100 / NULLIF(SUM(pc.Ventas) OVER (), 0), 2), 0) AS DECIMAL(5,2)) AS Porcentaje
    FROM dbo.Categorias c
    LEFT JOIN PorCategoria pc ON pc.IDCategoria = c.IDCategoria
    WHERE c.Activo = 1 OR pc.IDCategoria IS NOT NULL
    ORDER BY ISNULL(pc.Ventas, 0) DESC, c.Nombre;
END
GO

-- Los @Top productos con más unidades netas vendidas (desempate por monto).
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_ProductosMasVendidos
    @FechaDesde     DATE,
    @FechaHasta     DATE,
    @Top            INT = 10,
    @SoloEntregados BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @FechaDesde IS NULL OR @FechaHasta IS NULL OR @FechaDesde > @FechaHasta
        THROW 50400, 'Rango de fechas invalido.', 1;

    IF @Top NOT BETWEEN 1 AND 50
        THROW 50400, 'El top debe estar entre 1 y 50.', 1;

    SELECT TOP (@Top)
        pr.IDProducto,
        pr.Nombre AS Producto,
        c.Nombre AS Categoria,
        SUM(v.UnidadesNetas) AS Unidades,
        SUM(v.MontoNeto) AS Ventas,
        COUNT(DISTINCT v.IDPedido) AS Pedidos
    FROM dbo.FU_Reportes_Ventas(@FechaDesde, @FechaHasta, @SoloEntregados) v
    INNER JOIN dbo.Productos pr ON pr.IDProducto = v.IDProducto
    INNER JOIN dbo.Categorias c ON c.IDCategoria = pr.IDCategoria
    GROUP BY pr.IDProducto, pr.Nombre, c.Nombre
    HAVING SUM(v.UnidadesNetas) > 0
    ORDER BY SUM(v.UnidadesNetas) DESC, SUM(v.MontoNeto) DESC, pr.Nombre;
END
GO

-- Carritos activos con productos y sin actividad en los últimos @MinutosInactividad.
-- El monto es estimado con los precios vigentes.
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_CarritosAbandonados
    @MinutosInactividad INT = 60,
    @Pagina             INT = 1,
    @TamanioPagina      INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @TamanioPagina NOT BETWEEN 1 AND 100
        THROW 50400, 'Parametros de paginacion invalidos.', 1;

    IF @MinutosInactividad IS NULL OR @MinutosInactividad < 1
        THROW 50400, 'Los minutos de inactividad deben ser mayores que cero.', 1;

    DECLARE @Limite DATETIME2(3) = DATEADD(MINUTE, -@MinutosInactividad, SYSUTCDATETIME());

    SELECT
        c.IDCarrito,
        c.IDUsuario,
        u.Nombres,
        u.Apellidos,
        u.Correo,
        c.FechaUltimaActividad,
        DATEDIFF(MINUTE, c.FechaUltimaActividad, SYSUTCDATETIME()) AS MinutosInactivo,
        x.Articulos,
        x.MontoEstimado
    INTO #Resultado
    FROM dbo.Carritos c
    LEFT JOIN dbo.Usuarios u ON u.IDUsuario = c.IDUsuario
    CROSS APPLY
    (
        SELECT SUM(cd.Cantidad) AS Articulos, SUM(cd.Cantidad * v.Precio) AS MontoEstimado
        FROM dbo.CarritoDetalle cd
        INNER JOIN dbo.Variantes v ON v.IDVariante = cd.IDVariante
        WHERE cd.IDCarrito = c.IDCarrito
    ) x
    WHERE c.Estado = 'ACTIVO'
      AND c.FechaUltimaActividad < @Limite
      AND x.Articulos IS NOT NULL;

    SELECT COUNT(*) AS Total, ISNULL(SUM(MontoEstimado), 0) AS MontoTotal FROM #Resultado;

    SELECT
        IDCarrito, IDUsuario, Nombres, Apellidos, Correo, FechaUltimaActividad,
        MinutosInactivo, Articulos, MontoEstimado
    FROM #Resultado
    ORDER BY FechaUltimaActividad, IDCarrito
    OFFSET (@Pagina - 1) * @TamanioPagina ROWS
    FETCH NEXT @TamanioPagina ROWS ONLY;
END
GO
