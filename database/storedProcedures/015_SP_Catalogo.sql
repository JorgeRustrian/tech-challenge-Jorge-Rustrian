/*
    015_SP_Catalogo.sql
    Categorías, productos, imágenes y variantes.
    Toda creación, modificación, cambio de estado o eliminación queda en bitácora (módulo CATALOGO).
*/
USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===== Fotos JSON para la bitácora ===== */

CREATE OR ALTER FUNCTION dbo.FU_Catalogo_CategoriaJson (@IDCategoria INT)
RETURNS TABLE
AS
RETURN
(
    SELECT
    (
        SELECT c.IDCategoria, c.Nombre, c.Descripcion, c.Activo
        FROM dbo.Categorias c
        WHERE c.IDCategoria = @IDCategoria
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
    ) AS Valor
);
GO

CREATE OR ALTER FUNCTION dbo.FU_Catalogo_ProductoJson (@IDProducto INT)
RETURNS TABLE
AS
RETURN
(
    SELECT
    (
        SELECT
            p.IDProducto, p.IDCategoria, p.Nombre, p.Descripcion, p.Activo,
            (
                SELECT i.Url, i.Orden
                FROM dbo.ProductoImagenes i
                WHERE i.IDProducto = p.IDProducto
                ORDER BY i.Orden
                FOR JSON PATH
            ) AS Imagenes,
            (
                SELECT v.IDVariante, v.SKU, v.Talla, v.Color, v.Precio, v.ExistenciaFisica, v.Activo
                FROM dbo.Variantes v
                WHERE v.IDProducto = p.IDProducto
                FOR JSON PATH
            ) AS Variantes
        FROM dbo.Productos p
        WHERE p.IDProducto = @IDProducto
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
    ) AS Valor
);
GO

CREATE OR ALTER FUNCTION dbo.FU_Catalogo_VarianteJson (@IDVariante INT)
RETURNS TABLE
AS
RETURN
(
    SELECT
    (
        SELECT v.IDVariante, v.IDProducto, v.SKU, v.Talla, v.Color, v.Precio, v.ExistenciaFisica, v.Activo
        FROM dbo.Variantes v
        WHERE v.IDVariante = @IDVariante
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
    ) AS Valor
);
GO

/* ===== Categorías ===== */

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarCategorias
    @IncluirInactivas BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.IDCategoria, c.Nombre, c.Descripcion, c.Activo,
        (
            SELECT COUNT(*)
            FROM dbo.Productos p
            WHERE p.IDCategoria = c.IDCategoria
              AND (p.Activo = 1 OR @IncluirInactivas = 1)
        ) AS CantidadProductos
    FROM dbo.Categorias c
    WHERE c.Activo = 1 OR @IncluirInactivas = 1
    ORDER BY c.Nombre;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerCategoria
    @IDCategoria INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 50404, 'Categoria no encontrada.', 1;

    SELECT
        c.IDCategoria, c.Nombre, c.Descripcion, c.Activo,
        (SELECT COUNT(*) FROM dbo.Productos p WHERE p.IDCategoria = c.IDCategoria) AS CantidadProductos
    FROM dbo.Categorias c
    WHERE c.IDCategoria = @IDCategoria;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearCategoria
    @Nombre             NVARCHAR(100),
    @Descripcion        NVARCHAR(500) = NULL,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCategoria INT, @Despues NVARCHAR(MAX);

    BEGIN TRY
        BEGIN TRAN;

        INSERT INTO dbo.Categorias (Nombre, Descripcion)
        VALUES (@Nombre, @Descripcion);

        SET @IDCategoria = SCOPE_IDENTITY();
        SELECT @Despues = Valor FROM dbo.FU_Catalogo_CategoriaJson(@IDCategoria);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CATALOGO', 'Categorias', @IDCategoria, 'CREAR', NULL, @Despues;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 50409, 'Ya existe una categoria con ese nombre.', 1;
        THROW;
    END CATCH

    EXEC dbo.SP_Catalogo_ObtenerCategoria @IDCategoria = @IDCategoria;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarCategoria
    @IDCategoria        INT,
    @Nombre             NVARCHAR(100),
    @Descripcion        NVARCHAR(500) = NULL,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Antes NVARCHAR(MAX), @Despues NVARCHAR(MAX);

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WITH (UPDLOCK, HOLDLOCK) WHERE IDCategoria = @IDCategoria)
            THROW 50404, 'Categoria no encontrada.', 1;

        SELECT @Antes = Valor FROM dbo.FU_Catalogo_CategoriaJson(@IDCategoria);

        UPDATE dbo.Categorias
        SET Nombre = @Nombre,
            Descripcion = @Descripcion,
            FechaModificacion = SYSUTCDATETIME()
        WHERE IDCategoria = @IDCategoria;

        SELECT @Despues = Valor FROM dbo.FU_Catalogo_CategoriaJson(@IDCategoria);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CATALOGO', 'Categorias', @IDCategoria, 'MODIFICAR', @Antes, @Despues;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 50409, 'Ya existe una categoria con ese nombre.', 1;
        THROW;
    END CATCH

    EXEC dbo.SP_Catalogo_ObtenerCategoria @IDCategoria = @IDCategoria;
