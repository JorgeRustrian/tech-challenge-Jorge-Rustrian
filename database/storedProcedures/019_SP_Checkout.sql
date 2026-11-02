/*
    019_SP_Checkout.sql
    Inicio del pago (reserva de existencia), resumen del checkout y creación atómica del pedido.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===== Totales ===== */

-- Totales con los precios congelados en las reservas. Los usan el resumen y la creación del pedido:
-- lo que el cliente ve al confirmar es exactamente lo que se cobra.
-- Envío: tarifa fija, gratis desde @EnvioGratisDesde (después del descuento). Ambos vienen de la configuración.
CREATE OR ALTER FUNCTION dbo.FU_Checkout_Totales
(
    @IDCarrito          INT,
    @IDCupon            INT,
    @CostoEnvio         DECIMAL(12,2),
    @EnvioGratisDesde   DECIMAL(12,2)
)
RETURNS TABLE
AS
RETURN
(
    WITH Base AS
    (
        SELECT
            ISNULL(SUM(Subtotal), 0) AS Subtotal,
            ISNULL(SUM(CASE WHEN Aplica = 1 THEN Subtotal ELSE 0 END), 0) AS BaseElegible,
            ISNULL(SUM(Descuento), 0) AS Descuento
        FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @IDCupon, 1)
    ),
    ConEnvio AS
    (
        SELECT
            b.Subtotal,
            b.BaseElegible,
            b.Descuento,
            CASE WHEN b.Subtotal - b.Descuento >= @EnvioGratisDesde THEN 0 ELSE @CostoEnvio END AS CostoEnvio
        FROM Base b
    )
    SELECT
        Subtotal,
        BaseElegible,
        Descuento,
        CostoEnvio,
        Subtotal - Descuento + CostoEnvio AS Total,
        -- Precios con IVA del 12 % incluido: el IVA contenido es total * 12 / 112.
        CAST(ROUND((Subtotal - Descuento + CostoEnvio) * 12 / 112, 2) AS DECIMAL(12,2)) AS IVA
    FROM ConEnvio
);
GO

/* ===== Consulta de pedidos ===== */

-- Cinco resultados: pedido, líneas, historial de estados, devoluciones y líneas devueltas.
-- Con @IDUsuario solo devuelve pedidos de ese cliente: uno ajeno responde 404, igual que uno inexistente.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Obtener
    @IDPedido   INT,
    @IDUsuario  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1 FROM dbo.Pedidos
        WHERE IDPedido = @IDPedido
          AND (@IDUsuario IS NULL OR IDUsuario = @IDUsuario)
    )
        THROW 50404, 'Pedido no encontrado.', 1;

    SELECT
        p.IDPedido, e.Codigo AS Estado, e.Nombre AS EstadoNombre, p.FechaCreacion, p.FechaModificacion,
        p.IDUsuario, u.Nombres, u.Apellidos, u.Correo,
        p.NombreDestinatario, p.TelefonoDestinatario, p.DireccionEntrega,
        c.Codigo AS CodigoCupon,
        p.Subtotal, p.Descuento, p.CostoEnvio, p.Total, p.IVA, p.ReferenciaPago
    FROM dbo.Pedidos p
    INNER JOIN dbo.EstadosPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
    INNER JOIN dbo.Usuarios u ON u.IDUsuario = p.IDUsuario
    LEFT JOIN dbo.Cupones c ON c.IDCupon = p.IDCupon
    WHERE p.IDPedido = @IDPedido;

    SELECT
        d.IDPedidoDetalle, d.IDVariante, d.SKU, d.NombreProducto, d.Talla, d.Color,
        d.PrecioUnitario, d.Cantidad, d.Descuento, d.Total, d.CantidadDevuelta
    FROM dbo.PedidoDetalle d
    WHERE d.IDPedido = @IDPedido
    ORDER BY d.IDPedidoDetalle;

    SELECT
        h.Fecha, ea.Codigo AS EstadoAnterior, en.Codigo AS EstadoNuevo, h.Comentario,
        h.IDUsuario, u.Nombres, u.Apellidos
    FROM dbo.PedidoHistorial h
    INNER JOIN dbo.EstadosPedido en ON en.IDEstadoPedido = h.IDEstadoNuevo
    LEFT JOIN dbo.EstadosPedido ea ON ea.IDEstadoPedido = h.IDEstadoAnterior
    INNER JOIN dbo.Usuarios u ON u.IDUsuario = h.IDUsuario
    WHERE h.IDPedido = @IDPedido
    ORDER BY h.Fecha, h.IDPedidoHistorial;

    SELECT dv.IDDevolucion, dv.Fecha, dv.Motivo, dv.MontoReembolso, dv.IDUsuario, u.Nombres, u.Apellidos
    FROM dbo.Devoluciones dv
    INNER JOIN dbo.Usuarios u ON u.IDUsuario = dv.IDUsuario
    WHERE dv.IDPedido = @IDPedido
    ORDER BY dv.Fecha, dv.IDDevolucion;

    SELECT dd.IDDevolucion, dd.IDPedidoDetalle, d.SKU, dd.Cantidad, dd.Monto
    FROM dbo.DevolucionDetalle dd
    INNER JOIN dbo.Devoluciones dv ON dv.IDDevolucion = dd.IDDevolucion
    INNER JOIN dbo.PedidoDetalle d ON d.IDPedidoDetalle = dd.IDPedidoDetalle
    WHERE dv.IDPedido = @IDPedido
    ORDER BY dd.IDDevolucion, dd.IDPedidoDetalle;
