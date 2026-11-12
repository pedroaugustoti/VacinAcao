import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

export default function OrientacoesAcesso() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <ShieldCheck className="mb-4 text-teal-700" size={32}/>
        <h1 className="text-2xl font-bold text-slate-900">Primeiro acesso ao VacinAção</h1>
        <p className="mt-3 text-slate-600">Para proteger seus dados de saúde, a ativação da conta deve ser confirmada pela unidade de saúde responsável pelo seu atendimento.</p>
        <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-700"><li>Procure a UBS responsável para conferir sua identidade e solicitar uma conta individual.</li><li>A equipe confirma o cadastro e informa o e-mail de acesso. CPF só funciona quando um alias foi previamente configurado.</li><li>Entre com esse identificador e sua senha pessoal. Nunca use CPF ou data de nascimento como senha.</li></ol>
        <section id="recuperar" className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-5"><h2 className="font-semibold text-sky-950">Esqueci minha senha</h2><p className="mt-2 text-sm leading-relaxed text-slate-700">Solicite a recuperação à UBS, que deve conferir sua identidade antes de orientar a redefinição. Não informe sua senha à equipe e não a envie por mensagem.</p><p className="mt-3 text-sm leading-relaxed text-slate-700">Se seu acesso usa um alias de CPF, ele não é uma caixa de e-mail. A recuperação precisa ser assistida pela equipe. Esta página não envia e-mails, SMS ou WhatsApp.</p></section>
        <section className="mt-5 text-sm leading-relaxed text-slate-600"><h2 className="font-semibold text-slate-800">Entrei, mas não vejo minhas doses</h2><p className="mt-2">A conta pode ainda não estar vinculada ao seu cadastro. Procure a UBS; não crie outra conta para tentar localizar informações pelo CPF.</p><p className="mt-3">Se o link de ativação ou recuperação expirou ou não abriu, solicite nova orientação à equipe. Links pessoais não devem ser compartilhados.</p></section>
        <Link href="/login" className="mt-6 inline-flex rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800">Voltar ao login</Link>
      </section>
    </main>
  )
}