END
GO

-- Desactivar una categoría oculta todos sus productos en la tienda.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoCategoria
    @IDCategoria        INT,
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
    FROM dbo.Categorias WITH (UPDLOCK, HOLDLOCK)
    WHERE IDCategoria = @IDCategoria;

    IF @ActivoActual IS NULL
        THROW 50404, 'Categoria no encontrada.', 1;

    IF @ActivoActual <> @Activo
    BEGIN
        SELECT @Antes = Valor FROM dbo.FU_Catalogo_CategoriaJson(@IDCategoria);

        UPDATE dbo.Categorias
        SET Activo = @Activo,
            FechaModificacion = SYSUTCDATETIME()
        WHERE IDCategoria = @IDCategoria;

        SELECT @Despues = Valor FROM dbo.FU_Catalogo_CategoriaJson(@IDCategoria);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CATALOGO', 'Categorias', @IDCategoria, @Accion, @Antes, @Despues;
    END

    COMMIT;

    EXEC dbo.SP_Catalogo_ObtenerCategoria @IDCategoria = @IDCategoria;
END
GO

-- Solo se elimina si no tiene productos ni cupones; si no, hay que desactivarla.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarCategoria
    @IDCategoria        INT,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Antes NVARCHAR(MAX);

    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WITH (UPDLOCK, HOLDLOCK) WHERE IDCategoria = @IDCategoria)
        THROW 50404, 'Categoria no encontrada.', 1;

    IF EXISTS (SELECT 1 FROM dbo.Productos WHERE IDCategoria = @IDCategoria)
        THROW 50409, 'La categoria tiene productos. Desactivela en lugar de eliminarla.', 1;

    IF EXISTS (SELECT 1 FROM dbo.Cupones WHERE IDCategoria = @IDCategoria)
        THROW 50409, 'La categoria esta asociada a cupones. Desactivela en lugar de eliminarla.', 1;

    SELECT @Antes = Valor FROM dbo.FU_Catalogo_CategoriaJson(@IDCategoria);

    DELETE FROM dbo.Categorias WHERE IDCategoria = @IDCategoria;

    EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CATALOGO', 'Categorias', @IDCategoria, 'ELIMINAR', @Antes, NULL;

    COMMIT;
END
GO

/* ===== Productos ===== */