END
GO

/* ===== Checkout ===== */

-- Resumen del pago en curso: cabecera (vencimiento y cupón), líneas y totales.
-- Sin reservas vigentes no hay pago en curso (404).
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_Obtener
    @IDUsuario          INT,
    @CostoEnvio         DECIMAL(12,2),
    @EnvioGratisDesde   DECIMAL(12,2)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDCarrito INT, @IDCupon INT, @IDCuponAplicado INT, @Expira DATETIME2(3), @MensajeCupon NVARCHAR(200);

    SELECT @IDCarrito = IDCarrito FROM dbo.FU_Carrito_Activo(@IDUsuario, NULL);
    SELECT @IDCupon = IDCupon FROM dbo.Carritos WHERE IDCarrito = @IDCarrito;

    SELECT @Expira = MIN(FechaExpiracion)
    FROM dbo.Reservas
    WHERE IDCarrito = @IDCarrito AND Estado = 'ACTIVA';

    IF @Expira IS NULL OR @Expira <= SYSUTCDATETIME()
        THROW 50404, 'No hay un pago en curso o la reserva ya vencio.', 1;

    -- Si el cupón dejó de ser válido durante la reserva no descuenta; el pago lo rechazará con el motivo.
    SET @IDCuponAplicado = @IDCupon;

    IF @IDCupon IS NOT NULL
    BEGIN
        SELECT @MensajeCupon = v.Mensaje
        FROM dbo.FU_Checkout_Totales(@IDCarrito, @IDCupon, @CostoEnvio, @EnvioGratisDesde) t
        CROSS APPLY dbo.FU_Cupones_Validar(@IDCupon, @IDUsuario, t.Subtotal, t.BaseElegible) v;

        IF @MensajeCupon IS NOT NULL
            SET @IDCuponAplicado = NULL;
    END

    SELECT
        @Expira AS FechaExpiracion,
        DATEDIFF(SECOND, SYSUTCDATETIME(), @Expira) AS SegundosRestantes,
        c.Codigo AS CodigoCupon,
        @MensajeCupon AS MensajeCupon
    FROM (SELECT 1 AS Uno) x
    LEFT JOIN dbo.Cupones c ON c.IDCupon = @IDCupon;

    SELECT
        l.IDVariante, p.Nombre AS Producto, v.SKU, v.Talla, v.Color, img.Url AS Imagen,
        l.PrecioUnitario, l.Cantidad, l.Subtotal, l.Descuento, l.Subtotal - l.Descuento AS Total
    FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @IDCuponAplicado, 1) l
    INNER JOIN dbo.Variantes v ON v.IDVariante = l.IDVariante
    INNER JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    OUTER APPLY
    (
        SELECT TOP (1) i.Url
        FROM dbo.ProductoImagenes i
        WHERE i.IDProducto = p.IDProducto
        ORDER BY i.Orden
    ) img
    ORDER BY v.SKU;

    SELECT Subtotal, Descuento, CostoEnvio, Total, IVA
    FROM dbo.FU_Checkout_Totales(@IDCarrito, @IDCuponAplicado, @CostoEnvio, @EnvioGratisDesde);
END
GO

