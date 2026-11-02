/*
    017_SP_Carrito.sql
    Carrito de clientes e invitados.
    El carrito se ubica por el usuario de la sesión o por el token del invitado; nunca por un ID
    enviado por el cliente, así que no se puede leer ni modificar el carrito de otra persona.
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===== Funciones y procedimientos internos ===== */

-- Con sesión manda el usuario y el token se ignora. Un token nunca da acceso al carrito de un cliente.
CREATE OR ALTER FUNCTION dbo.FU_Carrito_Activo
(
    @IDUsuario      INT,
    @TokenInvitado  UNIQUEIDENTIFIER
)
RETURNS TABLE
AS
RETURN
(
    SELECT c.IDCarrito
    FROM dbo.Carritos c
    WHERE c.Estado = 'ACTIVO'
      AND (
            (@IDUsuario IS NOT NULL AND c.IDUsuario = @IDUsuario)
            OR (@IDUsuario IS NULL AND @TokenInvitado IS NOT NULL AND c.IDUsuario IS NULL AND c.TokenInvitado = @TokenInvitado)
          )
);
GO

-- Mensaje y código si no se pueden tener @Cantidad unidades de la variante en el carrito; NULL si se puede.
CREATE OR ALTER FUNCTION dbo.FU_Carrito_ValidarExistencia
(
    @IDVariante INT,
    @Cantidad   INT
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        CASE WHEN v.IDVariante IS NULL THEN 50404 ELSE 50409 END AS Numero,
        CASE
            WHEN v.IDVariante IS NULL THEN N'El producto no existe.'
            WHEN v.Activo = 0 OR p.Activo = 0 OR c.Activo = 0 THEN N'El producto ya no esta disponible.'
            WHEN v.ExistenciaDisponible <= 0 THEN CONCAT(N'No hay existencia disponible de ', v.SKU, N'.')
            WHEN @Cantidad > v.ExistenciaDisponible
                THEN CONCAT(N'Solo hay ', v.ExistenciaDisponible, N' unidades disponibles de ', v.SKU, N'.')
        END AS Mensaje
    FROM (SELECT @IDVariante AS IDVariante) x
    LEFT JOIN dbo.Variantes v ON v.IDVariante = x.IDVariante
    LEFT JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    LEFT JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
);
GO

-- Se llama fuera de una transacción: si dos peticiones del mismo cliente crean el carrito
-- a la vez, el índice único deja pasar una y la otra toma el carrito ya creado.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ObtenerOCrear
    @IDUsuario      INT = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL,
    @IDCarrito      INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT @IDCarrito = IDCarrito FROM dbo.FU_Carrito_Activo(@IDUsuario, @TokenInvitado);

    IF @IDCarrito IS NOT NULL
        RETURN;

    -- Un invitado sin carrito activo recibe uno nuevo con un token nuevo (NEWID es aleatorio).
    BEGIN TRY
        INSERT INTO dbo.Carritos (IDUsuario, TokenInvitado)
        VALUES (@IDUsuario, CASE WHEN @IDUsuario IS NULL THEN NEWID() END);

        SET @IDCarrito = SCOPE_IDENTITY();
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() NOT IN (2601, 2627)
            THROW;

        SELECT @IDCarrito = IDCarrito FROM dbo.FU_Carrito_Activo(@IDUsuario, NULL);
    END CATCH
END
GO

