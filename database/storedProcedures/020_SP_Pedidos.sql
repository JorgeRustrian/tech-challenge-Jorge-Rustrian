/*
    020_SP_Pedidos.sql
    Ciclo de vida del pedido: listado, cambios de estado, cancelación y devoluciones.
    Cada cambio de estado deja historial (usuario, fecha, estado anterior y nuevo) y bitácora.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===== Transición de estado (uso interno) ===== */

-- Valida contra TransicionesEstado con el pedido bloqueado, aplica el cambio y deja historial y bitácora.
-- Cancelar reintegra al inventario todo lo vendido (kardex CANCELACION).
-- TR_Pedidos_ValidarTransicion vuelve a revisar la transición al hacer el UPDATE.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_AplicarTransicion
    @IDPedido           INT,
    @EstadoNuevo        VARCHAR(20),
    @Comentario         NVARCHAR(250) = NULL,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDEstadoActual INT, @IDEstadoNuevo INT, @EstadoActual VARCHAR(20);
    DECLARE @NombreActual NVARCHAR(50), @NombreNuevo NVARCHAR(50), @Mensaje NVARCHAR(300);
    DECLARE @Antes NVARCHAR(MAX), @Despues NVARCHAR(MAX), @Motivo NVARCHAR(250);
    DECLARE @IDVariante INT, @Cantidad INT;

    BEGIN TRAN;

    SELECT
        @IDEstadoActual = p.IDEstadoPedido,
        @EstadoActual = e.Codigo,
        @NombreActual = e.Nombre
    FROM dbo.Pedidos p WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN dbo.EstadosPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
    WHERE p.IDPedido = @IDPedido;

    IF @IDEstadoActual IS NULL
        THROW 50404, 'Pedido no encontrado.', 1;

    SELECT @IDEstadoNuevo = IDEstadoPedido, @NombreNuevo = Nombre
    FROM dbo.EstadosPedido
    WHERE Codigo = @EstadoNuevo;

    IF @IDEstadoNuevo IS NULL
        THROW 50400, 'Estado de pedido invalido.', 1;

    IF NOT EXISTS
    (
        SELECT 1 FROM dbo.TransicionesEstado
        WHERE IDEstadoOrigen = @IDEstadoActual AND IDEstadoDestino = @IDEstadoNuevo
    )
    BEGIN
        SET @Mensaje =
            CASE
                WHEN @EstadoNuevo = 'CANCELADO' AND @EstadoActual IN ('DESPACHADO', 'ENTREGADO', 'DEVUELTO_PARCIAL', 'DEVUELTO')
                    THEN N'El pedido ya fue despachado y no se puede cancelar.'
                ELSE CONCAT(N'No se puede pasar un pedido de "', @NombreActual, N'" a "', @NombreNuevo, N'".')
            END;
        THROW 50409, @Mensaje, 1;
    END

    IF @EstadoNuevo = 'CANCELADO'
    BEGIN
        SET @Motivo = CONCAT(N'Cancelacion, pedido #', @IDPedido);

        DECLARE lineas CURSOR LOCAL FAST_FORWARD FOR
            SELECT IDVariante, Cantidad - CantidadDevuelta
            FROM dbo.PedidoDetalle
            WHERE IDPedido = @IDPedido AND Cantidad > CantidadDevuelta
            ORDER BY IDVariante;

        OPEN lineas;
        FETCH NEXT FROM lineas INTO @IDVariante, @Cantidad;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            EXEC dbo.SP_Inventario_RegistrarMovimiento
                @IDVariante = @IDVariante,
                @TipoMovimiento = 'CANCELACION',
                @Cantidad = @Cantidad,
                @Motivo = @Motivo,
                @IDPedido = @IDPedido,
                @IDUsuario = @IDUsuarioAccion;

            FETCH NEXT FROM lineas INTO @IDVariante, @Cantidad;
        END

        CLOSE lineas;
        DEALLOCATE lineas;
    END

    SET @Antes = (SELECT @EstadoActual AS Estado FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    UPDATE dbo.Pedidos
    SET IDEstadoPedido = @IDEstadoNuevo,
        FechaModificacion = SYSUTCDATETIME()
    WHERE IDPedido = @IDPedido;

    INSERT INTO dbo.PedidoHistorial (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario)
    VALUES (@IDPedido, @IDEstadoActual, @IDEstadoNuevo, @IDUsuarioAccion, @Comentario);

    SET @Despues =
    (
        SELECT @EstadoNuevo AS Estado, @Comentario AS Comentario
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
    );

    EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'PEDIDOS', 'Pedidos', @IDPedido, 'MODIFICAR', @Antes, @Despues;

    COMMIT;
END
GO

IF USER_ID('shopcart_app') IS NOT NULL
    DENY EXECUTE ON dbo.SP_Pedidos_AplicarTransicion TO shopcart_app;
GO

/* ===== Consultas ===== */

-- @IDCliente: el cliente que consulta sus pedidos, o el filtro por cliente del Operador.
-- @TextoCliente busca en nombre y correo. Las fechas son días calendario de Guatemala.
-- @Orden: recientes, antiguos, total_desc o total_asc.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Listar
    @IDCliente      INT = NULL,
    @TextoCliente   NVARCHAR(100) = NULL,
    @Estado         VARCHAR(20) = NULL,
    @FechaDesde     DATE = NULL,
    @FechaHasta     DATE = NULL,
    @Orden          VARCHAR(20) = 'recientes',
    @Pagina         INT = 1,
    @TamanioPagina  INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @TamanioPagina NOT BETWEEN 1 AND 100
        THROW 50400, 'Parametros de paginacion invalidos.', 1;

    IF @Orden NOT IN ('recientes', 'antiguos', 'total_desc', 'total_asc')
        THROW 50400, 'Orden invalido.', 1;

    DECLARE @DesdeUtc DATETIME2(3) =
        CAST(CAST(@FechaDesde AS DATETIME2(3)) AT TIME ZONE 'Central America Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(3));
    DECLARE @HastaUtc DATETIME2(3) =
        CAST(CAST(DATEADD(DAY, 1, @FechaHasta) AS DATETIME2(3)) AT TIME ZONE 'Central America Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(3));

    SELECT
        p.IDPedido, p.FechaCreacion, e.Codigo AS Estado, e.Nombre AS EstadoNombre,
        p.IDUsuario, u.Nombres, u.Apellidos, u.Correo, p.Total,
        (SELECT SUM(d.Cantidad) FROM dbo.PedidoDetalle d WHERE d.IDPedido = p.IDPedido) AS CantidadArticulos
    INTO #Resultado
    FROM dbo.Pedidos p
    INNER JOIN dbo.EstadosPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
    INNER JOIN dbo.Usuarios u ON u.IDUsuario = p.IDUsuario
    WHERE (@IDCliente IS NULL OR p.IDUsuario = @IDCliente)
      AND (@Estado IS NULL OR e.Codigo = @Estado)
      AND (@DesdeUtc IS NULL OR p.FechaCreacion >= @DesdeUtc)
      AND (@HastaUtc IS NULL OR p.FechaCreacion < @HastaUtc)
      AND (
            @TextoCliente IS NULL
            OR CHARINDEX(@TextoCliente COLLATE Modern_Spanish_CI_AI, CONCAT(u.Nombres, N' ', u.Apellidos) COLLATE Modern_Spanish_CI_AI) > 0
            OR CHARINDEX(@TextoCliente COLLATE Modern_Spanish_CI_AI, u.Correo COLLATE Modern_Spanish_CI_AI) > 0
          )
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total FROM #Resultado;

    SELECT
        IDPedido, FechaCreacion, Estado, EstadoNombre, IDUsuario, Nombres, Apellidos, Correo, Total, CantidadArticulos
    FROM #Resultado
    ORDER BY
        CASE WHEN @Orden = 'total_desc' THEN Total END DESC,
        CASE WHEN @Orden = 'total_asc' THEN Total END ASC,
        CASE WHEN @Orden = 'antiguos' THEN FechaCreacion END ASC,
        CASE WHEN @Orden = 'antiguos' THEN IDPedido END ASC,
        FechaCreacion DESC,
        IDPedido DESC
    OFFSET (@Pagina - 1) * @TamanioPagina ROWS
    FETCH NEXT @TamanioPagina ROWS ONLY;
END
GO

/* ===== Cambios de estado ===== */

-- Operador y Administrador. Las devoluciones tienen su propio SP porque llevan líneas y montos.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CambiarEstado
    @IDPedido           INT,
    @EstadoNuevo        VARCHAR(20),
    @Comentario         NVARCHAR(250) = NULL,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @EstadoNuevo IN ('DEVUELTO', 'DEVUELTO_PARCIAL')
        THROW 50422, 'Las devoluciones se registran con su propio endpoint.', 1;

    EXEC dbo.SP_Pedidos_AplicarTransicion
        @IDPedido = @IDPedido,
        @EstadoNuevo = @EstadoNuevo,
        @Comentario = @Comentario,
        @IDUsuarioAccion = @IDUsuarioAccion;

    EXEC dbo.SP_Pedidos_Obtener @IDPedido = @IDPedido;
END
GO

-- El cliente cancela su propio pedido mientras no se haya despachado.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CancelarPorCliente
    @IDPedido   INT,
    @IDUsuario  INT,
    @Motivo     NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Comentario NVARCHAR(250) =
        CONCAT(N'Cancelado por el cliente', CASE WHEN @Motivo IS NOT NULL THEN CONCAT(N': ', @Motivo) ELSE N'' END);

    IF NOT EXISTS (SELECT 1 FROM dbo.Pedidos WHERE IDPedido = @IDPedido AND IDUsuario = @IDUsuario)
        THROW 50404, 'Pedido no encontrado.', 1;

    EXEC dbo.SP_Pedidos_AplicarTransicion
        @IDPedido = @IDPedido,
        @EstadoNuevo = 'CANCELADO',
        @Comentario = @Comentario,
        @IDUsuarioAccion = @IDUsuario;

    EXEC dbo.SP_Pedidos_Obtener @IDPedido = @IDPedido, @IDUsuario = @IDUsuario;
END
GO

/* ===== Devoluciones ===== */

-- Devolución total o parcial por línea, de un pedido ENTREGADO o DEVUELTO_PARCIAL.
-- @Lineas: [{"idPedidoDetalle": 1, "cantidad": 2}, ...]
-- Reembolso con redondeo acumulado: devolver k de n unidades reembolsa ROUND(Total * k / n) menos lo
-- ya reembolsado de esa línea, así la suma de devoluciones parciales da exactamente el total de la línea.
-- Lo devuelto vuelve al inventario (kardex DEVOLUCION) y el pedido pasa a DEVUELTO_PARCIAL o DEVUELTO.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_RegistrarDevolucion
    @IDPedido           INT,
    @Motivo             NVARCHAR(250),
    @Lineas             NVARCHAR(MAX),
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @EstadoActual VARCHAR(20), @EstadoNuevo VARCHAR(20), @IDDevolucion INT, @MontoTotal DECIMAL(12,2);
    DECLARE @Mensaje NVARCHAR(300), @Comentario NVARCHAR(250), @MotivoKardex NVARCHAR(250), @Despues NVARCHAR(MAX);
    DECLARE @IDVariante INT, @Cantidad INT;
    DECLARE @Items TABLE (IDPedidoDetalle INT, Cantidad INT);
    DECLARE @Montos TABLE (IDPedidoDetalle INT PRIMARY KEY, IDVariante INT, Cantidad INT, Monto DECIMAL(12,2));

    IF ISJSON(@Lineas) = 0
        THROW 50400, 'Las lineas de la devolucion no son validas.', 1;

    IF LEN(LTRIM(ISNULL(@Motivo, N''))) = 0
        THROW 50400, 'La devolucion requiere un motivo.', 1;

    -- Si la misma línea viene dos veces, se suman sus cantidades.
    INSERT INTO @Items (IDPedidoDetalle, Cantidad)
    SELECT j.IDPedidoDetalle, SUM(j.Cantidad)
    FROM OPENJSON(@Lineas) WITH (IDPedidoDetalle INT '$.idPedidoDetalle', Cantidad INT '$.cantidad') j
    GROUP BY j.IDPedidoDetalle;

    IF NOT EXISTS (SELECT 1 FROM @Items)
       OR EXISTS (SELECT 1 FROM @Items WHERE IDPedidoDetalle IS NULL OR Cantidad IS NULL OR Cantidad <= 0)
        THROW 50400, 'Indique las lineas a devolver con una cantidad mayor que cero.', 1;

    BEGIN TRAN;

    -- Bloquear el pedido ordena las devoluciones simultáneas del mismo pedido.
    SELECT @EstadoActual = e.Codigo
    FROM dbo.Pedidos p WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN dbo.EstadosPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
    WHERE p.IDPedido = @IDPedido;

    IF @EstadoActual IS NULL
        THROW 50404, 'Pedido no encontrado.', 1;

    IF @EstadoActual NOT IN ('ENTREGADO', 'DEVUELTO_PARCIAL')
        THROW 50409, 'Solo se pueden devolver productos de pedidos entregados.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM @Items i
        WHERE NOT EXISTS
        (
            SELECT 1 FROM dbo.PedidoDetalle d
            WHERE d.IDPedidoDetalle = i.IDPedidoDetalle AND d.IDPedido = @IDPedido
        )
    )
        THROW 50400, 'Alguna de las lineas no pertenece al pedido.', 1;

    SELECT TOP (1) @Mensaje = CONCAT(N'De ', d.SKU, N' solo se pueden devolver ', d.Cantidad - d.CantidadDevuelta, N' unidades.')
    FROM @Items i
    INNER JOIN dbo.PedidoDetalle d ON d.IDPedidoDetalle = i.IDPedidoDetalle
    WHERE i.Cantidad > d.Cantidad - d.CantidadDevuelta
    ORDER BY d.SKU;

    IF @Mensaje IS NOT NULL
        THROW 50409, @Mensaje, 1;

    INSERT INTO @Montos (IDPedidoDetalle, IDVariante, Cantidad, Monto)
    SELECT
        i.IDPedidoDetalle,
        d.IDVariante,
        i.Cantidad,
        CAST(
            ROUND(d.Total * (d.CantidadDevuelta + i.Cantidad) / d.Cantidad, 2)
            - ROUND(d.Total * d.CantidadDevuelta / d.Cantidad, 2)
        AS DECIMAL(12,2))
    FROM @Items i
    INNER JOIN dbo.PedidoDetalle d ON d.IDPedidoDetalle = i.IDPedidoDetalle;

    SELECT @MontoTotal = SUM(Monto) FROM @Montos;

    INSERT INTO dbo.Devoluciones (IDPedido, IDUsuario, Motivo, MontoReembolso)
    VALUES (@IDPedido, @IDUsuarioAccion, @Motivo, @MontoTotal);

    SET @IDDevolucion = SCOPE_IDENTITY();

    INSERT INTO dbo.DevolucionDetalle (IDDevolucion, IDPedidoDetalle, Cantidad, Monto)
    SELECT @IDDevolucion, IDPedidoDetalle, Cantidad, Monto
    FROM @Montos;

    -- CK_PedidoDetalle_CantidadDevuelta (devuelto <= vendido) es la barrera final.
    UPDATE d
    SET d.CantidadDevuelta = d.CantidadDevuelta + m.Cantidad
    FROM dbo.PedidoDetalle d
    INNER JOIN @Montos m ON m.IDPedidoDetalle = d.IDPedidoDetalle;

    SET @MotivoKardex = CONCAT(N'Devolucion #', @IDDevolucion, N', pedido #', @IDPedido);

    DECLARE lineas CURSOR LOCAL FAST_FORWARD FOR
        SELECT IDVariante, Cantidad
        FROM @Montos
        ORDER BY IDVariante;

    OPEN lineas;
    FETCH NEXT FROM lineas INTO @IDVariante, @Cantidad;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC dbo.SP_Inventario_RegistrarMovimiento
            @IDVariante = @IDVariante,
            @TipoMovimiento = 'DEVOLUCION',
            @Cantidad = @Cantidad,
            @Motivo = @MotivoKardex,
            @IDPedido = @IDPedido,
            @IDUsuario = @IDUsuarioAccion;

        FETCH NEXT FROM lineas INTO @IDVariante, @Cantidad;
    END

    CLOSE lineas;
    DEALLOCATE lineas;

    SET @EstadoNuevo =
        CASE
            WHEN EXISTS (SELECT 1 FROM dbo.PedidoDetalle WHERE IDPedido = @IDPedido AND CantidadDevuelta < Cantidad)
                THEN 'DEVUELTO_PARCIAL'
            ELSE 'DEVUELTO'
        END;

    -- Una segunda devolución parcial deja el pedido en DEVUELTO_PARCIAL: no hay cambio de estado.
    IF @EstadoNuevo <> @EstadoActual
    BEGIN
        SET @Comentario = LEFT(CONCAT(N'Devolucion #', @IDDevolucion, N': ', @Motivo), 250);

        EXEC dbo.SP_Pedidos_AplicarTransicion
            @IDPedido = @IDPedido,
            @EstadoNuevo = @EstadoNuevo,
            @Comentario = @Comentario,
            @IDUsuarioAccion = @IDUsuarioAccion;
    END

    SET @Despues =
    (
        SELECT
            @IDDevolucion AS IDDevolucion,
            @IDPedido AS IDPedido,
            @Motivo AS Motivo,
            @MontoTotal AS MontoReembolso,
            (SELECT IDPedidoDetalle, Cantidad, Monto FROM @Montos FOR JSON PATH) AS Lineas
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'PEDIDOS', 'Devoluciones', @IDDevolucion, 'CREAR', NULL, @Despues;

    COMMIT;

    EXEC dbo.SP_Pedidos_Obtener @IDPedido = @IDPedido;
END
GO
