import {NextResponse,type NextRequest} from 'next/server'
import {createClient} from '@/lib/supabase/server'

export async function GET(request:NextRequest){
 const redirectLocal=(path:string)=>new NextResponse(null,{status:303,headers:{Location:path,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})
 const token=request.nextUrl.searchParams.get('token_hash'),type=request.nextUrl.searchParams.get('type')
 if(!token||token.length>1000||!['recovery','invite'].includes(type||''))return redirectLocal('/registro?acesso=link-invalido')
 const s=await createClient(),result=await s.auth.verifyOtp({token_hash:token,type:type as 'recovery'|'invite'})
 return redirectLocal(result.error?'/registro?acesso=link-invalido':'/definir-senha')
}
