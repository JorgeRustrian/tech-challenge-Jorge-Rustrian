import { z, type ZodType } from 'zod';
import { loginSchema, registroSchema } from '../modulos/auth/auth.schemas';
import { consultarBitacoraSchema } from '../modulos/bitacora/bitacora.schemas';
import {
  actualizarItemSchema,
  agregarItemSchema,
  aplicarCuponSchema,
} from '../modulos/carrito/carrito.schemas';
import {
  busquedaAdminSchema,
  busquedaTiendaSchema,
  categoriaSchema,
  productoActualizarSchema,
  productoCrearSchema,
  varianteActualizarSchema,
  varianteCrearSchema,
} from '../modulos/catalogo/catalogo.schemas';
import { pagarSchema } from '../modulos/checkout/checkout.schemas';
import { cuponSchema, listarCuponesSchema } from '../modulos/cupones/cupones.schemas';
import { direccionActualizarSchema, direccionSchema } from '../modulos/direcciones/direcciones.schemas';
import {
  ajusteSchema,
  entradaSchema,
  existenciasQuerySchema,
  kardexQuerySchema,
} from '../modulos/inventario/inventario.schemas';
import {
  cambiarEstadoSchema,
  cancelarSchema,
  devolucionSchema,
  listarMisPedidosSchema,
  listarPedidosSchema,
} from '../modulos/pedidos/pedidos.schemas';
import {
  carritosAbandonadosSchema,
  productosMasVendidosSchema,
  rangoReporteSchema,
  ventasPorPeriodoSchema,
} from '../modulos/reportes/reportes.schemas';
import {
  actualizarUsuarioSchema,
  cambiarPasswordSchema,
  crearUsuarioSchema,
  listarUsuariosSchema,
} from '../modulos/usuarios/usuarios.schemas';
import { estadoSchema } from '../utils/esquemas';

// Los parámetros y cuerpos se generan de los mismos esquemas Zod que validan las peticiones:
// si cambia una validación, cambia la documentación. Aquí solo se escribe lo que Zod no sabe.

type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';

// publico: sin token · opcional: cliente o invitado (carrito) · cookie: refresh token
// sesion: cualquier usuario autenticado · cliente / staff / admin: además exige rol
type Acceso = 'publico' | 'opcional' | 'cookie' | 'sesion' | 'cliente' | 'staff' | 'admin';

interface Operacion {
  metodo: Metodo;
  ruta: string;
  tag: string;
  resumen: string;
  descripcion?: string;
  acceso: Acceso;
  query?: ZodType;
  body?: ZodType;
  encabezados?: { nombre: string; descripcion: string; requerido: boolean }[];
  respuestas: Record<number, string>;
}

const ROL: Partial<Record<Acceso, string>> = {
  cliente: 'Rol: Cliente.',
  staff: 'Rol: Administrador u Operador.',
  admin: 'Rol: Administrador.',
  sesion: 'Cualquier usuario con sesión.',
  opcional: 'Cliente con sesión o invitado con X-Carrito-Token. Administradores y operadores reciben 403.',
};