-- Reserva todo el carrito por @MinutosReserva y congela precios. Si el cliente ya tenía un pago
-- en curso, se reinicia. Si una variante no alcanza o el cupón ya no es válido, no queda nada reservado.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_IniciarPago
    @IDUsuario          INT,
    @MinutosReserva     INT,
    @CostoEnvio         DECIMAL(12,2),
    @EnvioGratisDesde   DECIMAL(12,2)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT, @IDCupon INT, @Mensaje NVARCHAR(300);

    IF @MinutosReserva NOT BETWEEN 1 AND 60
        THROW 50400, 'Tiempo de reserva invalido.', 1;

    SELECT @IDCarrito = IDCarrito FROM dbo.FU_Carrito_Activo(@IDUsuario, NULL);

    IF @IDCarrito IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito)
        THROW 50422, 'El carrito esta vacio.', 1;

    BEGIN TRAN;

    EXEC dbo.SP_Inventario_ReservarExistencia @IDCarrito = @IDCarrito, @MinutosReserva = @MinutosReserva;

    -- El cupón se valida con los precios ya congelados y con el usuario (límite por cliente).
    SELECT @IDCupon = IDCupon FROM dbo.Carritos WHERE IDCarrito = @IDCarrito;

    IF @IDCupon IS NOT NULL
    BEGIN
        SELECT @Mensaje = v.Mensaje
        FROM dbo.FU_Checkout_Totales(@IDCarrito, @IDCupon, @CostoEnvio, @EnvioGratisDesde) t
        CROSS APPLY dbo.FU_Cupones_Validar(@IDCupon, @IDUsuario, t.Subtotal, t.BaseElegible) v;

        IF @Mensaje IS NOT NULL
        BEGIN
            SET @Mensaje = CONCAT(@Mensaje, N' Quite el cupon del carrito para continuar.');
            THROW 50422, @Mensaje, 1;
        END
    END

    UPDATE dbo.Carritos SET FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;

    COMMIT;

    EXEC dbo.SP_Checkout_Obtener @IDUsuario = @IDUsuario, @CostoEnvio = @CostoEnvio, @EnvioGratisDesde = @EnvioGratisDesde;
END
GO

/* ===== Creación del pedido ===== */

