O Manifesto do Framework Norte

1. A Filosofia: O Framework de Lógica de Negócio

Norte não é um framework HTTP; é um framework de lógica de negócio que usa HTTP como um detalhe de implementação. A sua filosofia opinativa foca-se em eliminar o boilerplate para que os programadores se concentrem apenas no que agrega valor.

Princípios Fundamentais

Simplicidade Opinativa ("A Única Forma"): Oferece uma única forma correta de fazer as coisas, garantindo consistência e zero ambiguidade.

Performance por Compilação Estática: Move o máximo de trabalho (validação, roteamento) do tempo de execução para o tempo de inicialização, executando apenas uma vez.

Abstração Total do Protocolo (SoC): Impõe uma separação pura: Hooks (before/after) gerem o Protocolo (HTTP), enquanto os Handlers (.create, .list) gerem a Lógica de Negócio (dados puros).

Portabilidade Universal (WinterCG): O núcleo agnóstico (app.fetch) roda em qualquer plataforma (Bun, Node.js, Cloudflare Workers, Vercel).

Ecossistema de Ponta-a-Ponta: O backend gera um contrato OpenAPI "inteligente" que a CLI do Norte compila em hooks de frontend otimizados (ex: TanStack Query).

2. A Arquitetura: Compilação em 3 Fases

A arquitetura do Norte é um "compilador" que opera em três fases:

Definição (Runtime): Armazena definições de rotas (new Router(...)) e schemas.

Compilação (Inicialização): Pré-compila schemas (via AJV), "achata" (inlines) a cadeia before -> handle -> after em funções otimizadas, constrói a árvore de roteamento e gera o OpenAPI "inteligente".

Execução (Runtime): Expõe um único handler app.fetch (WinterCG) que executa diretamente as funções otimizadas, com overhead quase zero.

3. Lista de Features (O Essencial)

Grupo 1: Arquitetura e Performance

Compilação Estática: Move o trabalho de "descoberta" de rota e validação para a inicialização, uma única vez.

Portabilidade (WinterCG): Núcleo agnóstico app.fetch compete com Hono, rodando em qualquer plataforma.

Validação Pré-Compilada: Gera funções de validação JIT na inicialização, eliminando o overhead do zod.parse() em runtime.

Grupo 2: API de Servidor (DX)

API Focada em Domínio: new Router('dominio', ...) agrupa a lógica e melhora a coesão.

Roteamento CRUD Abstraído: Métodos (.list, .create) geram rotas RESTful para focar na lógica de negócio.

Roteamento Aninhado: new Router(parent, ...) compõe paths e parâmetros (/stores/:storeId/products) de forma segura.

Versionamento Nativo: version: 2 no Router (padrão 1) gera paths /v[numero]/ automaticamente, forçando consistência.

Respostas "Payload-First": Handlers retornam apenas dados. O Norte aplica o status HTTP semântico (ex: 201 para .create).

Escape Hatch .custom(): Para casos não-JSON (CSV, etc.), permite retornar um objeto Response completo.

Grupo 3: Ciclo de Vida & Contexto (SoC)

Hooks (beforeHandle/afterHandle): Substituem middlewares (next()) por um ciclo de vida (before -> handle -> after) explícito.

Componibilidade de Hooks: São sempre passados como arrays ([hook1]) para consistência.

Hooks em Duplo Escopo: Podem ser definidos no Roteador (para todos os métodos) ou num Método específico.

Separação Pura de Camadas: Hooks (Protocolo) acedem a request/response. Handlers (Negócio) recebem apenas dados validados (body, param, query, store).

Contexto de Negócio (store): O beforeHandle traduz o protocolo (ex: header Authorization) para o store (ex: store.user), que o handler consome de forma segura.

Erros Estruturados: Handlers lançam throw new NorteError('NOT_FOUND'); O Norte faz o try...catch e o traduz para o status HTTP (ex: 404).

Grupo 4: Ecossistema & Observabilidade

OpenAPI "Inteligente": O backend gera um OpenAPI com hints (ex: x-norte-invalidates) que o cliente Norte utiliza.

Cliente Type-Safe: A CLI (norte client generate) "compila" o OpenAPI "inteligente" num cliente de frontend 100% tipado e desacoplado.

Adaptador TanStack Query: O cliente gerado cria hooks (ex: useUserCreate) com invalidação de cache automática, lendo os hints do OpenAPI.

Log Estruturado: Injeta um logger (log) com requestId em todos os hooks e handlers.

Observabilidade (OTel) Nativa: Se telemetry for configurado, o Norte "sintoniza" o ecossistema: o log ganha trace_id e o cliente injeta traceparent automaticamente.

4. A API na Prática: Casos de Uso

Cenário 1: Fluxo Completo (Hooks + Handler)

Objetivo: POST /v1/articles (Auth + Validação + Header Customizado).
O beforeHandle valida o token e coloca store.user. O handler (puro) usa body e store.user para criar o artigo e retorna os dados. O afterHandle lê o resultado e define o header X-Article-ID.