const OPERACIONES: Operacion[] = [
  /* ---- Salud ---- */
  { metodo: 'get', ruta: '/salud', tag: 'Salud', resumen: 'Estado de la API y de la conexión a la base de datos', acceso: 'publico', respuestas: { 200: 'API en línea' } },

  /* ---- Autenticación ---- */
  { metodo: 'post', ruta: '/auth/registro', tag: 'Autenticación', resumen: 'Registrar cliente', descripcion: 'Crea un cliente y abre sesión. Responde `{ accessToken, usuario }` y deja el refresh token en la cookie httpOnly `refreshToken`.', acceso: 'publico', body: registroSchema, respuestas: { 201: 'Cliente registrado', 409: 'El correo ya está registrado', 429: 'Demasiados intentos' } },
  { metodo: 'post', ruta: '/auth/login', tag: 'Autenticación', resumen: 'Iniciar sesión', descripcion: 'Responde `{ accessToken, usuario }` y deja el refresh token en la cookie `refreshToken`.', acceso: 'publico', body: loginSchema, respuestas: { 200: 'Sesión iniciada', 401: 'Correo o contraseña incorrectos', 403: 'Usuario desactivado', 429: 'Demasiados intentos' } },
  { metodo: 'post', ruta: '/auth/refresh', tag: 'Autenticación', resumen: 'Renovar access token', descripcion: 'Rota el refresh token: el usado queda revocado. Presentar uno ya revocado revoca toda la sesión.', acceso: 'cookie', respuestas: { 200: 'Nuevo access token', 401: 'Sesión inválida, vencida o token reutilizado' } },
  { metodo: 'post', ruta: '/auth/logout', tag: 'Autenticación', resumen: 'Cerrar sesión', acceso: 'cookie', respuestas: { 204: 'Sesión cerrada' } },
  { metodo: 'get', ruta: '/auth/perfil', tag: 'Autenticación', resumen: 'Datos del usuario autenticado', acceso: 'sesion', respuestas: { 200: 'Perfil' } },

  /* ---- Catálogo: tienda ---- */
  { metodo: 'get', ruta: '/catalogo/categorias', tag: 'Catálogo — tienda', resumen: 'Categorías activas', acceso: 'publico', respuestas: { 200: 'Categorías' } },
  { metodo: 'get', ruta: '/catalogo/productos', tag: 'Catálogo — tienda', resumen: 'Buscar productos', descripcion: 'Búsqueda por texto (sin distinguir acentos), filtros y paginación del lado del servidor.', acceso: 'publico', query: busquedaTiendaSchema, respuestas: { 200: 'Listado paginado' } },
  { metodo: 'get', ruta: '/catalogo/productos/:id', tag: 'Catálogo — tienda', resumen: 'Detalle de producto', acceso: 'publico', respuestas: { 200: 'Producto con imágenes y variantes activas', 404: 'No existe o no está activo' } },

  /* ---- Catálogo: administración ---- */
  { metodo: 'get', ruta: '/admin/catalogo/categorias', tag: 'Catálogo — administración', resumen: 'Todas las categorías', acceso: 'staff', respuestas: { 200: 'Categorías, incluidas las inactivas' } },
  { metodo: 'post', ruta: '/admin/catalogo/categorias', tag: 'Catálogo — administración', resumen: 'Crear categoría', acceso: 'admin', body: categoriaSchema, respuestas: { 201: 'Creada', 409: 'Nombre repetido' } },
  { metodo: 'put', ruta: '/admin/catalogo/categorias/:id', tag: 'Catálogo — administración', resumen: 'Modificar categoría', acceso: 'admin', body: categoriaSchema, respuestas: { 200: 'Modificada', 404: 'No existe', 409: 'Nombre repetido' } },
  { metodo: 'patch', ruta: '/admin/catalogo/categorias/:id/estado', tag: 'Catálogo — administración', resumen: 'Activar / desactivar categoría', acceso: 'admin', body: estadoSchema, respuestas: { 200: 'Actualizada', 404: 'No existe' } },
  { metodo: 'delete', ruta: '/admin/catalogo/categorias/:id', tag: 'Catálogo — administración', resumen: 'Eliminar categoría', acceso: 'admin', respuestas: { 204: 'Eliminada', 404: 'No existe', 409: 'Tiene productos o cupones: hay que desactivarla' } },
  { metodo: 'get', ruta: '/admin/catalogo/productos', tag: 'Catálogo — administración', resumen: 'Buscar productos (incluye inactivos)', acceso: 'staff', query: busquedaAdminSchema, respuestas: { 200: 'Listado paginado' } },
  { metodo: 'get', ruta: '/admin/catalogo/productos/:id', tag: 'Catálogo — administración', resumen: 'Detalle con existencias', acceso: 'staff', respuestas: { 200: 'Producto', 404: 'No existe' } },
  { metodo: 'post', ruta: '/admin/catalogo/productos', tag: 'Catálogo — administración', resumen: 'Crear producto', acceso: 'admin', body: productoCrearSchema, respuestas: { 201: 'Creado (sin variantes todavía)' } },
  { metodo: 'put', ruta: '/admin/catalogo/productos/:id', tag: 'Catálogo — administración', resumen: 'Modificar producto', descripcion: 'Sin `imagenes` se conservan las actuales; con un arreglo se reemplazan todas.', acceso: 'admin', body: productoActualizarSchema, respuestas: { 200: 'Modificado', 404: 'No existe' } },
  { metodo: 'patch', ruta: '/admin/catalogo/productos/:id/estado', tag: 'Catálogo — administración', resumen: 'Activar / desactivar producto', acceso: 'admin', body: estadoSchema, respuestas: { 200: 'Actualizado', 404: 'No existe' } },
  { metodo: 'delete', ruta: '/admin/catalogo/productos/:id', tag: 'Catálogo — administración', resumen: 'Eliminar producto', descripcion: 'Solo si ninguna variante tiene ventas, kardex, carritos ni reservas.', acceso: 'admin', respuestas: { 204: 'Eliminado', 404: 'No existe', 409: 'Tiene historia: hay que desactivarlo' } },
  { metodo: 'post', ruta: '/admin/catalogo/productos/:id/variantes', tag: 'Catálogo — administración', resumen: 'Crear variante', descripcion: 'La existencia inicial entra al kardex como ENTRADA.', acceso: 'admin', body: varianteCrearSchema, respuestas: { 201: 'Creada', 404: 'El producto no existe', 409: 'SKU repetido o talla y color repetidos' } },
  { metodo: 'put', ruta: '/admin/catalogo/variantes/:id', tag: 'Catálogo — administración', resumen: 'Modificar variante (SKU, talla, color, precio)', descripcion: 'No toca existencias. Un cambio de precio no afecta pedidos ya hechos.', acceso: 'admin', body: varianteActualizarSchema, respuestas: { 200: 'Modificada', 404: 'No existe', 409: 'SKU repetido o talla y color repetidos' } },
  { metodo: 'patch', ruta: '/admin/catalogo/variantes/:id/estado', tag: 'Catálogo — administración', resumen: 'Activar / desactivar variante', acceso: 'admin', body: estadoSchema, respuestas: { 200: 'Actualizada', 404: 'No existe' } },

  /* ---- Inventario ---- */
  { metodo: 'get', ruta: '/admin/inventario/existencias', tag: 'Inventario', resumen: 'Existencias por variante', descripcion: '`existenciaMaxima=0` lista las agotadas.', acceso: 'staff', query: existenciasQuerySchema, respuestas: { 200: 'Listado paginado' } },
  { metodo: 'get', ruta: '/admin/inventario/conciliacion', tag: 'Inventario', resumen: 'Conciliación existencia vs. kardex', descripcion: 'Variantes cuya existencia no coincide con la suma del kardex o con las reservas activas. Debe venir vacío.', acceso: 'staff', respuestas: { 200: 'Resultado de la conciliación' } },
  { metodo: 'get', ruta: '/admin/inventario/variantes/:id/kardex', tag: 'Inventario', resumen: 'Kardex de una variante', acceso: 'staff', query: kardexQuerySchema, respuestas: { 200: 'Movimientos paginados', 404: 'La variante no existe' } },
  { metodo: 'post', ruta: '/admin/inventario/variantes/:id/entradas', tag: 'Inventario', resumen: 'Registrar entrada por compra', acceso: 'staff', body: entradaSchema, respuestas: { 201: 'Movimiento registrado', 404: 'La variante no existe' } },
  { metodo: 'post', ruta: '/admin/inventario/variantes/:id/ajustes', tag: 'Inventario', resumen: 'Registrar ajuste manual', descripcion: 'Cantidad con signo. Exige motivo.', acceso: 'staff', body: ajusteSchema, respuestas: { 201: 'Movimiento registrado', 404: 'La variante no existe', 409: 'Dejaría la existencia en negativo o por debajo de lo reservado' } },

  /* ---- Carrito ---- */
  { metodo: 'get', ruta: '/carrito', tag: 'Carrito', resumen: 'Carrito actual', acceso: 'opcional', respuestas: { 200: 'Carrito (vacío si no hay)' } },
  { metodo: 'post', ruta: '/carrito/items', tag: 'Carrito', resumen: 'Agregar producto', descripcion: 'Suma a lo que ya hubiera. Si el invitado no tenía carrito, la respuesta trae `token` para usarlo en X-Carrito-Token.', acceso: 'opcional', body: agregarItemSchema, respuestas: { 200: 'Carrito actualizado', 404: 'El producto no existe', 409: 'No hay existencia suficiente' } },
  { metodo: 'put', ruta: '/carrito/items/:idVariante', tag: 'Carrito', resumen: 'Fijar cantidad de una línea', acceso: 'opcional', body: actualizarItemSchema, respuestas: { 200: 'Carrito actualizado', 404: 'El producto no está en el carrito', 409: 'No hay existencia suficiente' } },
  { metodo: 'delete', ruta: '/carrito/items/:idVariante', tag: 'Carrito', resumen: 'Quitar una línea', acceso: 'opcional', respuestas: { 200: 'Carrito actualizado' } },
  { metodo: 'delete', ruta: '/carrito', tag: 'Carrito', resumen: 'Vaciar carrito', acceso: 'opcional', respuestas: { 200: 'Carrito vacío' } },
  { metodo: 'post', ruta: '/carrito/cupon', tag: 'Carrito', resumen: 'Aplicar cupón', descripcion: 'Un cupón por carrito; aplicar otro lo reemplaza.', acceso: 'opcional', body: aplicarCuponSchema, respuestas: { 200: 'Cupón aplicado', 404: 'El cupón no existe', 422: 'No vigente, vencido, agotado, límite por cliente, categoría o mínimo de compra', 429: 'Demasiados intentos' } },
  { metodo: 'delete', ruta: '/carrito/cupon', tag: 'Carrito', resumen: 'Quitar cupón', acceso: 'opcional', respuestas: { 200: 'Carrito actualizado' } },
  { metodo: 'post', ruta: '/carrito/fusionar', tag: 'Carrito', resumen: 'Pasar el carrito de invitado al del cliente', descripcion: 'Se llama después de iniciar sesión.', acceso: 'cliente', encabezados: [{ nombre: 'X-Carrito-Token', descripcion: 'Token del carrito que se usó como invitado', requerido: true }], respuestas: { 200: 'Carrito del cliente' } },

  /* ---- Cupones ---- */
  { metodo: 'get', ruta: '/admin/cupones', tag: 'Cupones', resumen: 'Listar cupones', acceso: 'admin', query: listarCuponesSchema, respuestas: { 200: 'Listado paginado' } },
  { metodo: 'get', ruta: '/admin/cupones/:id', tag: 'Cupones', resumen: 'Detalle de cupón', acceso: 'admin', respuestas: { 200: 'Cupón', 404: 'No existe' } },
  { metodo: 'post', ruta: '/admin/cupones', tag: 'Cupones', resumen: 'Crear cupón', descripcion: 'Fechas ISO 8601 con zona horaria.', acceso: 'admin', body: cuponSchema, respuestas: { 201: 'Creado', 409: 'Código repetido' } },
  { metodo: 'put', ruta: '/admin/cupones/:id', tag: 'Cupones', resumen: 'Modificar cupón', acceso: 'admin', body: cuponSchema, respuestas: { 200: 'Modificado', 404: 'No existe', 409: 'Código repetido o límite menor que los usos ya registrados' } },
  { metodo: 'patch', ruta: '/admin/cupones/:id/estado', tag: 'Cupones', resumen: 'Activar / desactivar cupón', acceso: 'admin', body: estadoSchema, respuestas: { 200: 'Actualizado', 404: 'No existe' } },
  { metodo: 'delete', ruta: '/admin/cupones/:id', tag: 'Cupones', resumen: 'Eliminar cupón', acceso: 'admin', respuestas: { 204: 'Eliminado', 404: 'No existe', 409: 'Ya se usó: hay que desactivarlo' } },

  /* ---- Direcciones ---- */
  { metodo: 'get', ruta: '/direcciones', tag: 'Direcciones', resumen: 'Mis direcciones', acceso: 'cliente', respuestas: { 200: 'Direcciones activas' } },
  { metodo: 'post', ruta: '/direcciones', tag: 'Direcciones', resumen: 'Crear dirección', acceso: 'cliente', body: direccionSchema, respuestas: { 201: 'Creada', 409: 'Máximo 10 direcciones' } },
  { metodo: 'put', ruta: '/direcciones/:id', tag: 'Direcciones', resumen: 'Modificar dirección', acceso: 'cliente', body: direccionActualizarSchema, respuestas: { 200: 'Modificada', 404: 'No existe o es de otro cliente' } },
  { metodo: 'patch', ruta: '/direcciones/:id/predeterminada', tag: 'Direcciones', resumen: 'Marcar como predeterminada', acceso: 'cliente', respuestas: { 200: 'Direcciones', 404: 'No existe o es de otro cliente' } },
  { metodo: 'delete', ruta: '/direcciones/:id', tag: 'Direcciones', resumen: 'Eliminar dirección', acceso: 'cliente', respuestas: { 204: 'Desactivada', 404: 'No existe o es de otro cliente' } },

  /* ---- Checkout ---- */
  { metodo: 'get', ruta: '/checkout', tag: 'Checkout', resumen: 'Resumen del pago en curso', acceso: 'cliente', respuestas: { 200: 'Resumen con precios congelados y tiempo restante', 404: 'No hay pago en curso' } },
  { metodo: 'post', ruta: '/checkout/iniciar', tag: 'Checkout', resumen: 'Iniciar pago', descripcion: 'Reserva la existencia de todo el carrito por 15 minutos y congela precios. Todo o nada.', acceso: 'cliente', respuestas: { 200: 'Resumen del pago', 409: 'No hay existencia suficiente de algún producto', 422: 'Carrito vacío o cupón no válido' } },
  { metodo: 'post', ruta: '/checkout/pagar', tag: 'Checkout', resumen: 'Pagar y crear el pedido', descripcion: 'Atómico e idempotente: repetir con la misma Idempotency-Key devuelve el mismo pedido (200 y encabezado `Idempotent-Replayed: true`).', acceso: 'cliente', body: pagarSchema, encabezados: [{ nombre: 'Idempotency-Key', descripcion: 'UUID generado por el cliente una vez por intento de pago', requerido: true }], respuestas: { 201: 'Pedido creado', 200: 'Reintento: el mismo pedido', 404: 'Dirección no encontrada', 409: 'No hay pago en curso o la reserva venció', 422: 'Cupón no válido' } },

  /* ---- Pedidos: cliente ---- */
  { metodo: 'get', ruta: '/pedidos', tag: 'Pedidos — cliente', resumen: 'Mis pedidos', acceso: 'cliente', query: listarMisPedidosSchema, respuestas: { 200: 'Listado paginado' } },
  { metodo: 'get', ruta: '/pedidos/:id', tag: 'Pedidos — cliente', resumen: 'Detalle de mi pedido', acceso: 'cliente', respuestas: { 200: 'Pedido con historial y devoluciones', 404: 'No existe o es de otro cliente' } },
  { metodo: 'post', ruta: '/pedidos/:id/cancelar', tag: 'Pedidos — cliente', resumen: 'Cancelar mi pedido', descripcion: 'Solo antes del despacho. Reintegra la existencia.', acceso: 'cliente', body: cancelarSchema, respuestas: { 200: 'Pedido cancelado', 404: 'No existe o es de otro cliente', 409: 'Ya fue despachado' } },

  /* ---- Pedidos: administración ---- */
  { metodo: 'get', ruta: '/admin/pedidos', tag: 'Pedidos — administración', resumen: 'Listar pedidos', acceso: 'staff', query: listarPedidosSchema, respuestas: { 200: 'Listado paginado' } },
  { metodo: 'get', ruta: '/admin/pedidos/:id', tag: 'Pedidos — administración', resumen: 'Detalle de pedido', acceso: 'staff', respuestas: { 200: 'Pedido', 404: 'No existe' } },
  { metodo: 'patch', ruta: '/admin/pedidos/:id/estado', tag: 'Pedidos — administración', resumen: 'Cambiar estado', descripcion: 'Valida la transición en el backend, en el SP y en el trigger de la tabla.', acceso: 'staff', body: cambiarEstadoSchema, respuestas: { 200: 'Pedido actualizado', 404: 'No existe', 409: 'Transición no permitida' } },
  { metodo: 'post', ruta: '/admin/pedidos/:id/devoluciones', tag: 'Pedidos — administración', resumen: 'Registrar devolución', descripcion: 'Total o parcial por línea. Reintegra la existencia y calcula el reembolso.', acceso: 'staff', body: devolucionSchema, respuestas: { 201: 'Devolución registrada', 404: 'No existe', 409: 'El pedido no está entregado o se devuelve más de lo pendiente' } },

  /* ---- Reportes ---- */
  { metodo: 'get', ruta: '/admin/reportes/resumen', tag: 'Reportes', resumen: 'Indicadores del dashboard', acceso: 'admin', query: rangoReporteSchema, respuestas: { 200: 'Indicadores' } },
  { metodo: 'get', ruta: '/admin/reportes/ventas', tag: 'Reportes', resumen: 'Ventas por día, semana o mes', acceso: 'admin', query: ventasPorPeriodoSchema, respuestas: { 200: 'Serie sin huecos' } },
  { metodo: 'get', ruta: '/admin/reportes/ventas-por-categoria', tag: 'Reportes', resumen: 'Ventas por categoría', acceso: 'admin', query: rangoReporteSchema, respuestas: { 200: 'Ventas y porcentaje por categoría' } },
  { metodo: 'get', ruta: '/admin/reportes/productos-mas-vendidos', tag: 'Reportes', resumen: 'Productos más vendidos', acceso: 'admin', query: productosMasVendidosSchema, respuestas: { 200: 'Top por unidades netas' } },
  { metodo: 'get', ruta: '/admin/reportes/carritos-abandonados', tag: 'Reportes', resumen: 'Carritos abandonados', acceso: 'admin', query: carritosAbandonadosSchema, respuestas: { 200: 'Listado paginado' } },

  /* ---- Bitácora ---- */
  { metodo: 'get', ruta: '/admin/bitacora', tag: 'Bitácora', resumen: 'Consultar bitácora', descripcion: 'Solo lectura: la base de datos impide modificarla o eliminarla.', acceso: 'admin', query: consultarBitacoraSchema, respuestas: { 200: 'Registros paginados' } },

  /* ---- Usuarios ---- */
  { metodo: 'get', ruta: '/admin/usuarios', tag: 'Usuarios', resumen: 'Listar usuarios', acceso: 'admin', query: listarUsuariosSchema, respuestas: { 200: 'Listado paginado' } },
  { metodo: 'get', ruta: '/admin/usuarios/:id', tag: 'Usuarios', resumen: 'Detalle de usuario', acceso: 'admin', respuestas: { 200: 'Usuario', 404: 'No existe' } },
  { metodo: 'post', ruta: '/admin/usuarios', tag: 'Usuarios', resumen: 'Crear usuario', acceso: 'admin', body: crearUsuarioSchema, respuestas: { 201: 'Creado', 409: 'El correo ya está registrado' } },
  { metodo: 'put', ruta: '/admin/usuarios/:id', tag: 'Usuarios', resumen: 'Modificar usuario y rol', acceso: 'admin', body: actualizarUsuarioSchema, respuestas: { 200: 'Modificado', 404: 'No existe', 409: 'Correo repetido, o quitaría el último Administrador o el propio rol' } },
  { metodo: 'patch', ruta: '/admin/usuarios/:id/estado', tag: 'Usuarios', resumen: 'Activar / desactivar usuario', descripcion: 'Desactivar cierra todas sus sesiones.', acceso: 'admin', body: estadoSchema, respuestas: { 200: 'Actualizado', 404: 'No existe', 409: 'Desactivarse a sí mismo o al último Administrador' } },
  { metodo: 'patch', ruta: '/admin/usuarios/:id/password', tag: 'Usuarios', resumen: 'Restablecer contraseña', descripcion: 'Cierra todas sus sesiones.', acceso: 'admin', body: cambiarPasswordSchema, respuestas: { 204: 'Contraseña restablecida', 404: 'No existe' } },
];