-- Confirma el pago y crea el pedido. Todo en una transacción: pedido, detalle, salida de inventario,
-- reservas consumidas, uso del cupón, carrito convertido, historial y bitácora; o no se guarda nada.
-- Idempotente: la misma @ClaveIdempotencia devuelve el mismo pedido sin crear otro ni cobrar dos veces.
-- Primer resultado: Repetido (1 si la clave ya se había usado). Después, los tres de SP_Pedidos_Obtener.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CrearPedido
    @IDUsuario          INT,
    @IDDireccion        INT,
    @ClaveIdempotencia  UNIQUEIDENTIFIER,
    @CostoEnvio         DECIMAL(12,2),
    @EnvioGratisDesde   DECIMAL(12,2)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @IDPedido INT, @IDDuenio INT, @IDCarrito INT, @IDCupon INT, @IDEstadoPagado INT;
    DECLARE @Reservas INT, @Vencidas INT, @Mensaje NVARCHAR(300), @Despues NVARCHAR(MAX);
    DECLARE @Destinatario NVARCHAR(150), @Telefono VARCHAR(20), @DireccionEntrega NVARCHAR(800);
    DECLARE @Subtotal DECIMAL(12,2), @Descuento DECIMAL(12,2), @Envio DECIMAL(12,2), @Total DECIMAL(12,2), @IVA DECIMAL(12,2);
    DECLARE @IDVariante INT, @Cantidad INT, @Salida INT, @Motivo NVARCHAR(250);

    BEGIN TRAN;

    -- 1. Idempotencia. UPDLOCK + HOLDLOCK bloquea la clave aunque todavía no exista: una segunda
    --    petición con la misma clave espera a que termine la primera y encuentra el pedido ya creado.
    SELECT @IDPedido = IDPedido, @IDDuenio = IDUsuario
    FROM dbo.Pedidos WITH (UPDLOCK, HOLDLOCK)
    WHERE ClaveIdempotencia = @ClaveIdempotencia;

    IF @IDPedido IS NOT NULL
    BEGIN
        COMMIT;

        IF @IDDuenio <> @IDUsuario
            THROW 50409, 'La clave de idempotencia ya fue usada.', 1;

        SELECT CAST(1 AS BIT) AS Repetido;
        EXEC dbo.SP_Pedidos_Obtener @IDPedido = @IDPedido, @IDUsuario = @IDUsuario;
        RETURN;
    END

    -- 2. Dirección del mismo cliente. Se copia al pedido tal como está hoy.
    SELECT
        @Destinatario = d.NombreDestinatario,
        @Telefono = d.Telefono,
        @DireccionEntrega = CONCAT(
            d.DireccionLinea,
            CASE WHEN d.Zona IS NOT NULL THEN CONCAT(N', zona ', d.Zona) ELSE N'' END,
            N', ', d.Municipio, N', ', d.Departamento,
            CASE WHEN d.Referencias IS NOT NULL THEN CONCAT(N'. Referencias: ', d.Referencias) ELSE N'' END)
    FROM dbo.Direcciones d
    WHERE d.IDDireccion = @IDDireccion
      AND d.IDUsuario = @IDUsuario
      AND d.Activo = 1;

    IF @Destinatario IS NULL
        THROW 50404, 'Direccion no encontrada.', 1;

    -- 3. Carrito y reservas del pago en curso. El bloqueo del carrito hace que dos pagos del mismo
    --    carrito (aunque traigan claves distintas) se atiendan en orden: el segundo ya no lo encuentra activo.
    SELECT @IDCarrito = IDCarrito, @IDCupon = IDCupon
    FROM dbo.Carritos WITH (UPDLOCK, HOLDLOCK)
    WHERE IDUsuario = @IDUsuario AND Estado = 'ACTIVO';

    SELECT
        @Reservas = COUNT(*),
        @Vencidas = ISNULL(SUM(CASE WHEN FechaExpiracion <= @Ahora THEN 1 ELSE 0 END), 0)
    FROM dbo.Reservas WITH (UPDLOCK, HOLDLOCK)
    WHERE IDCarrito = @IDCarrito AND Estado = 'ACTIVA';

    IF @IDCarrito IS NULL OR @Reservas = 0
        THROW 50409, 'No hay un pago en curso. Inicie el pago de nuevo.', 1;

    IF @Vencidas > 0
        THROW 50409, 'La reserva de los productos vencio. Inicie el pago de nuevo.', 1;

    -- 4. Cupón. El bloqueo de su fila ordena a los pedidos que lo usan al mismo tiempo: cada uno
    --    valida (vigencia, usos totales, usos del cliente, mínimo) viendo lo que ya hizo el anterior.
    IF @IDCupon IS NOT NULL
    BEGIN
        SELECT @IDCupon = IDCupon
        FROM dbo.Cupones WITH (UPDLOCK, HOLDLOCK)
        WHERE IDCupon = @IDCupon;

        SELECT @Mensaje = v.Mensaje
        FROM dbo.FU_Checkout_Totales(@IDCarrito, @IDCupon, @CostoEnvio, @EnvioGratisDesde) t
        CROSS APPLY dbo.FU_Cupones_Validar(@IDCupon, @IDUsuario, t.Subtotal, t.BaseElegible) v;

        IF @Mensaje IS NOT NULL
        BEGIN
            SET @Mensaje = CONCAT(@Mensaje, N' Quite el cupon del carrito para continuar.');
            THROW 50422, @Mensaje, 1;
        END

        -- CK_Cupones_UsosActuales (usos <= límite) es la barrera final.
        UPDATE dbo.Cupones
        SET UsosActuales = UsosActuales + 1
        WHERE IDCupon = @IDCupon;
    END

    -- 5. Totales con los precios congelados en las reservas.
    SELECT
        @Subtotal = Subtotal,
        @Descuento = Descuento,
        @Envio = CostoEnvio,
        @Total = Total,
        @IVA = IVA
    FROM dbo.FU_Checkout_Totales(@IDCarrito, @IDCupon, @CostoEnvio, @EnvioGratisDesde);

    SELECT @IDEstadoPagado = IDEstadoPedido FROM dbo.EstadosPedido WHERE Codigo = 'PAGADO';

    -- 6. Pedido. El pago es simulado y la referencia sale de la clave de idempotencia:
    --    un reintento nunca puede generar un segundo cobro.
    INSERT INTO dbo.Pedidos
        (IDUsuario, IDEstadoPedido, IDDireccion, IDCupon, ClaveIdempotencia,
         NombreDestinatario, TelefonoDestinatario, DireccionEntrega,
         Subtotal, Descuento, CostoEnvio, Total, IVA, ReferenciaPago, FechaCreacion)
    VALUES
        (@IDUsuario, @IDEstadoPagado, @IDDireccion, @IDCupon, @ClaveIdempotencia,
         @Destinatario, @Telefono, @DireccionEntrega,
         @Subtotal, @Descuento, @Envio, @Total, @IVA,
         CONCAT('SIM-', UPPER(LEFT(REPLACE(CONVERT(CHAR(36), @ClaveIdempotencia), '-', ''), 12))),
         @Ahora);

    SET @IDPedido = SCOPE_IDENTITY();

    -- 7. Detalle: precio, descuento prorrateado y datos del producto copiados.
    INSERT INTO dbo.PedidoDetalle
        (IDPedido, IDVariante, SKU, NombreProducto, Talla, Color, PrecioUnitario, Cantidad, Descuento, Total)
    SELECT
        @IDPedido, l.IDVariante, v.SKU, p.Nombre, v.Talla, v.Color,
        l.PrecioUnitario, l.Cantidad, l.Descuento, l.Subtotal - l.Descuento
    FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @IDCupon, 1) l
    INNER JOIN dbo.Variantes v ON v.IDVariante = l.IDVariante
    INNER JOIN dbo.Productos p ON p.IDProducto = v.IDProducto;

    -- 8. Salida de inventario: cada unidad sale de lo físico y de lo reservado a la vez (kardex VENTA).
    --    En orden de IDVariante para que dos pedidos con productos en común bloqueen en el mismo orden.
    SET @Motivo = CONCAT(N'Venta, pedido #', @IDPedido);

    DECLARE lineas CURSOR LOCAL FAST_FORWARD FOR
        SELECT IDVariante, Cantidad
        FROM dbo.PedidoDetalle
        WHERE IDPedido = @IDPedido
        ORDER BY IDVariante;

    OPEN lineas;
    FETCH NEXT FROM lineas INTO @IDVariante, @Cantidad;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @Salida = -@Cantidad;

        EXEC dbo.SP_Inventario_RegistrarMovimiento
            @IDVariante = @IDVariante,
            @TipoMovimiento = 'VENTA',
            @Cantidad = @Salida,
            @Motivo = @Motivo,
            @IDPedido = @IDPedido,
            @IDUsuario = @IDUsuario,
            @AjusteReservada = @Salida;

        FETCH NEXT FROM lineas INTO @IDVariante, @Cantidad;
    END

    CLOSE lineas;
    DEALLOCATE lineas;

    -- 9. Reservas consumidas, uso del cupón y carrito convertido.
    UPDATE dbo.Reservas
    SET Estado = 'CONSUMIDA',
        IDPedido = @IDPedido,
        FechaCierre = @Ahora
    WHERE IDCarrito = @IDCarrito AND Estado = 'ACTIVA';

    IF @IDCupon IS NOT NULL
        INSERT INTO dbo.CuponUsos (IDCupon, IDUsuario, IDPedido)
        VALUES (@IDCupon, @IDUsuario, @IDPedido);

    UPDATE dbo.Carritos
    SET Estado = 'CONVERTIDO',
        FechaUltimaActividad = @Ahora
    WHERE IDCarrito = @IDCarrito;

    -- 10. Historial y bitácora del pedido nuevo.
    INSERT INTO dbo.PedidoHistorial (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario)
    VALUES (@IDPedido, NULL, @IDEstadoPagado, @IDUsuario, N'Pedido creado y pagado');

    SET @Despues =
    (
        SELECT p.IDPedido, 'PAGADO' AS Estado, p.Subtotal, p.Descuento, p.CostoEnvio, p.Total, p.IDCupon, p.ReferenciaPago
        FROM dbo.Pedidos p
        WHERE p.IDPedido = @IDPedido
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
    );

    EXEC dbo.SP_Bitacora_Registrar @IDUsuario, 'PEDIDOS', 'Pedidos', @IDPedido, 'CREAR', NULL, @Despues;

    COMMIT;

    SELECT CAST(0 AS BIT) AS Repetido;
    EXEC dbo.SP_Pedidos_Obtener @IDPedido = @IDPedido, @IDUsuario = @IDUsuario;
END
GO
