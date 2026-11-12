import 'server-only'
import {createClient as sdk} from '@supabase/supabase-js'
import {createClient} from '@/lib/supabase/server'

export async function adminContext(){
 const session=await createClient(),auth=await session.auth.getUser()
 if(auth.error||!auth.data.user)throw new Error('Sessão administrativa obrigatória.')
 const profile=await session.from('perfis').select('role').eq('id',auth.data.user.id).single()
 if(profile.error||profile.data?.role!=='admin')throw new Error('Operação permitida somente ao administrador.')
 const access=await session.rpc('va_acesso_habilitado')
 if(!access.error&&access.data!==true)throw new Error('Acesso administrativo desativado.')
 return {session,actor:auth.data.user.id,schemaReady:!access.error}
}
export function authAdmin(){
 const secret=process.env.SUPABASE_SECRET_KEY
 if(!secret||process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY||process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)throw new Error('Gestão Auth indisponível: configurar credencial somente no servidor, sem prefixo público.')
 let valid=secret.startsWith('sb_secret_')
 if(!valid){try{valid=JSON.parse(Buffer.from(secret.split('.')[1],'base64url').toString()).role==='service_role'}catch{/* falha fechada */}}
 if(!valid)throw new Error('Credencial administrativa inválida; nenhum valor foi exibido.')
 return sdk(process.env.NEXT_PUBLIC_SUPABASE_URL!,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
}
export function emailAuth(){return sdk(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{flowType:'implicit',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}
export function writeAllowed(schemaReady:boolean){if(!schemaReady||process.env.VACINACAO_GESTAO_ESCRITA!=='autorizada')throw new Error('Gestão em modo de leitura. Aprovar/aplicar 028 e autorizar as operações no servidor antes de gravar.')}
export function configured(){return Boolean(process.env.SUPABASE_SECRET_KEY)}
