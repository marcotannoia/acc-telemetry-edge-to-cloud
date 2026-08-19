export function errorMessage(error) {
  return error instanceof Error ? error.message : 'Errore sconosciuto'
}
