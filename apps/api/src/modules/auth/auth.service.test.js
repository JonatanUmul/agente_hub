import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashContrasena } from '../../lib/contrasenas.js';
import { configPrueba } from '../../../test/helpers.js';
import * as repo from './auth.repository.js';
import { iniciarSesion } from './auth.service.js';

vi.mock('./auth.repository.js');

// withTransaction necesita un pool con connect(); el cliente no hace nada porque el repo está simulado.
const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };
const CONTRASENA = 'una-contrasena-larga';
let hash;

beforeEach(async () => {
  vi.resetAllMocks();
  hash ??= await hashContrasena(CONTRASENA);
  repo.buscarSesionVigente.mockResolvedValue({
    usuario: { id: 1, correo: 'ana@ejemplo.com', nombre: 'Ana', rol: 'admin' },
    csrfToken: 'csrf',
  });
});

const usuario = (extra = {}) => ({
  id: 1,
  hash_contrasena: hash,
  activo: true,
  bloqueado: false,
  ...extra,
});
const login = (contrasena = CONTRASENA) =>
  iniciarSesion(db, configPrueba, { correo: 'ana@ejemplo.com', contrasena });

describe('iniciarSesion', () => {
  it('crea la sesión y reinicia los intentos con la contraseña correcta', async () => {
    repo.buscarParaLogin.mockResolvedValue(usuario());
    const resultado = await login();

    expect(resultado.token).toMatch(/^[\w-]{43}$/);
    expect(repo.registrarAccesoExitoso).toHaveBeenCalled();
    // En la base se guarda el hash del token, nunca el token.
    const { tokenHash } = repo.crearSesion.mock.calls[0][1];
    expect(tokenHash).not.toBe(resultado.token);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('registra el intento fallido con los límites configurados', async () => {
    repo.buscarParaLogin.mockResolvedValue(usuario());
    await expect(login('incorrecta')).rejects.toMatchObject({ codigo: 'CREDENCIALES_INVALIDAS' });
    expect(repo.registrarIntentoFallido).toHaveBeenCalledWith(db, 1, {
      maxIntentos: configPrueba.LOGIN_MAX_INTENTOS,
      minutosBloqueo: configPrueba.LOGIN_BLOQUEO_MINUTOS,
    });
    expect(repo.crearSesion).not.toHaveBeenCalled();
  });

  it('rechaza una cuenta bloqueada aunque la contraseña sea correcta', async () => {
    repo.buscarParaLogin.mockResolvedValue(usuario({ bloqueado: true }));
    await expect(login()).rejects.toMatchObject({ codigo: 'CREDENCIALES_INVALIDAS' });
    expect(repo.crearSesion).not.toHaveBeenCalled();
  });

  it('rechaza una cuenta inactiva', async () => {
    repo.buscarParaLogin.mockResolvedValue(usuario({ activo: false }));
    await expect(login()).rejects.toMatchObject({ codigo: 'CREDENCIALES_INVALIDAS' });
  });

  it('responde igual si el correo no existe', async () => {
    repo.buscarParaLogin.mockResolvedValue(null);
    await expect(login()).rejects.toMatchObject({
      codigo: 'CREDENCIALES_INVALIDAS',
      estadoHttp: 401,
    });
    expect(repo.registrarIntentoFallido).not.toHaveBeenCalled();
  });
});
