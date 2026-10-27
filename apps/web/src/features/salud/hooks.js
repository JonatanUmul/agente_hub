import { useQuery } from '@tanstack/react-query';
import { obtenerSalud } from './api.js';

export const useSalud = () =>
  useQuery({ queryKey: ['salud'], queryFn: obtenerSalud, refetchInterval: 15_000 });