-- Tres resultados: cabecera (token y cupón), líneas y totales. Con @IDCarrito NULL los devuelve vacíos.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Resumen
    @IDCarrito  INT,
    @IDUsuario  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDCupon INT, @Subtotal DECIMAL(12,2), @Base DECIMAL(12,2), @MensajeCupon NVARCHAR(200);

    SELECT @IDCupon = IDCupon FROM dbo.Carritos WHERE IDCarrito = @IDCarrito;

    SELECT IDVariante, Cantidad, Subtotal, Descuento, Aplica
    INTO #Calculo
    FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @IDCupon, 0);

    SELECT
        @Subtotal = ISNULL(SUM(Subtotal), 0),
        @Base = ISNULL(SUM(CASE WHEN Aplica = 1 THEN Subtotal ELSE 0 END), 0)
    FROM #Calculo;

    -- Un cupón que dejó de ser válido (venció, se agotó, ya no se cumple el mínimo) no descuenta,
    -- pero sigue en el carrito con el motivo para que el cliente lo vea.
    IF @IDCupon IS NOT NULL
    BEGIN
        SELECT @MensajeCupon = Mensaje FROM dbo.FU_Cupones_Validar(@IDCupon, @IDUsuario, @Subtotal, @Base);

        IF @MensajeCupon IS NOT NULL
            UPDATE #Calculo SET Descuento = 0;
    END

    SELECT
        ca.TokenInvitado,
        cu.Codigo AS CodigoCupon,
        cu.Descripcion AS DescripcionCupon,
        cu.TipoDescuento,
        cu.Valor AS ValorCupon,
        @MensajeCupon AS MensajeCupon
    FROM dbo.Carritos ca
    LEFT JOIN dbo.Cupones cu ON cu.IDCupon = ca.IDCupon
    WHERE ca.IDCarrito = @IDCarrito;

    SELECT
        cd.IDVariante,
        p.IDProducto,
        p.Nombre AS Producto,
        v.SKU,
        v.Talla,
        v.Color,
        img.Url AS Imagen,
        v.Precio AS PrecioUnitario,
        cd.Cantidad,
        -- Lo que este mismo carrito tiene reservado cuenta como disponible para él.
        v.ExistenciaDisponible + ISNULL(r.Cantidad, 0) AS ExistenciaDisponible,
        CAST(CASE WHEN calc.IDVariante IS NULL THEN 0 ELSE 1 END AS BIT) AS Vendible,
        ISNULL(calc.Subtotal, 0) AS Subtotal,
        ISNULL(calc.Descuento, 0) AS Descuento,
        ISNULL(calc.Subtotal, 0) - ISNULL(calc.Descuento, 0) AS Total
    FROM dbo.CarritoDetalle cd
    INNER JOIN dbo.Variantes v ON v.IDVariante = cd.IDVariante
    INNER JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    LEFT JOIN #Calculo calc ON calc.IDVariante = cd.IDVariante
    LEFT JOIN dbo.Reservas r ON r.IDCarrito = cd.IDCarrito
                            AND r.IDVariante = cd.IDVariante
                            AND r.Estado = 'ACTIVA'
    OUTER APPLY
    (
        SELECT TOP (1) i.Url
        FROM dbo.ProductoImagenes i
        WHERE i.IDProducto = p.IDProducto
        ORDER BY i.Orden
    ) img
    WHERE cd.IDCarrito = @IDCarrito
    ORDER BY cd.FechaAgregado, cd.IDCarritoDetalle;

    -- Los precios incluyen IVA del 12 %: el IVA contenido en un total es total * 12 / 112.
    SELECT
        ISNULL(SUM(Cantidad), 0) AS CantidadArticulos,
        ISNULL(SUM(Subtotal), 0) AS Subtotal,
        ISNULL(SUM(Descuento), 0) AS Descuento,
        ISNULL(SUM(Subtotal - Descuento), 0) AS Total,
        CAST(ROUND(ISNULL(SUM(Subtotal - Descuento), 0) * 12 / 112, 2) AS DECIMAL(12,2)) AS IVA
    FROM #Calculo;
END
GO

IF USER_ID('shopcart_app') IS NOT NULL
BEGIN
    DENY EXECUTE ON dbo.SP_Carrito_ObtenerOCrear TO shopcart_app;
    DENY EXECUTE ON dbo.SP_Carrito_Resumen TO shopcart_app;
END
GO

