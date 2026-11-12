/** Valida a estrutura das datas; a adequação clínica exige validação profissional. */
// Limite técnico confirmado pela constraint remota numero_dose <= 5, não protocolo.
export const MAX_DOSES = 5

export function validarDatas(datas: string[]): boolean {
  return datas.length > 0 && datas.length <= MAX_DOSES && datas.every((data, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
    const instante = new Date(`${data}T12:00:00Z`)
    return Number.isFinite(instante.getTime()) && instante.toISOString().slice(0, 10) === data && (i === 0 || data > datas[i - 1])
  })
}

export function calcularDatas(base: string, texto: string): string[] {
  const itens = texto.split(',').map(v => v.trim())
  const intervalos = itens.map(Number)
  if (!validarDatas([base]) || itens.some(v => !/^\d+$/.test(v)) || intervalos.length > MAX_DOSES || intervalos[0] !== 0 || intervalos.some((v, i) => !Number.isInteger(v) || v < 0 || v > 3650 || (i > 0 && v <= intervalos[i - 1]))) {
    throw new Error('Informe a primeira data e intervalos inteiros crescentes, começando em 0, separados por vírgulas. O banco atual suporta até 5 doses; intervalos limitados a 3650 dias.')
  }
  const datas = intervalos.map(dias => {
    const data = new Date(`${base}T12:00:00Z`)
    data.setUTCDate(data.getUTCDate() + dias)
    return data.toISOString().slice(0, 10)
  })
  if (!validarDatas(datas)) throw new Error('As datas calculadas excedem o intervalo permitido.')
  return datas
}
