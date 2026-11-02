/*
    011_Usuario_Aplicacion.sql
    Login con el que se conecta el backend. La contraseña no vive en el repo:
    se pasa como variable SQLCMD.

    sqlcmd -S localhost -E -C -b -I -v APP_PASSWORD="..." -i 011_Usuario_Aplicacion.sql
    (En SSMS: Query > SQLCMD Mode y agregar arriba  :setvar APP_PASSWORD "...")
*/
USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'shopcart_app')
    CREATE LOGIN shopcart_app WITH PASSWORD = N'$(APP_PASSWORD)', DEFAULT_DATABASE = ShopCart, CHECK_POLICY = ON;
GO

USE ShopCart;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'shopcart_app')
    CREATE USER shopcart_app FOR LOGIN shopcart_app;
GO

-- Solo ejecuta SPs. No tiene permisos sobre tablas: los SPs acceden a ellas por encadenamiento de propiedad (dbo).
GRANT EXECUTE ON SCHEMA::dbo TO shopcart_app;
GO
