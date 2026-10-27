// Resumen "antes → después" para confirmar cambios sensibles. `cambios`: [[campo, antes, despues]]
export function TablaCambios({ cambios }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {cambios.map(([campo, antes, despues]) => (
          <tr key={campo} className="border-b border-slate-100">
            <td className="py-1 pr-2 font-medium">{campo}</td>
            <td className="py-1 pr-2 text-slate-500 line-through">{antes}</td>
            <td className="py-1">{despues}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
