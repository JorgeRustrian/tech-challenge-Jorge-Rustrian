import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { esRol, type UsuarioAutenticado } from '../../tipos/auth';

export function firmarAccessToken(usuario: UsuarioAutenticado): string {
  return jwt.sign({ rol: usuario.rol }, env.JWT_ACCESS_SECRET, {
    subject: String(usuario.id),
    expiresIn: env.JWT_ACCESS_EXPIRA_MIN * 60,
    algorithm: 'HS256',
  });
}

// Lanza TokenExpiredError o JsonWebTokenError; el middleware autenticar los traduce a 401.
export function verificarAccessToken(token: string): UsuarioAutenticado {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });

  if (typeof payload === 'string' || !payload.sub || !esRol(payload.rol)) {
    throw new jwt.JsonWebTokenError('Contenido del token invalido');
  }

  return { id: Number(payload.sub), rol: payload.rol };
}

// El refresh token es aleatorio (256 bits), no un JWT. En la BD se guarda solo su SHA-256:
// con esa entropía no hace falta un hash lento como bcrypt, y permite buscarlo por índice.
export function generarRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