-- Tienda (@IncluirInactivos = 0): solo productos y variantes activos, de categorías activas y con al menos una variante.
-- Administración (@IncluirInactivos = 1): todo, con filtro opcional por @Activo.
-- Búsqueda con CHARINDEX e insensible a acentos: no se arma ningún patrón con el texto del usuario.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_BuscarProductos
    @Texto              NVARCHAR(100) = NULL,
    @IDCategoria        INT = NULL,
    @PrecioMin          DECIMAL(12,2) = NULL,
    @PrecioMax          DECIMAL(12,2) = NULL,
    @SoloDisponibles    BIT = 0,
    @Activo             BIT = NULL,
    @IncluirInactivos   BIT = 0,
    @Orden              VARCHAR(20) = 'recientes',
    @Pagina             INT = 1,
    @TamanioPagina      INT = 12
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @TamanioPagina NOT BETWEEN 1 AND 100
        THROW 50400, 'Parametros de paginacion invalidos.', 1;

    SELECT
        p.IDProducto,
        p.Nombre,
        p.IDCategoria,
        c.Nombre AS Categoria,
        p.Activo,
        p.FechaCreacion,
        MIN(v.Precio) AS PrecioMin,
        MAX(v.Precio) AS PrecioMax,
        ISNULL(SUM(v.ExistenciaDisponible), 0) AS ExistenciaDisponible,
        COUNT(v.IDVariante) AS CantidadVariantes
    INTO #Resultado
    FROM dbo.Productos p
    INNER JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
    LEFT JOIN dbo.Variantes v ON v.IDProducto = p.IDProducto
                             AND (v.Activo = 1 OR @IncluirInactivos = 1)
    WHERE (@IncluirInactivos = 1 OR (p.Activo = 1 AND c.Activo = 1))
      AND (@Activo IS NULL OR p.Activo = @Activo)
      AND (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
      AND (
            @Texto IS NULL
            OR CHARINDEX(@Texto COLLATE Modern_Spanish_CI_AI, p.Nombre COLLATE Modern_Spanish_CI_AI) > 0
            OR CHARINDEX(@Texto COLLATE Modern_Spanish_CI_AI, p.Descripcion COLLATE Modern_Spanish_CI_AI) > 0
          )
      -- Entra si al menos una variante está en el rango de precio.
      AND (
            (@PrecioMin IS NULL AND @PrecioMax IS NULL)
            OR EXISTS
            (
                SELECT 1
                FROM dbo.Variantes vp
                WHERE vp.IDProducto = p.IDProducto
                  AND (vp.Activo = 1 OR @IncluirInactivos = 1)
                  AND (@PrecioMin IS NULL OR vp.Precio >= @PrecioMin)
                  AND (@PrecioMax IS NULL OR vp.Precio <= @PrecioMax)
            )
          )
    GROUP BY p.IDProducto, p.Nombre, p.IDCategoria, c.Nombre, p.Activo, p.FechaCreacion
    HAVING (@IncluirInactivos = 1 OR COUNT(v.IDVariante) > 0)
       AND (@SoloDisponibles = 0 OR SUM(v.ExistenciaDisponible) > 0)
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total FROM #Resultado;

    SELECT
        r.IDProducto, r.Nombre, r.IDCategoria, r.Categoria, r.Activo,
        r.PrecioMin, r.PrecioMax, r.ExistenciaDisponible, r.CantidadVariantes,
        img.Url AS ImagenPrincipal
    FROM #Resultado r
    OUTER APPLY
    (
        SELECT TOP (1) i.Url
        FROM dbo.ProductoImagenes i
        WHERE i.IDProducto = r.IDProducto
        ORDER BY i.Orden
    ) img
    ORDER BY
        CASE WHEN @Orden = 'nombre' THEN r.Nombre END ASC,
        CASE WHEN @Orden = 'precio_asc' THEN r.PrecioMin END ASC,
        CASE WHEN @Orden = 'precio_desc' THEN r.PrecioMax END DESC,
        CASE WHEN @Orden = 'recientes' THEN r.FechaCreacion END DESC,
        r.IDProducto DESC
    OFFSET (@Pagina - 1) * @TamanioPagina ROWS
    FETCH NEXT @TamanioPagina ROWS ONLY;
END
GO

-- Devuelve tres resultados: producto, imágenes y variantes.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerProducto
    @IDProducto         INT,
    @IncluirInactivos   BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Productos p
        INNER JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
        WHERE p.IDProducto = @IDProducto
          AND (@IncluirInactivos = 1 OR (p.Activo = 1 AND c.Activo = 1))
    )
        THROW 50404, 'Producto no encontrado.', 1;

    SELECT
        p.IDProducto, p.IDCategoria, c.Nombre AS Categoria, p.Nombre, p.Descripcion,
        p.Activo, p.FechaCreacion, p.FechaModificacion
    FROM dbo.Productos p
    INNER JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
    WHERE p.IDProducto = @IDProducto;

    SELECT i.IDProductoImagen, i.Url, i.Orden
    FROM dbo.ProductoImagenes i
    WHERE i.IDProducto = @IDProducto
    ORDER BY i.Orden;

    SELECT
        v.IDVariante, v.IDProducto, v.SKU, v.Talla, v.Color, v.Precio,
        v.ExistenciaFisica, v.ExistenciaReservada, v.ExistenciaDisponible, v.Activo
    FROM dbo.Variantes v
    WHERE v.IDProducto = @IDProducto
      AND (v.Activo = 1 OR @IncluirInactivos = 1)
    ORDER BY v.SKU;
