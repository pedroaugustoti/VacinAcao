// Executar com o build servido localmente. Não autentica nem altera dados.
import assert from 'node:assert/strict'
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3100'
for (const [path, status, destino] of [
  ['/login', 200], ['/login-ubs', 200], ['/registro', 200], ['/manifest.webmanifest', 200],
  ['/admin', 307, '/login-ubs'], ['/admin/cadastro', 307, '/login-ubs'], ['/admin/pacientes', 307, '/login-ubs'],
  ['/admin/busca-ativa',307,'/login-ubs'],
]) {
  const response = await fetch(new URL(path, base), { redirect: 'manual' })
  assert.equal(response.status, status, path)
  if (destino) assert.equal(new URL(response.headers.get('location'), base).pathname, destino)
  await response.text()
  console.log(`PASS ${path} ${status}`)
}
