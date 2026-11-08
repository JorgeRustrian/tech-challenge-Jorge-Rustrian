import type { DetalleError, Sesion, Usuario } from './tipos';

const BASE = '/api';

export class ErrorApi extends Error {
  readonly status: number;
  readonly detalles: DetalleError[];

  constructor(status: number, mensaje: string, detalles: DetalleError[] = []) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.detalles = detalles;
  }
}

export type Parametros = Record<string, string | number | boolean | null | undefined>;

export interface Opciones {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  cuerpo?: unknown;
  parametros?: Parametros;
  encabezados?: Record<string, string>;
  senal?: AbortSignal;
  // login, registro, refresh y logout: un 401 ahí es la respuesta, no un token vencido.
  sinRenovar?: boolean;
}

// El access token vive solo en memoria: un script inyectado no lo encuentra en localStorage.
// Al recargar la página se recupera con el refresh token, que viaja en una cookie httpOnly.
let accessToken: string | null = null;
let renovacionEnCurso: Promise<Sesion | null> | null = null;
const oyentes = new Set<(usuario: Usuario | null) => void>();

export function fijarAccessToken(token: string | null): void {
  accessToken = token;
}

export function escucharSesion(oyente: (usuario: Usuario | null) => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function avisarSesion(usuario: Usuario | null): void {
  for (const oyente of oyentes) oyente(usuario);
}

function armarUrl(ruta: string, parametros?: Parametros): string {
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') query.set(clave, String(valor));
  }
  const texto = query.toString();
  return `${BASE}${ruta}${texto ? `?${texto}` : ''}`;
}

async function enviar(ruta: string, op: Opciones, token: string | null): Promise<Response> {
  const encabezados: Record<string, string> = { Accept: 'application/json', ...op.encabezados };
  if (op.cuerpo !== undefined) encabezados['Content-Type'] = 'application/json';
  if (token) encabezados.Authorization = `Bearer ${token}`;

  try {
    return await fetch(armarUrl(ruta, op.parametros), {
      method: op.metodo ?? 'GET',
      headers: encabezados,
      body: op.cuerpo === undefined ? undefined : JSON.stringify(op.cuerpo),
      credentials: 'same-origin',
      signal: op.senal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.');
  }
}

function esCuerpoError(valor: unknown): valor is { error: { mensaje: string; detalles?: DetalleError[] } } {
  if (typeof valor !== 'object' || valor === null || !('error' in valor)) return false;
  const error = valor.error;
  return typeof error === 'object' && error !== null && 'mensaje' in error && typeof error.mensaje === 'string';
}

async function leerError(res: Response): Promise<ErrorApi> {
  try {
    const cuerpo: unknown = await res.json();
    if (esCuerpoError(cuerpo)) return new ErrorApi(res.status, cuerpo.error.mensaje, cuerpo.error.detalles ?? []);
  } catch {
    // Sin cuerpo JSON (por ejemplo, el proxy no alcanzó la API).
  }
  return new ErrorApi(res.status, res.status >= 500 ? 'El servidor tuvo un problema. Intente de nuevo.' : `Error ${res.status}`);
}

// Varias pestañas comparten la cookie: el candado hace que renueven de una en una
// y cada una envíe la cookie ya rotada por la anterior.
function conCandado<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('shopcart-renovar-sesion', fn);
  }
  return fn();
}

// Si cinco peticiones reciben 401 a la vez, todas esperan la misma renovación.
export function renovarSesion(): Promise<Sesion | null> {
  renovacionEnCurso ??= conCandado(async () => {
    const res = await enviar('/auth/refresh', { metodo: 'POST' }, null);
    if (!res.ok) {
      accessToken = null;
      avisarSesion(null);
      return null;
    }
    const sesion = (await res.json()) as Sesion;
    accessToken = sesion.accessToken;
    avisarSesion(sesion.usuario);
    return sesion;
  }).finally(() => {
    renovacionEnCurso = null;
  });
  return renovacionEnCurso;
}

export async function solicitar<T>(ruta: string, op: Opciones = {}): Promise<T> {
  const tokenUsado = accessToken;
  let res = await enviar(ruta, op, tokenUsado);

  if (res.status === 401 && tokenUsado && !op.sinRenovar) {
    // Otra petición pudo renovar mientras esta viajaba: basta con reintentar con el token nuevo.
    if (accessToken === tokenUsado) await renovarSesion();
    if (accessToken) res = await enviar(ruta, op, accessToken);
  }

  if (!res.ok) throw await leerError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