END
GO

-- @Imagenes: arreglo JSON de URLs, en orden (la primera es la principal).
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearProducto
    @IDCategoria        INT,
    @Nombre             NVARCHAR(150),
    @Descripcion        NVARCHAR(2000) = NULL,
    @Imagenes           NVARCHAR(MAX) = NULL,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDProducto INT, @Despues NVARCHAR(MAX);

    IF @Imagenes IS NOT NULL AND ISJSON(@Imagenes) = 0
        THROW 50400, 'La lista de imagenes no es valida.', 1;

    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria AND Activo = 1)
        THROW 50400, 'La categoria indicada no existe o esta inactiva.', 1;

    INSERT INTO dbo.Productos (IDCategoria, Nombre, Descripcion)
    VALUES (@IDCategoria, @Nombre, @Descripcion);

    SET @IDProducto = SCOPE_IDENTITY();

    INSERT INTO dbo.ProductoImagenes (IDProducto, Url, Orden)
    SELECT @IDProducto, j.[value], CAST(j.[key] AS INT) + 1
    FROM OPENJSON(@Imagenes) j;

    SELECT @Despues = Valor FROM dbo.FU_Catalogo_ProductoJson(@IDProducto);

    EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CATALOGO', 'Productos', @IDProducto, 'CREAR', NULL, @Despues;

    COMMIT;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END
GO

-- @Imagenes NULL deja las imágenes como están; un arreglo las reemplaza todas.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarProducto
    @IDProducto         INT,
    @IDCategoria        INT,
    @Nombre             NVARCHAR(150),
    @Descripcion        NVARCHAR(2000) = NULL,
    @Imagenes           NVARCHAR(MAX) = NULL,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Antes NVARCHAR(MAX), @Despues NVARCHAR(MAX);

    IF @Imagenes IS NOT NULL AND ISJSON(@Imagenes) = 0
        THROW 50400, 'La lista de imagenes no es valida.', 1;

    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WITH (UPDLOCK, HOLDLOCK) WHERE IDProducto = @IDProducto)
        THROW 50404, 'Producto no encontrado.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria AND Activo = 1)
        THROW 50400, 'La categoria indicada no existe o esta inactiva.', 1;

    SELECT @Antes = Valor FROM dbo.FU_Catalogo_ProductoJson(@IDProducto);

    UPDATE dbo.Productos
    SET IDCategoria = @IDCategoria,
        Nombre = @Nombre,
        Descripcion = @Descripcion,
        FechaModificacion = SYSUTCDATETIME()
    WHERE IDProducto = @IDProducto;

    IF @Imagenes IS NOT NULL
    BEGIN
        DELETE FROM dbo.ProductoImagenes WHERE IDProducto = @IDProducto;

        INSERT INTO dbo.ProductoImagenes (IDProducto, Url, Orden)
        SELECT @IDProducto, j.[value], CAST(j.[key] AS INT) + 1
        FROM OPENJSON(@Imagenes) j;
    END

    SELECT @Despues = Valor FROM dbo.FU_Catalogo_ProductoJson(@IDProducto);

    EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CATALOGO', 'Productos', @IDProducto, 'MODIFICAR', @Antes, @Despues;

    COMMIT;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoProducto
    @IDProducto         INT,
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
    FROM dbo.Productos WITH (UPDLOCK, HOLDLOCK)
    WHERE IDProducto = @IDProducto;

    IF @ActivoActual IS NULL
        THROW 50404, 'Producto no encontrado.', 1;

    IF @ActivoActual <> @Activo
    BEGIN
        SELECT @Antes = Valor FROM dbo.FU_Catalogo_ProductoJson(@IDProducto);

        UPDATE dbo.Productos
        SET Activo = @Activo,
            FechaModificacion = SYSUTCDATETIME()
        WHERE IDProducto = @IDProducto;

        SELECT @Despues = Valor FROM dbo.FU_Catalogo_ProductoJson(@IDProducto);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CATALOGO', 'Productos', @IDProducto, @Accion, @Antes, @Despues;
    END

    COMMIT;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END