/* ===== Operaciones del carrito ===== */

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Obtener
    @IDUsuario      INT = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDCarrito INT;

    SELECT @IDCarrito = IDCarrito FROM dbo.FU_Carrito_Activo(@IDUsuario, @TokenInvitado);

    EXEC dbo.SP_Carrito_Resumen @IDCarrito = @IDCarrito, @IDUsuario = @IDUsuario;
END
GO

-- Suma @Cantidad a lo que ya hubiera de esa variante. Crea el carrito si no existe.
-- No reserva: dos carritos pueden tener la última unidad; solo uno la obtiene en el checkout.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AgregarItem
    @IDUsuario      INT = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL,
    @IDVariante     INT,
    @Cantidad       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT, @CantidadNueva INT, @Numero INT, @Mensaje NVARCHAR(200);

    IF @Cantidad IS NULL OR @Cantidad < 1
        THROW 50400, 'La cantidad debe ser mayor que cero.', 1;

    EXEC dbo.SP_Carrito_ObtenerOCrear @IDUsuario, @TokenInvitado, @IDCarrito OUTPUT;

    BEGIN TRAN;

    -- Cualquier cambio al carrito cancela un checkout en curso: se liberan sus reservas.
    EXEC dbo.SP_Inventario_LiberarReservas @IDCarrito = @IDCarrito;

    SET @CantidadNueva = @Cantidad + ISNULL(
    (
        SELECT Cantidad
        FROM dbo.CarritoDetalle WITH (UPDLOCK, HOLDLOCK)
        WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante
    ), 0);

    SELECT @Numero = Numero, @Mensaje = Mensaje
    FROM dbo.FU_Carrito_ValidarExistencia(@IDVariante, @CantidadNueva);

    IF @Mensaje IS NOT NULL
        THROW @Numero, @Mensaje, 1;

    UPDATE dbo.CarritoDetalle
    SET Cantidad = @CantidadNueva
    WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

    IF @@ROWCOUNT = 0
        INSERT INTO dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad)
        VALUES (@IDCarrito, @IDVariante, @CantidadNueva);

    UPDATE dbo.Carritos SET FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;

    COMMIT;

    EXEC dbo.SP_Carrito_Resumen @IDCarrito = @IDCarrito, @IDUsuario = @IDUsuario;
END
GO

-- Fija la cantidad de una línea. Al aumentar se valida la existencia; disminuir siempre se permite.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ActualizarItem
    @IDUsuario      INT = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL,
    @IDVariante     INT,
    @Cantidad       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT, @CantidadActual INT, @Numero INT, @Mensaje NVARCHAR(200);

    IF @Cantidad IS NULL OR @Cantidad < 1
        THROW 50400, 'La cantidad debe ser mayor que cero.', 1;

    SELECT @IDCarrito = IDCarrito FROM dbo.FU_Carrito_Activo(@IDUsuario, @TokenInvitado);

    IF @IDCarrito IS NULL
        THROW 50404, 'El producto no esta en el carrito.', 1;

    BEGIN TRAN;

    EXEC dbo.SP_Inventario_LiberarReservas @IDCarrito = @IDCarrito;

    SELECT @CantidadActual = Cantidad
    FROM dbo.CarritoDetalle WITH (UPDLOCK, HOLDLOCK)
    WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

    IF @CantidadActual IS NULL
        THROW 50404, 'El producto no esta en el carrito.', 1;

    IF @Cantidad > @CantidadActual
    BEGIN
        SELECT @Numero = Numero, @Mensaje = Mensaje
        FROM dbo.FU_Carrito_ValidarExistencia(@IDVariante, @Cantidad);

        IF @Mensaje IS NOT NULL
            THROW @Numero, @Mensaje, 1;
    END

    UPDATE dbo.CarritoDetalle
    SET Cantidad = @Cantidad
    WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

    UPDATE dbo.Carritos SET FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;

    COMMIT;

    EXEC dbo.SP_Carrito_Resumen @IDCarrito = @IDCarrito, @IDUsuario = @IDUsuario;
END
GO

