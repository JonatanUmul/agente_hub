import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authRepo from '../auth/auth.repository.js';
import * as repo from './usuarios.repository.js';
import { crearUsuario, editarUsuario } from './usuarios.service.js';

vi.mock('./usuarios.repository.js');
vi.mock('../auth/auth.repository.js');

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };
const admin = { id: 1, rol: 'admin', activo: true };

beforeEach(() => {
  vi.resetAllMocks();
  repo.actualizar.mockImplementation(async (_db, id, cambios) => ({ ...admin, id, ...cambios }));
});

describe('editarUsuario', () => {
  it('impide quitar el rol al último admin activo', async () => {
    repo.obtenerPorId.mockResolvedValue(admin);
    repo.idsAdminsActivosBloqueando.mockResolvedValue([1]);
    await expect(
      editarUsuario(db, { id: 1, cambios: { rol: 'lectura' }, actorId: 2 }),
    ).rejects.toMatchObject({ codigo: 'ULTIMO_ADMIN', estadoHttp: 409 });
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('permite quitar el rol si queda otro admin', async () => {
    repo.obtenerPorId.mockResolvedValue(admin);
    repo.idsAdminsActivosBloqueando.mockResolvedValue([1, 3]);
    await editarUsuario(db, { id: 1, cambios: { rol: 'lectura' }, actorId: 3 });
    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('no consulta admins si el cambio no afecta al rol admin', async () => {
    repo.obtenerPorId.mockResolvedValue(admin);
    await editarUsuario(db, { id: 1, cambios: { nombre: 'Nuevo' }, actorId: 1 });
    expect(repo.idsAdminsActivosBloqueando).not.toHaveBeenCalled();
  });

  it('impide que alguien se desactive a sí mismo', async () => {
    await expect(
      editarUsuario(db, { id: 1, cambios: { activo: false }, actorId: 1 }),
    ).rejects.toMatchObject({ codigo: 'NO_AUTODESACTIVAR' });
  });

  it('al desactivar, cierra las sesiones del usuario', async () => {
    repo.obtenerPorId.mockResolvedValue({ id: 5, rol: 'comercial', activo: true });
    await editarUsuario(db, { id: 5, cambios: { activo: false }, actorId: 1 });
    expect(authRepo.eliminarSesionesDeUsuario).toHaveBeenCalledWith(expect.anything(), 5);
  });

  it('responde 404 si el usuario no existe', async () => {
    repo.obtenerPorId.mockResolvedValue(null);
    await expect(
      editarUsuario(db, { id: 9, cambios: { nombre: 'X' }, actorId: 1 }),
    ).rejects.toMatchObject({ estadoHttp: 404 });
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
    repo.insertar.mockResolvedValue({});
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