GO

-- Borrado físico solo si ninguna variante tiene historia (ventas, kardex, carritos o reservas).
-- Con historia hay que desactivarlo: así lo pide RF-02 para productos con ventas.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarProducto
    @IDProducto         INT,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Antes NVARCHAR(MAX);

    BEGIN TRAN;

    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WITH (UPDLOCK, HOLDLOCK) WHERE IDProducto = @IDProducto)
        THROW 50404, 'Producto no encontrado.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.Variantes v
        WHERE v.IDProducto = @IDProducto
          AND (
                EXISTS (SELECT 1 FROM dbo.PedidoDetalle d WHERE d.IDVariante = v.IDVariante)
                OR EXISTS (SELECT 1 FROM dbo.Kardex k WHERE k.IDVariante = v.IDVariante)
                OR EXISTS (SELECT 1 FROM dbo.CarritoDetalle cd WHERE cd.IDVariante = v.IDVariante)
                OR EXISTS (SELECT 1 FROM dbo.Reservas r WHERE r.IDVariante = v.IDVariante)
              )
    )
        THROW 50409, 'El producto tiene ventas o movimientos de inventario. Desactivelo en lugar de eliminarlo.', 1;

    SELECT @Antes = Valor FROM dbo.FU_Catalogo_ProductoJson(@IDProducto);

    DELETE FROM dbo.ProductoImagenes WHERE IDProducto = @IDProducto;
    DELETE FROM dbo.Variantes WHERE IDProducto = @IDProducto;
    DELETE FROM dbo.Productos WHERE IDProducto = @IDProducto;

    EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CATALOGO', 'Productos', @IDProducto, 'ELIMINAR', @Antes, NULL;

    COMMIT;
END
GO

/* ===== Variantes ===== */

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerVariante
    @IDVariante INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Variantes WHERE IDVariante = @IDVariante)
        THROW 50404, 'Variante no encontrada.', 1;

    SELECT
        v.IDVariante, v.IDProducto, v.SKU, v.Talla, v.Color, v.Precio,
        v.ExistenciaFisica, v.ExistenciaReservada, v.ExistenciaDisponible, v.Activo
    FROM dbo.Variantes v
    WHERE v.IDVariante = @IDVariante;
END
GO

