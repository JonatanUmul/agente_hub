export function MensajeError({ error }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-peligro/30 bg-peligro/10 px-3 py-2 text-sm text-peligro"
    >
      {error.message}
    </p>
  );
}
