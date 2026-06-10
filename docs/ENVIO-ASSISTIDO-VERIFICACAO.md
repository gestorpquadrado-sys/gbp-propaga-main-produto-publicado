# Envio assistido e verificação online de diretórios

Este pacote adiciona quatro comportamentos ao P² Local Listings:

1. **Classificação do diretório**: email, formulário assistido, manual, API futura ou provedor.
2. **Propagação segura**: o n8n automatiza apenas o que é seguro. Formulários com login/captcha não são forçados.
3. **Tarefa assistida**: quando o diretório exige formulário/manual, a tela mostra botão para abrir o formulário e copiar os dados padronizados da empresa.
4. **Verificação online**: um workflow separado pode tentar confirmar se o perfil está online, usando `profile_url` ou `verification_url_template`.

## Ordem correta de implantação

1. Rodar a migration:
   `supabase/migrations/20260610160000_directory_submission_assisted_verification.sql`

2. Importar no n8n:
   - `n8n/buz-propaga-dinamico-assistido-verificacao.json`
   - `n8n/p2-directory-submissions-verify.json`

3. Colar a `service_role key`, sem `Bearer`, nos nós Code indicados.

4. Desativar workflows antigos com o mesmo webhook.

5. Subir o frontend novo na Vercel.

## Endpoint novo de verificação

```txt
GET /webhook/p2/directory-submissions/verify?sync_id=SYNC_ID&limit=30
```

Variável opcional na Vercel:

```env
VITE_DIRECTORY_VERIFY_ENDPOINT=https://webhook.pquadrado.com.br/webhook/p2/directory-submissions/verify
```

## Observação importante

O sistema não deve tentar burlar captcha, login, Cloudflare ou barreiras anti-bot. Esses casos são tratados como `manual_required` ou `manual_check_required`, com tarefa assistida para reduzir erro operacional.
