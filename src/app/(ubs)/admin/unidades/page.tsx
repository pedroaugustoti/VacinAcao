import ManagementPage from '@/components/management/ManagementPage'
import {Suspense} from 'react'
import {connection} from 'next/server'
import {adminContext} from '@/lib/management-server'
import {redirect} from 'next/navigation'
import PageLoading from '@/components/ui/PageLoading'
async function Content(){await connection();try{await adminContext()}catch{redirect('/admin')}return <ManagementPage kind="unidades"/>}
export default function UnidadesPage(){return <Suspense fallback={<PageLoading label="Carregando unidades…"/>}><Content/></Suspense>}
