export const expectedUrl='https://nfwfogaklwbrabozqjan.supabase.co'
export const accountNames=['ADMIN','UBS_A','UBS_B','PACIENTE']
export function requireValue(env,name){
 if(typeof env[name]!=='string'||!env[name].trim())throw new Error(`Configuração ausente: ${name}. Preencha somente o arquivo local ignorado pelo Git.`)
 return env[name].trim()
}
export function validateBase(env){
 const url=requireValue(env,'HOMOLOG_SUPABASE_URL').replace(/\/$/,'')
 if(url!==expectedUrl)throw new Error('Destino diferente do projeto de desenvolvimento autorizado.')
 const key=requireValue(env,'HOMOLOG_SUPABASE_ANON_KEY')
 let publicKey=/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key)
 if(!publicKey){
  try{publicKey=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon'}catch{/* rejeita sem revelar conteúdo */}
 }
 if(!publicKey)throw new Error('Somente chave pública anon/publishable é permitida; chave secreta ou administrativa rejeitada.')
 return {url,key}
}
export function accountReadiness(env){
 return accountNames.map(name=>({conta:name,emailConfigurado:Boolean(env[`HOMOLOG_${name}_EMAIL`]?.trim()),senhaConfigurada:Boolean(env[`HOMOLOG_${name}_PASSWORD`]?.trim()),autenticacao:'não testada'}))
}
