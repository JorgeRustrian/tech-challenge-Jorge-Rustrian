/*
    001_CrearBaseDatos.sql
    Crea la base de datos ShopCart desde cero.

*/
USE master;
GO



-- Collation explícita para no depender de la configuración del servidor del evaluador.
CREATE DATABASE ShopCart COLLATE Modern_Spanish_CI_AS;
GO

-- Las lecturas no bloquean a las escrituras (versionado de filas).
ALTER DATABASE ShopCart SET READ_COMMITTED_SNAPSHOT ON;
GO
