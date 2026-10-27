import { useQuery } from '@tanstack/react-query';
import { listarPautasResumen } from './api.js';

export const usePautasResumen = () =>
  useQuery({ queryKey: ['pautas', 'resumen'], queryFn: listarPautasResumen });
