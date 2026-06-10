# Ajustes aplicados — Categorias oficiais + recomendação de canais

## Frontend

- A etapa **Categorias** agora consulta o endpoint `VITE_GBP_CATEGORIES_ENDPOINT` para buscar categorias oficiais do Google Business Profile via n8n.
- Se o endpoint falhar, o sistema usa o catálogo local ampliado como fallback.
- O campo Categoria Principal atualiza automaticamente as Categorias Adicionais.
- A etapa **Canais** agora detecta o tipo de negócio com base na categoria principal e recomenda diretórios automaticamente.
- Google e Facebook continuam disponíveis, mas aparecem como **Canais Avançados** e não são selecionados automaticamente.

## Variável nova na Vercel

```env
VITE_GBP_CATEGORIES_ENDPOINT=https://webhook.pquadrado.com.br/webhook/p2/google-categories/list
```

## n8n

Importe o arquivo:

```txt
n8n/p2-google-categories-list.json
```

O webhook criado usa:

```txt
GET /webhook/p2/google-categories/list
```

Parâmetros aceitos:

```txt
query
regionCode=BR
languageCode=pt-BR
limit=100
pageToken
```

Exemplo:

```txt
https://webhook.pquadrado.com.br/webhook/p2/google-categories/list?query=restaurant&regionCode=BR&languageCode=pt-BR
```

## Credencial necessária

Use a credencial Google Business Profile já usada nos outros workflows. Ela precisa ter o escopo:

```txt
https://www.googleapis.com/auth/business.manage
```
