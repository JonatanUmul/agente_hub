import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearAppPrueba } from '../../../test/helpers.js';
import { obtenerSesion } from '../auth/auth.service.js';
import * as repo from './saludos.repository.js';
import { crearSaludo, simularSaludo } from './saludos.service.js';

vi.mock('./saludos.repository.js');
vi.mock('../auth/auth.service.js', async (original) => ({
  ...(await original()),
  obtenerSesion: vi.fn(),
}));

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };
const saludo = (id, nombre, extra = {}) => ({
  id,
  nombre,
  modulo: 'GLOBAL',
  saludo: `¡{momento}! ${nombre}`,
  fechaInicio: null,
  fechaFin: null,
  repetirAnual: false,
  prioridad: 0,
  activo: true,
  ...extra,
});

let app;
beforeEach(() => vi.resetAllMocks());
afterEach(() => app?.close());

describe('servicio de saludos', () => {
  it('traduce un nombre repetido a 409', async () => {
    repo.insertar.mockRejectedValue(Object.assign(new Error('unique'), { code: '23505' }));
    await expect(
      crearSaludo(db, { datos: saludo(0, 'Normal'), correo: 'a@e.com' }),
    ).rejects.toMatchObject({
      codigo: 'NOMBRE_EN_USO',
      estadoHttp: 409,
    });
  });

  it('simula resolviendo {momento} y devuelve todos los candidatos si empatan', async () => {
    repo.listar.mockResolvedValue([saludo(1, 'Uno'), saludo(2, 'Dos')]);
    const r = await simularSaludo(db, { modulo: 'MENU', fecha: '2026-05-01', hora: '20:00' });
    expect(r.saludo).toBeNull();
    expect(r.candidatos.map((c) => c.saludo)).toEqual([
      '¡Buenas noches! Uno',
      '¡Buenas noches! Dos',
    ]);
  });

  it('crear avisa de choques sin bloquear', async () => {
    const nuevo = saludo(3, 'Navidad 2', {
      fechaInicio: '2026-12-20',
      fechaFin: '2026-12-21',
      prioridad: 10,
    });
    const navidad = saludo(4, 'Navidad', {
      fechaInicio: '2026-12-15',
      fechaFin: '2026-12-26',
      repetirAnual: true,
      prioridad: 10,
    });
    repo.insertar.mockResolvedValue(3);
    repo.obtenerPorId.mockResolvedValue(nuevo);
    repo.listar.mockResolvedValue([nuevo, navidad]);
    const r = await crearSaludo(db, { datos: nuevo, correo: 'a@e.com' });
    expect(r.choques).toEqual([{ id: 4, nombre: 'Navidad' }]);
  });
});

describe('rutas de saludos', () => {
  const pedir = (rol, opciones) => {
    obtenerSesion.mockResolvedValue({
      usuario: { id: 1, correo: 'a@e.com', nombre: 'A', rol },
      csrfToken: 't',
    });
    return app.inject({
      cookies: { eco_sesion: 'abc' },
      headers: { 'x-csrf-token': 't' },
      ...opciones,
    });
  };
  const crear = (rol, cambio = {}) =>
    pedir(rol, {
      method: 'POST',
      url: '/api/saludos',
      payload: { ...saludo(0, 'Normal'), id: undefined, ...cambio },
    });

  it.each([
    ['comodín desconocido', { saludo: 'Hola {cliente}' }],
    ['solo una fecha', { fechaInicio: '2026-12-15' }],
    ['fin antes del inicio', { fechaInicio: '2026-12-15', fechaFin: '2026-12-01' }],
  ])('rechaza %s', async (_caso, cambio) => {
    app = await crearAppPrueba();
    expect((await crear('admin', cambio)).statusCode).toBe(400);
  });

  it('el rol comercial no puede crear saludos', async () => {
    app = await crearAppPrueba();
    expect((await crear('comercial')).statusCode).toBe(403);
  });

  it('valida la hora del simulador', async () => {
    app = await crearAppPrueba();
    const res = await pedir('lectura', {
      method: 'GET',
      url: '/api/saludos/simular?modulo=MENU&fecha=2026-12-24&hora=25:00',
    });
    expect(res.statusCode).toBe(400);
  });
});
