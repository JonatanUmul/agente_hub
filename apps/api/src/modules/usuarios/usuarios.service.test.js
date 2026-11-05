import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as accesosRepo from '../accesos/accesos.repository.js';
import * as authRepo from '../auth/auth.repository.js';
import * as repo from './usuarios.repository.js';
import { cerrarSesiones, crearUsuario, editarUsuario } from './usuarios.service.js';

vi.mock('./usuarios.repository.js');
vi.mock('../auth/auth.repository.js');
vi.mock('../accesos/accesos.repository.js');

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };
const admin = { id: 1, correo: 'admin@eco.com', nombre: 'Admin', rol: 'admin', activo: true };
const actor = (id) => ({ id, correo: `actor${id}@eco.com`, ip: '10.0.0.1' });

beforeEach(() => {
  vi.resetAllMocks();
  repo.actualizar.mockImplementation(async (_db, id, cambios) => ({ ...admin, id, ...cambios }));
});

describe('editarUsuario', () => {
  it('impide quitar el rol al último admin activo', async () => {
    repo.obtenerPorId.mockResolvedValue(admin);
    repo.idsAdminsActivosBloqueando.mockResolvedValue([1]);
    await expect(
      editarUsuario(db, { id: 1, cambios: { rol: 'lectura' }, actor: actor(2) }),
    ).rejects.toMatchObject({ codigo: 'ULTIMO_ADMIN', estadoHttp: 409 });
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('permite quitar el rol si queda otro admin', async () => {
    repo.obtenerPorId.mockResolvedValue(admin);
    repo.idsAdminsActivosBloqueando.mockResolvedValue([1, 3]);
    await editarUsuario(db, { id: 1, cambios: { rol: 'lectura' }, actor: actor(3) });
    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('no consulta admins si el cambio no afecta al rol admin', async () => {
    repo.obtenerPorId.mockResolvedValue(admin);
    await editarUsuario(db, { id: 1, cambios: { nombre: 'Nuevo' }, actor: actor(1) });
    expect(repo.idsAdminsActivosBloqueando).not.toHaveBeenCalled();
  });

  it('impide que alguien se desactive a sí mismo', async () => {
    await expect(
      editarUsuario(db, { id: 1, cambios: { activo: false }, actor: actor(1) }),
    ).rejects.toMatchObject({ codigo: 'NO_AUTODESACTIVAR' });
  });

  it('al desactivar, cierra las sesiones del usuario y lo anota', async () => {
    repo.obtenerPorId.mockResolvedValue({
      id: 5,
      correo: 'c@eco.com',
      rol: 'comercial',
      activo: true,
    });
    await editarUsuario(db, { id: 5, cambios: { activo: false }, actor: actor(1) });
    expect(authRepo.eliminarSesionesDeUsuario).toHaveBeenCalledWith(expect.anything(), 5, {
      motivo: 'desactivado',
    });
    expect(accesosRepo.registrarEvento).toHaveBeenCalledWith(expect.anything(), {
      usuarioId: 5,
      correo: 'c@eco.com',
      evento: 'desactivado',
      detalle: undefined,
      hechoPor: 'actor1@eco.com',
      ip: '10.0.0.1',
    });
  });

  it('anota solo los datos que cambiaron, con antes y después', async () => {
    repo.obtenerPorId.mockResolvedValue(admin);
    repo.idsAdminsActivosBloqueando.mockResolvedValue([1, 3]);
    await editarUsuario(db, {
      id: 1,
      cambios: { nombre: 'Admin', rol: 'lectura' },
      actor: actor(3),
    });
    expect(accesosRepo.registrarEvento).toHaveBeenCalledTimes(1);
    expect(accesosRepo.registrarEvento.mock.calls[0][1]).toMatchObject({
      evento: 'editado',
      detalle: { rol: { antes: 'admin', despues: 'lectura' } },
    });
  });

  it('guardar sin cambios no anota nada', async () => {
    repo.obtenerPorId.mockResolvedValue(admin);
    await editarUsuario(db, { id: 1, cambios: { nombre: 'Admin' }, actor: actor(1) });
    expect(accesosRepo.registrarEvento).not.toHaveBeenCalled();
  });

  it('responde 404 si el usuario no existe', async () => {
    repo.obtenerPorId.mockResolvedValue(null);
    await expect(
      editarUsuario(db, { id: 9, cambios: { nombre: 'X' }, actor: actor(1) }),
    ).rejects.toMatchObject({ estadoHttp: 404 });
  });
});

describe('cerrarSesiones', () => {
  it('cierra las sesiones con motivo de admin y lo anota', async () => {
    repo.obtenerPorId.mockResolvedValue({ id: 5, correo: 'c@eco.com' });
    await cerrarSesiones(db, { id: 5, actor: actor(1) });
    expect(authRepo.eliminarSesionesDeUsuario).toHaveBeenCalledWith(expect.anything(), 5, {
      motivo: 'cerrada_por_admin',
    });
    expect(accesosRepo.registrarEvento.mock.calls[0][1].evento).toBe('sesiones_cerradas');
  });
});

describe('crearUsuario', () => {
  it('traduce el correo duplicado a 409 CORREO_EN_USO', async () => {
    repo.insertar.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(
      crearUsuario(db, {
        correo: 'a@b.com',
        nombre: 'A',
        rol: 'lectura',
        contrasena: 'x'.repeat(12),
      }),
    ).rejects.toMatchObject({ codigo: 'CORREO_EN_USO', estadoHttp: 409 });
  });

  it('guarda un hash argon2id, nunca la contraseña', async () => {
    repo.insertar.mockResolvedValue({ id: 7, correo: 'a@b.com' });
    await crearUsuario(db, {
      correo: 'a@b.com',
      nombre: 'A',
      rol: 'lectura',
      contrasena: 'secreta-muy-larga',
    });
    const { hashContrasena } = repo.insertar.mock.calls[0][1];
    expect(hashContrasena).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(repo.insertar.mock.calls)).not.toContain('secreta-muy-larga');
  });
});
