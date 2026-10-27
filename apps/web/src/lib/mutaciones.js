import { useMutation, useQueryClient } from '@tanstack/react-query';

// Mutación que, al terminar (bien o con error, p. ej. un 409), recarga las consultas indicadas:
// la API es la fuente de verdad y otra persona pudo haber cambiado algo.
export function useMutacionQueRecarga(mutationFn, claves) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all(claves.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}