// (Assumindo que 'checkAuth' é um hook definido em outro lugar)
const logAndSetHeader = async ({ result, headers }) => {
  if (!(result instanceof NorteError)) {
    headers.set('X-Article-ID', result.id);
  }
};
const articleRouter = new Router('articles', { 
  version: 1,
  beforeHandle: [checkAuth],
  afterHandle: [logAndSetHeader]
});

articleRouter.create(
  { body: z.object({ title: z.string() }) },
  async ({ body, store, log }) => {
    const article = await db.article.create({
      title: body.title,
      authorId: store.user.id // 'store.user' veio do hook
    });
    return article; // Retorna apenas dados
  }
);


Cenário 2: Um Hook + Handler

Objetivo: GET /v1/users/:userId (Auth + Validação de Param + Permissão).
O beforeHandle valida o token. O handler valida o param, verifica se store.user.id === param.userId, e lança throw new NorteError('FORBIDDEN') se não tiver permissão.

const userRouter = new Router('users', { 
  version: 1,
  beforeHandle: [checkAuth]
});

userRouter.read(
  { param: z.object({ userId: z.string().cuid() }) },
  async ({ param, store, log }) => {
    if (store.user.id !== param.userId) {
      throw new NorteError('FORBIDDEN', 'Sem permissão');
    }
    const user = await db.user.findUnique({ id: param.userId });
    if (!user) {
      throw new NorteError('NOT_FOUND', 'Usuário não encontrado');
    }
    return user; // Retorna apenas dados
  }
);


Cenário 3: Apenas o Handler (Rota Pública)

Objetivo: GET /v1/categories (Validação de Query).
Nenhum hook é necessário. O handler recebe o query já validado e com valores padrão.

const categoryRouter = new Router('categories', { version: 1 });

categoryRouter.list(
  { query: z.object({ limit: z.coerce.number().default(20) }) },
  async ({ query, log }) => {
    log.info({ limit: query.limit }, 'Buscando categorias');
    const categories = await db.category.findMany({
      take: query.limit
    });
    return categories; // Retorna apenas dados
  }
);


Cenário 4: Recebimento de Webhook

Objetivo: POST /v1/webhooks/github.
Usamos .custom() para lidar com a resposta ack e beforeHandle para validar a assinatura, que requer o body bruto (não-JSON).

const validateGithubSignature = async ({ request, error }) => {
  const signature = request.headers.get('X-Hub-Signature-256');
  const body = await request.clone().text(); // Acesso ao body bruto
  if (!isValid(signature, body)) {
    return error('FORBIDDEN', 'Assinatura inválida');
  }
};

const webhookRouter = new Router('webhooks', { version: 1 });

webhookRouter.custom(
  'POST',
  '/github',
  {
    beforeHandle: [validateGithubSignature],
    handler: async ({ log, request }) => {
      // O 'beforeHandle' já validou.
      // Agora podemos processar o body (request.json()) e
      // enfileirar um job.
      log.info('Webhook recebido e validado');
      // Acknowledgment (confirmação)
      return new Response(null, { status: 202 }); 
    }
  }
);


Cenário 5: Comunicação Real-time (WebSockets)

Objetivo: GET /v1/chat.
O Norte pode expor um método .websocket() (nome TBD) que lida com o upgrade do HTTP. O beforeHandle é crucial para autenticar o usuário antes do upgrade, passando o store.user para o contexto do socket.

// (API Hipotética)
const chatRouter = new Router('chat', { version: 1 });

chatRouter.websocket(
  '/room',
  {
    beforeHandle: [checkAuth], // Autentica o 'request' HTTP
    
    // O 'store' (com 'store.user') é passado para o contexto do socket
    open(ws, store) {
      ws.subscribe('general');
      ws.send(`Bem-vindo, ${store.user.name}!`);
    },
    message(ws, message) {
      // ...
    }
  }
);


Cenário 6: IoT e Mensageria (MQTT/TCP)

Objetivo: Lidar com protocolos não-HTTP.
Embora o núcleo do Norte seja WinterCG (HTTP), a sua arquitetura de "compilação" (validação, logging, telemetria) pode ser aplicada a outros protocolos de transporte através de adaptadores de runtime (ex: Bun.listen({ socket: ... }) para TCP ou um broker MQTT). O Norte forneceria o contexto (log, store) para os handlers de eventos (onData, onMessage).

Cenário 7: Backend de IA (Serviço Puro)

Objetivo: POST /v1/ai/generate.
Este é um caso de uso perfeito para o handler puro do Norte. A telemetria (#20) é vital aqui para rastrear a latência da chamada de API externa.

const aiRouter = new Router('ai', { version: 1 });

aiRouter.create(
  { body: z.object({ prompt: z.string().min(10) }) },
  async ({ body, log, store }) => {
    log.info('Chamando API externa de IA...');
    
    // A Feature #20 (OTel) cria automaticamente um 'span'
    // para esta chamada 'fetch', ligando-a ao trace principal.
    const response = await gemini.generateContent(body.prompt);
    
    return { text: response.text() }; // Retorna apenas dados
  }
);
