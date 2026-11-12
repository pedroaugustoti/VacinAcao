/** CPF identifica um alias previamente provisionado. Nunca serve como senha/prova de identidade. */
export function identificadorPaciente(value:string):string|null {
 const trimmed=value.trim()
 if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))return trimmed.toLowerCase()
 if(!/^[\d.\-\s]+$/.test(trimmed))return null
 const digits=trimmed.replace(/\D/g,'')
 return digits.length===11?`${digits}@paciente.vacinacao.app`:null
}