-- Si la línea no existe no hace nada (eliminar dos veces da el mismo resultado).
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_EliminarItem
    @IDUsuario      INT = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL,
    @IDVariante     INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT;

    SELECT @IDCarrito = IDCarrito FROM dbo.FU_Carrito_Activo(@IDUsuario, @TokenInvitado);

    IF @IDCarrito IS NOT NULL
    BEGIN
        BEGIN TRAN;

        EXEC dbo.SP_Inventario_LiberarReservas @IDCarrito = @IDCarrito;

        DELETE FROM dbo.CarritoDetalle
        WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

        UPDATE dbo.Carritos SET FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;

        COMMIT;
    END

    EXEC dbo.SP_Carrito_Resumen @IDCarrito = @IDCarrito, @IDUsuario = @IDUsuario;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Vaciar
    @IDUsuario      INT = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT;

    SELECT @IDCarrito = IDCarrito FROM dbo.FU_Carrito_Activo(@IDUsuario, @TokenInvitado);

    IF @IDCarrito IS NOT NULL
    BEGIN
        BEGIN TRAN;

        EXEC dbo.SP_Inventario_LiberarReservas @IDCarrito = @IDCarrito;

        DELETE FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito;

        UPDATE dbo.Carritos
        SET IDCupon = NULL,
            FechaUltimaActividad = SYSUTCDATETIME()
        WHERE IDCarrito = @IDCarrito;

        COMMIT;
    END

    EXEC dbo.SP_Carrito_Resumen @IDCarrito = @IDCarrito, @IDUsuario = @IDUsuario;
END
GO

/* ===== Cupón del carrito ===== */

-- Un solo cupón por carrito: aplicar otro reemplaza al anterior.
-- Si no cumple alguna regla se rechaza con el motivo específico (422).
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AplicarCupon
    @IDUsuario      INT = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL,
    @Codigo         VARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT, @IDCupon INT, @Subtotal DECIMAL(12,2), @Base DECIMAL(12,2), @Mensaje NVARCHAR(200);

    SELECT @IDCarrito = IDCarrito FROM dbo.FU_Carrito_Activo(@IDUsuario, @TokenInvitado);

    IF @IDCarrito IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito)
        THROW 50422, 'Agregue productos al carrito antes de aplicar un cupon.', 1;

    SELECT @IDCupon = IDCupon FROM dbo.Cupones WHERE Codigo = @Codigo;

    IF @IDCupon IS NULL
        THROW 50404, 'El cupon no existe.', 1;

    SELECT
        @Subtotal = ISNULL(SUM(Subtotal), 0),
        @Base = ISNULL(SUM(CASE WHEN Aplica = 1 THEN Subtotal ELSE 0 END), 0)
    FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @IDCupon, 0);

    SELECT @Mensaje = Mensaje FROM dbo.FU_Cupones_Validar(@IDCupon, @IDUsuario, @Subtotal, @Base);

    IF @Mensaje IS NOT NULL
        THROW 50422, @Mensaje, 1;

    BEGIN TRAN;

    -- Cambia el total, así que un checkout en curso se reinicia.
    EXEC dbo.SP_Inventario_LiberarReservas @IDCarrito = @IDCarrito;

    UPDATE dbo.Carritos
    SET IDCupon = @IDCupon,
        FechaUltimaActividad = SYSUTCDATETIME()
    WHERE IDCarrito = @IDCarrito;

    COMMIT;

    EXEC dbo.SP_Carrito_Resumen @IDCarrito = @IDCarrito, @IDUsuario = @IDUsuario;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_QuitarCupon
    @IDUsuario      INT = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT;

    SELECT @IDCarrito = IDCarrito FROM dbo.FU_Carrito_Activo(@IDUsuario, @TokenInvitado);

    IF @IDCarrito IS NOT NULL
    BEGIN
        BEGIN TRAN;

        EXEC dbo.SP_Inventario_LiberarReservas @IDCarrito = @IDCarrito;

        UPDATE dbo.Carritos
        SET IDCupon = NULL,
            FechaUltimaActividad = SYSUTCDATETIME()
        WHERE IDCarrito = @IDCarrito;

        COMMIT;
    END

    EXEC dbo.SP_Carrito_Resumen @IDCarrito = @IDCarrito, @IDUsuario = @IDUsuario;