const RESPUESTAS_COMUNES: Record<number, string> = {
  400: 'Datos inválidos (el detalle indica cada campo)',
  401: 'Falta el token, es inválido o expiró',
  403: 'El rol no tiene permiso',
  500: 'Error interno',
};

function aJsonSchema(esquema: ZodType): Record<string, unknown> {
  const json = { ...(z.toJSONSchema(esquema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>) };
  delete json.$schema;
  return json;
}

function parametrosQuery(esquema: ZodType): Record<string, unknown>[] {
  const json = aJsonSchema(esquema) as { properties?: Record<string, unknown>; required?: string[] };
  return Object.entries(json.properties ?? {}).map(([nombre, schema]) => ({
    name: nombre,
    in: 'query',
    required: json.required?.includes(nombre) ?? false,
    schema,
  }));
}

function parametrosRuta(ruta: string): Record<string, unknown>[] {
  return [...ruta.matchAll(/:(\w+)/g)].map(([, nombre]) => ({
    name: nombre,
    in: 'path',
    required: true,
    schema: { type: 'integer', minimum: 1 },
  }));
}

function seguridad(acceso: Acceso): Record<string, string[]>[] {
  switch (acceso) {
    case 'publico':
      return [];
    case 'opcional':
      return [{}, { bearer: [] }, { carritoInvitado: [] }];
    case 'cookie':
      return [{ cookieRefresh: [] }];
    default:
      return [{ bearer: [] }];
  }
}

function respuestas(op: Operacion): Record<string, unknown> {
  const tieneEntradas = Boolean(op.query || op.body || op.ruta.includes(':') || op.encabezados?.length);
  const usaToken = !['publico', 'cookie'].includes(op.acceso);
  const exigeRol = ['cliente', 'staff', 'admin', 'opcional'].includes(op.acceso);

  const codigos: Record<number, string> = {};
  if (tieneEntradas) codigos[400] = RESPUESTAS_COMUNES[400];
  if (usaToken) codigos[401] = RESPUESTAS_COMUNES[401];
  if (exigeRol) codigos[403] = RESPUESTAS_COMUNES[403];
  Object.assign(codigos, op.respuestas);
  codigos[500] = RESPUESTAS_COMUNES[500];

  return Object.fromEntries(
    Object.entries(codigos).map(([codigo, descripcion]) => {
      const n = Number(codigo);
      if (n === 204) return [codigo, { description: descripcion }];
      const schema = n >= 400 ? { $ref: '#/components/schemas/Error' } : { type: 'object' };
      return [codigo, { description: descripcion, content: { 'application/json': { schema } } }];
    }),
  );
}

function construirDocumento(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const op of OPERACIONES) {
    const ruta = `/api${op.ruta.replace(/:(\w+)/g, '{$1}')}`;
    const rol = ROL[op.acceso];

    paths[ruta] ??= {};
    paths[ruta][op.metodo] = {
      tags: [op.tag],
      summary: op.resumen,
      description: [op.descripcion, rol].filter(Boolean).join('\n\n') || undefined,
      security: seguridad(op.acceso),
      parameters: [
        ...parametrosRuta(op.ruta),
        ...(op.query ? parametrosQuery(op.query) : []),
        ...(op.encabezados ?? []).map((e) => ({
          name: e.nombre,
          in: 'header',
          required: e.requerido,
          description: e.descripcion,
          schema: { type: 'string', format: 'uuid' },
        })),
      ],
      ...(op.body
        ? {
            requestBody: {
              required: !op.body.safeParse(undefined).success,
              content: { 'application/json': { schema: aJsonSchema(op.body) } },
            },
          }
        : {}),
      responses: respuestas(op),
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'ShopCart API',
      version: '1.0.0',
      description: [
        'API de la plataforma de ventas ShopCart (Tech Challenge 360).',
        '**Autenticación:** `POST /api/auth/login` devuelve un access token (JWT, 15 minutos) para el encabezado `Authorization: Bearer` y deja el refresh token en una cookie httpOnly. `POST /api/auth/refresh` lo renueva.',
        '**Errores:** siempre `{ "error": { "mensaje": "...", "detalles": [...] } }`.',
        '**Listados:** `{ "datos": [...], "paginacion": { "pagina", "tamanio", "total", "totalPaginas" } }`.',
        '**Montos:** quetzales, IVA del 12 % incluido. **Fechas de filtro:** AAAA-MM-DD en hora de Guatemala; las fechas de respuesta van en UTC.',
      ].join('\n\n'),
    },
    tags: [...new Set(OPERACIONES.map((o) => o.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token de /api/auth/login o /api/auth/refresh.',
        },
        cookieRefresh: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'Cookie httpOnly que dejan el login y el registro.',
        },
        carritoInvitado: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Carrito-Token',
          description: 'Token del carrito de invitado; lo devuelve el primer POST /api/carrito/items.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['mensaje'],
              properties: {
                mensaje: { type: 'string' },
                detalles: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { campo: { type: 'string' }, mensaje: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

export const documentoOpenApi = construirDocumento();

export const totalOperaciones = OPERACIONES.length;
