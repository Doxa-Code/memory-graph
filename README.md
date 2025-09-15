# Memory Graph

## Fluxo

- Ingestão
- Search

## Requisitos funcionais

- [ ] Tratar e salvar episodes
- [ ] Retrieve Context

## Tarefas

- [ ] Rever os schemas

## Schemas

- Episodes
  - Source
  - Group Id

## Glossário

- **Episodes**
  Episodes são os registros episódicos que representam unidades discretas de conteúdo ingerido no grafo (por exemplo: uma mensagem, um e-mail, um documento ou qualquer evento textual). Funções principais:

  Estrutura/atributos típicos:

  uuid: identificador único do episódio.
  name: título/nome do episódio (é fornecido pelo chamador da API ao criar o episódio).
  content: texto completo do episódio (pode ser omitido se store_raw_episode_content = False).
  source (EpisodeType): tipo/origem (ex.: message, text) — útil para filtragem e regras de processamento.
  source_description: descrição humana da origem (ex.: "Slack #general — alice", URL, etc.).
  group_id: partição/grupo do grafo.
  created_at / valid_at: timestamps para ordenação e relevância temporal.
  entity_edges: lista de arestas (fatos) extraídas que ligam entidades ao episódio.
  Para que servem:

  Contexto temporal e histórico: permitem recuperar contexto recente (retrieve_episodes) para extração e busca.
  Fonte de extração: entidades e arestas são extraídas do conteúdo de cada episódio.
  Indexação e busca: episódios servem como origem das arestas/nós usados em buscas e reranking.
  Auditoria e UI: armazenam metadados legíveis (source_description) para exibição e rastreabilidade.

- **Source/source_description**
  Source e source_description representam metadados do episódio (EpisodicNode):
  source (EpisodeType): enum que indica o tipo/origem do episódio (por ex. message, text, email). É usado para categorizar/filtrar episódios ao recuperar contexto e pode influenciar regras de extração/relevância.
  source_description (string): descrição humana da origem — por ex. "Slack #general — user: alice", "Email from bob@example.com", URL, ou nome do dataset. Serve como contexto adicional para o LLM, para auditoria e para exibição, e é salvo no nó do episódio.
  Observações:

  source ajuda em consultas/filtragens (ex.: retrieve_episodes por source).
  source_description é preservado mesmo quando store_raw_episode_content está desligado (somente episode.content pode ser esvaziado).

- **group_id**
  Id da partição do grafo que o episódio faz parte, podemos usar o numero de telefone do cliente para isso.