END
GO

/* ===== Fusión al iniciar sesión ===== */

-- Pasa el carrito del invitado al del cliente. Las cantidades se suman sin pasar de lo disponible
-- (nunca se reduce lo que el cliente ya tenía). Si el cliente no tenía cupón, se conserva el del invitado.
-- El carrito del invitado queda como FUSIONADO y su token deja de servir.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Fusionar
    @IDUsuario      INT,
    @TokenInvitado  UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT, @IDInvitado INT;

    SELECT @IDInvitado = IDCarrito FROM dbo.FU_Carrito_Activo(NULL, @TokenInvitado);

    IF @IDInvitado IS NULL
    BEGIN
        SELECT @IDCarrito = IDCarrito FROM dbo.FU_Carrito_Activo(@IDUsuario, NULL);
        EXEC dbo.SP_Carrito_Resumen @IDCarrito = @IDCarrito, @IDUsuario = @IDUsuario;
        RETURN;
    END

    EXEC dbo.SP_Carrito_ObtenerOCrear @IDUsuario = @IDUsuario, @IDCarrito = @IDCarrito OUTPUT;

    BEGIN TRAN;

    -- Si llegan dos fusiones del mismo token a la vez, solo la primera lo encuentra activo.
    UPDATE dbo.Carritos
    SET Estado = 'FUSIONADO',
        FechaUltimaActividad = SYSUTCDATETIME()
    WHERE IDCarrito = @IDInvitado
      AND Estado = 'ACTIVO';

    IF @@ROWCOUNT = 1
    BEGIN
        EXEC dbo.SP_Inventario_LiberarReservas @IDCarrito = @IDCarrito;

        UPDATE ud
        SET ud.Cantidad =
            CASE
                WHEN ud.Cantidad + gd.Cantidad <= v.ExistenciaDisponible THEN ud.Cantidad + gd.Cantidad
                WHEN v.ExistenciaDisponible > ud.Cantidad THEN v.ExistenciaDisponible
                ELSE ud.Cantidad
            END
        FROM dbo.CarritoDetalle ud
        INNER JOIN dbo.CarritoDetalle gd ON gd.IDCarrito = @IDInvitado AND gd.IDVariante = ud.IDVariante
        INNER JOIN dbo.Variantes v ON v.IDVariante = ud.IDVariante
        WHERE ud.IDCarrito = @IDCarrito;

        INSERT INTO dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad)
        SELECT
            @IDCarrito,
            gd.IDVariante,
            CASE WHEN gd.Cantidad <= v.ExistenciaDisponible THEN gd.Cantidad ELSE v.ExistenciaDisponible END
        FROM dbo.CarritoDetalle gd
        INNER JOIN dbo.Variantes v ON v.IDVariante = gd.IDVariante
        INNER JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
        INNER JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
        WHERE gd.IDCarrito = @IDInvitado
          AND v.Activo = 1 AND p.Activo = 1 AND c.Activo = 1
          AND v.ExistenciaDisponible > 0
          AND NOT EXISTS
          (
              SELECT 1
              FROM dbo.CarritoDetalle ud
              WHERE ud.IDCarrito = @IDCarrito AND ud.IDVariante = gd.IDVariante
          );

        UPDATE u
        SET u.IDCupon = g.IDCupon
        FROM dbo.Carritos u
        INNER JOIN dbo.Carritos g ON g.IDCarrito = @IDInvitado
        WHERE u.IDCarrito = @IDCarrito
          AND u.IDCupon IS NULL;

        UPDATE dbo.Carritos SET FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
    END

    COMMIT;

    EXEC dbo.SP_Carrito_Resumen @IDCarrito = @IDCarrito, @IDUsuario = @IDUsuario;
END
GO
