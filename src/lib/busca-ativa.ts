export const canaisContato = { whatsapp:'WhatsApp manual', telefone:'Telefone', presencial:'Presencial', sms:'SMS manual', outro:'Outro' } as const
export const resultadosContato = { sem_resposta:'Sem resposta', orientado:'Orientado', retorno_agendado:'Retorno agendado', recusa:'Recusa', telefone_invalido:'Telefone inválido' } as const
export type FilaBuscaAtiva = {
 paciente_id:string; nome:string; whatsapp:string|null; unidade_id:string; esquema_id:string;
 numero_dose:number; data_prevista:string; dias_atraso:number; doses_atrasadas:number;
 total_pacientes:number; ultimo_contato:string|null; ultimo_resultado:keyof typeof resultadosContato|null;
 proximo_acompanhamento:string|null; responsavel_nome:string|null
}
export type Contato = {
 id:string; paciente_id:string; esquema_id:string|null; responsavel_nome:string;
 canal:keyof typeof canaisContato; resultado:keyof typeof resultadosContato; observacoes:string|null;
 realizado_em:string; proximo_acompanhamento:string|null; contexto:'demonstracao'
}
export function linkWhatsApp(numero:string|null):string|null {
 let digits=(numero||'').replace(/\D/g,'')
 if (digits.length===10 || digits.length===11) digits='55'+digits
 if(!/^55\d{10,11}$/.test(digits) || /^(\d)\1+$/.test(digits.slice(2))) return null
 const mensagem='Olá! Somos da sua unidade de saúde. Gostaríamos de conversar sobre seu acompanhamento. Entre em contato com a unidade para orientações.'
 return `https://wa.me/${digits}?text=${encodeURIComponent(mensagem)}`
}
export function estadoRetorno(data:string|null,hoje:string) {
 if(!data)return 'sem_retorno'
 return data<hoje?'vencido':data===hoje?'hoje':'agendado'
}
export function hojeBrasil() {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]))
 return `${p.year}-${p.month}-${p.day}`
}