-- La variante nace en 0 y la existencia inicial entra como ENTRADA por SP_Inventario_RegistrarMovimiento,
-- en la misma transacción. Después, la existencia solo cambia desde el módulo de inventario.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearVariante
    @IDProducto         INT,
    @SKU                VARCHAR(50),
    @Talla              NVARCHAR(20) = NULL,
    @Color              NVARCHAR(30) = NULL,
    @Precio             DECIMAL(12,2),
    @ExistenciaInicial  INT = 0,
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDVariante INT, @Despues NVARCHAR(MAX);

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM dbo.Productos WITH (UPDLOCK, HOLDLOCK) WHERE IDProducto = @IDProducto)
            THROW 50404, 'Producto no encontrado.', 1;

        INSERT INTO dbo.Variantes (IDProducto, SKU, Talla, Color, Precio)
        VALUES (@IDProducto, @SKU, @Talla, @Color, @Precio);

        SET @IDVariante = SCOPE_IDENTITY();

        SELECT @Despues = Valor FROM dbo.FU_Catalogo_VarianteJson(@IDVariante);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CATALOGO', 'Variantes', @IDVariante, 'CREAR', NULL, @Despues;

        IF @ExistenciaInicial > 0
            EXEC dbo.SP_Inventario_RegistrarMovimiento
                @IDVariante = @IDVariante,
                @TipoMovimiento = 'ENTRADA',
                @Cantidad = @ExistenciaInicial,
                @Motivo = N'Existencia inicial',
                @IDUsuario = @IDUsuarioAccion;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627)
        BEGIN
            IF ERROR_MESSAGE() LIKE '%UQ_Variantes_SKU%'
                THROW 50409, 'Ya existe una variante con ese SKU.', 1;
            THROW 50409, 'El producto ya tiene una variante con esa talla y color.', 1;
        END;
        THROW;
    END CATCH

    EXEC dbo.SP_Catalogo_ObtenerVariante @IDVariante = @IDVariante;
END
GO

-- No toca existencias. Un cambio de precio no afecta pedidos ya hechos (el precio se copia a PedidoDetalle).
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarVariante
    @IDVariante         INT,
    @SKU                VARCHAR(50),
    @Talla              NVARCHAR(20) = NULL,
    @Color              NVARCHAR(30) = NULL,
    @Precio             DECIMAL(12,2),
    @IDUsuarioAccion    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Antes NVARCHAR(MAX), @Despues NVARCHAR(MAX);

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM dbo.Variantes WITH (UPDLOCK, HOLDLOCK) WHERE IDVariante = @IDVariante)
            THROW 50404, 'Variante no encontrada.', 1;

        SELECT @Antes = Valor FROM dbo.FU_Catalogo_VarianteJson(@IDVariante);

        UPDATE dbo.Variantes
        SET SKU = @SKU,
            Talla = @Talla,
            Color = @Color,
            Precio = @Precio,
            FechaModificacion = SYSUTCDATETIME()
        WHERE IDVariante = @IDVariante;

        SELECT @Despues = Valor FROM dbo.FU_Catalogo_VarianteJson(@IDVariante);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CATALOGO', 'Variantes', @IDVariante, 'MODIFICAR', @Antes, @Despues;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627)
        BEGIN
            IF ERROR_MESSAGE() LIKE '%UQ_Variantes_SKU%'
                THROW 50409, 'Ya existe una variante con ese SKU.', 1;
            THROW 50409, 'El producto ya tiene una variante con esa talla y color.', 1;
        END;
        THROW;
    END CATCH

    EXEC dbo.SP_Catalogo_ObtenerVariante @IDVariante = @IDVariante;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoVariante
    @IDVariante         INT,
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
    FROM dbo.Variantes WITH (UPDLOCK, HOLDLOCK)
    WHERE IDVariante = @IDVariante;

    IF @ActivoActual IS NULL
        THROW 50404, 'Variante no encontrada.', 1;

    IF @ActivoActual <> @Activo
    BEGIN
        SELECT @Antes = Valor FROM dbo.FU_Catalogo_VarianteJson(@IDVariante);

        UPDATE dbo.Variantes
        SET Activo = @Activo,
            FechaModificacion = SYSUTCDATETIME()
        WHERE IDVariante = @IDVariante;

        SELECT @Despues = Valor FROM dbo.FU_Catalogo_VarianteJson(@IDVariante);

        EXEC dbo.SP_Bitacora_Registrar @IDUsuarioAccion, 'CATALOGO', 'Variantes', @IDVariante, @Accion, @Antes, @Despues;
    END

    COMMIT;

    EXEC dbo.SP_Catalogo_ObtenerVariante @IDVariante = @IDVariante;
END
GO
