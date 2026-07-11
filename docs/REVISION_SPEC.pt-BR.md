# Especificação de revisão completa do aplicativo

> Documento de referência para a revisão de ponta a ponta solicitada em 2026-07-10.
> Mantido como checklist vivo enquanto a implementação avança (ver `IMPLEMENTATION_STATUS.md`).

Revise e corrija o aplicativo inteiro com base nas instruções abaixo. Não entregue apenas uma análise ou plano: implemente as mudanças de ponta a ponta, conecte tudo ao fluxo real da aplicação, execute os testes e só finalize quando o sistema estiver funcionando.

A prioridade é eliminar funcionalidades isoladas que foram criadas, mas não participam da análise principal. Antes de alterar qualquer coisa, leia o código atual, os arquivos da pasta `/docs` e o histórico disponível para entender o que já foi implementado. Preserve funcionalidades existentes que estejam corretas, remova código legado somente quando ele deixar de ser necessário e evite comentários desnecessários.

## 1. Integrar o novo motor de mercado ao `/api/analyze`

O endpoint principal ainda utiliza `fetchOfficialListings()` e `estimatePrice()` do sistema antigo em `backend/src/app.ts`.

Substitua esse fluxo pela integração real dos módulos:

* `officialTradeMarketProvider.ts`
* `marketSearchStrategies.ts`
* `marketValuationEngine.ts`

O botão **Analyze market value** deve usar exclusivamente o novo pipeline de mercado.

O fluxo precisa ser:

Item normalizado
→ definição dos stats relevantes para a build e o slot
→ execução das estratégias de busca
→ coleta e normalização dos anúncios
→ remoção de comparáveis inválidos
→ cálculo de similaridade
→ detecção de outliers e possíveis price fixes
→ estimativa de preço
→ confiança e explicação do resultado

As estratégias devem tentar progressivamente:

* correspondência exata;
* correspondência funcional;
* similaridade mínima de 90%;
* similaridade mínima de 80%;
* similaridade mínima de 70%.

O relaxamento deve ocorrer somente quando a estratégia anterior não produzir comparáveis suficientes.

A resposta da API deve informar:

* estratégia utilizada;
* quantidade encontrada;
* quantidade descartada;
* quantidade efetivamente usada;
* similaridade média;
* idade mediana dos anúncios;
* quantidade de vendedores diferentes;
* se a busca foi relaxada;
* etapas de relaxamento aplicadas;
* motivos de descarte;
* motivo de confiança baixa;
* comparáveis utilizados;
* comparáveis rejeitados;
* preço estimado;
* intervalo provável;
* moeda;
* confiança.

Não afirme que um preço é "live" apenas porque a fonte é o Trade2. Diferencie claramente dados atuais, dados insuficientes, estimativa baseada em busca relaxada e fallback.

## 2. Unificar `BuildProfile` e `AdvancedBuildProfile`

Elimine os dois sistemas paralelos de build.

Crie um único modelo utilizado por todo o aplicativo, mantendo compatibilidade com perfis existentes quando necessário.

O perfil unificado deve conter:

* classe e ascendência;
* nível;
* estágio da campanha ou endgame;
* skills principais;
* damage tags;
* tipos de dano;
* conversões;
* crítico;
* attack speed ou cast speed;
* prioridades defensivas;
* requisitos de atributos;
* Spirit;
* resistências;
* prioridades por slot;
* pesos por stat;
* regras condicionais;
* caps;
* breakpoints;
* conteúdo alvo;
* orçamento;
* stats proibidos, inúteis ou desperdiçados;
* dependências entre equipamentos.

Atualize todos os consumidores para utilizar esse modelo único, incluindo análise de item, comparação com equipado, mercado, leveling, crafting e Build Doctor.

## 3. Colocar o `StatValuationEngine` na decisão principal

O `StatValuationEngine` deve participar diretamente do `/api/analyze`.

Implemente o fluxo:

Item real
→ parser normalizado
→ modificadores estruturados
→ valores numéricos
→ contexto atual do personagem
→ pesos da build e do slot
→ contribuição individual de cada stat
→ interação entre stats
→ caps e breakpoints
→ comparação com o item equipado
→ impacto nos totais do personagem
→ recomendação final

Reduza regex e heurísticas textuais espalhadas. Centralize parsing, normalização e avaliação.

A resposta deve mostrar, para cada stat:

* valor encontrado;
* origem;
* tipo local ou global;
* tier quando conhecido;
* peso para a build;
* peso para o slot;
* valor efetivo antes e depois de caps;
* contribuição ofensiva;
* contribuição defensiva;
* contribuição de utilidade;
* contribuição para requisitos;
* motivo de ser valioso, neutro ou desperdiçado.

A recomendação final não pode depender apenas de texto gerado ou regras genéricas.

## 4. Criar quatro avaliações independentes

Substitua a nota única por quatro resultados separados:

* `buildFit`
* `upgradeValue`
* `marketValue`
* `craftPotential`

Cada resultado deve ter:

* score;
* nível de confiança;
* resumo;
* fatores positivos;
* fatores negativos;
* dados utilizados;
* limitações.

Depois gere uma decisão principal entre:

* Use
* Sell
* Craft
* Keep
* Discard

A decisão deve explicar por que foi escolhida e quais condições poderiam alterá-la.

## 5. Criar "Por que este preço?"

Implemente uma área detalhada para explicar a estimativa de mercado.

Exiba uma tabela com:

* comparável;
* similaridade;
* preço;
* moeda;
* diferença principal;
* idade do anúncio;
* vendedor;
* estratégia que encontrou o item;
* usado ou descartado;
* motivo do descarte.

Mostre também:

* mediana;
* média aparada;
* faixa interquartil;
* preço mínimo confiável;
* preço central;
* preço máximo provável;
* possíveis outliers;
* possíveis price fixes;
* liquidez aproximada;
* confiança final.

Os cálculos devem ser feitos no backend. O frontend apenas apresenta dados estruturados.

## 6. Criar análise de oportunidade

Além de informar quanto o item vale, responda:

* existe upgrade melhor pelo mesmo preço;
* existe upgrade significativamente melhor pagando um pouco mais;
* quanto seria necessário adicionar para obter um salto relevante;
* é mais barato comprar pronto ou craftar;
* o item possui stat caro que a build não utiliza;
* vender o item permitiria comprar algo mais adequado;
* qual busca de mercado representa a melhor alternativa;
* qual ganho seria obtido em relação ao equipado.

Crie endpoints e componentes reutilizando o mesmo modelo de item, build e mercado. Não crie um sistema paralelo.

## 7. Implementar Build Doctor

Crie uma página em que o usuário possa colar ou importar todos os equipamentos do personagem.

Calcule:

* resistências atuais e faltantes;
* atributos totais;
* atributos necessários para equipamentos, skills e gems;
* dependências entre itens;
* Spirit atual e breakpoints;
* defesa por tipo;
* dano relevante para a build;
* slots mais fracos;
* stats desperdiçados;
* melhor upgrade por custo;
* ordem recomendada de upgrades;
* orçamento sugerido por slot.

Exiba alertas como:

"Não troque este anel antes de recuperar 38 de Dexterity."

As recomendações devem simular a remoção e substituição de cada item, em vez de avaliar os slots isoladamente.

## 8. Melhorar o sistema de leveling

O leveling deve considerar o estágio atual do personagem e não reutilizar diretamente um perfil de endgame.

Implemente perfis derivados por faixa de nível e marcos como:

* 10;
* 20;
* 30;
* 40;
* campanha avançada;
* início do endgame;
* endgame.

O sistema deve:

* identificar os dois ou três piores slots;
* evitar pesquisar todos os slots sem necessidade;
* definir orçamento por slot;
* considerar quantos níveis o item continuará útil;
* evitar recomendar item que será abandonado rapidamente;
* priorizar resistência, movimento, dano, vida, atributos e Spirit conforme o estágio;
* marcar recomendações como "compre agora", "aguarde até o nível X" ou "não vale o custo";
* explicar o que muda no próximo marco de progressão.

## 9. Criar perfil persistente por personagem

Implemente persistência para:

* nome do personagem;
* liga;
* level;
* classe;
* ascendência;
* build ativa;
* estágio de progressão;
* equipamentos;
* totais atuais;
* atributos;
* resistências;
* Spirit;
* orçamento;
* conteúdo alvo;
* problemas atuais;
* histórico de análises;
* data da última atualização.

O usuário não deve precisar preencher novamente os mesmos dados em cada análise.

Inclua migrations, validações, endpoints, testes e interface de seleção de personagem.

## 10. Criar histórico de mercado

Salve snapshots das buscas de mercado sem duplicar desnecessariamente os mesmos dados.

Permita calcular:

* preço subindo ou caindo;
* quantidade de anúncios;
* quantidade de vendedores;
* liquidez aproximada;
* idade dos anúncios;
* diferença entre menor preço e preço central;
* variação ao longo do tempo;
* possível manipulação;
* possível price fixing.

Nunca trate ausência de venda confirmada como prova de liquidez real. Identifique claramente quais métricas são aproximações.

## 11. Transformar crafting em máquina de estados

Substitua o sistema genérico de crafting por uma máquina de estados real.

Cada estado deve representar:

* base;
* item level;
* raridade;
* qualidade;
* prefixes;
* suffixes;
* modificadores híbridos;
* grupos de modificadores;
* sockets, runes ou equivalentes;
* currency gasta;
* valor atual estimado;
* objetivo do craft.

Cada ação deve validar:

* currency compatível;
* raridade compatível;
* tipo de item;
* quantidade de espaços disponíveis;
* modifier groups conflitantes;
* item level mínimo;
* outcomes possíveis;
* possibilidade de reversão;
* custo acumulado;
* chance conhecida;
* chance desconhecida;
* valor esperado;
* risco;
* ponto recomendado para parar.

Compare continuamente:

continuar craftando
versus
vender o estado atual
versus
comprar um item pronto.

Nunca invente probabilidades que não estejam disponíveis. Quando a chance não for conhecida, marque explicitamente como desconhecida.

## 12. Criar simulador "E se?"

Implemente simulações como:

* e se eu usar Exalted;
* e se eu adicionar vida;
* e se eu perder esta resistência;
* quanto valeria com mais Chaos Resistance;
* qual o melhor afixo legal disponível;
* qual resultado melhora mais a build;
* qual resultado melhora mais o valor de mercado;
* quanto posso gastar antes de ser melhor comprar pronto.

A simulação não deve alterar permanentemente o item até o usuário confirmar a ação.

## 13. Criar histórico de crafting

Permita registrar cada ação do craft e recalcular:

* estado anterior;
* ação utilizada;
* estado posterior;
* currency gasta;
* custo acumulado;
* valor anterior;
* valor atual;
* ganho ou perda;
* próxima ação segura;
* riscos;
* momento recomendado para parar.

Permita desfazer apenas ações que sejam logicamente reversíveis dentro do modelo, sem fingir que currencies irreversíveis podem ser recuperadas.

## 14. Criar base estruturada de modificadores

Alimente e utilize de verdade as tabelas de:

* modifier definitions;
* modifier groups;
* bases;
* tiers;
* tags;
* classes válidas;
* item levels;
* regras de crafting;
* local ou global;
* prefix ou suffix;
* modificadores híbridos;
* versões e patches.

O fluxo deve ser:

texto do modificador
→ identificador conhecido
→ grupo
→ tier
→ tags
→ local ou global
→ classes válidas
→ item level
→ impacto na build

Regex deve ser apenas fallback controlado, com confiança baixa e indicação explícita.

## 15. Corrigir modificadores híbridos

Um modificador híbrido deve ocupar apenas o espaço real correspondente e não aparecer como dois afixos independentes.

Corrija isso em:

* parser;
* modelo normalizado;
* contagem de prefixes e suffixes;
* validação de crafting;
* avaliação dos rolls;
* pesquisa de mercado;
* interface;
* testes.

## 16. Adicionar Deflection e Runic Ward

Deflection e Runic Ward não podem permanecer com valor zero quando presentes no item.

Adicione suporte completo em:

* parsing;
* normalização;
* totais do personagem;
* comparação com equipado;
* pesos defensivos;
* build fit;
* mercado;
* crafting;
* interface;
* testes.

## 17. Detectar modificadores locais e globais

Implemente identificação confiável de modificadores locais e globais.

Isso deve afetar corretamente:

* dano físico de armas;
* dano elemental local;
* attack speed local;
* crítico local;
* Armour;
* Evasion;
* Energy Shield;
* Deflection;
* Runic Ward;
* modificadores globais visualmente semelhantes.

A avaliação deve aplicar o modificador local à base correspondente antes de calcular o impacto final.

## 18. Criar explicação Beginner e Advanced

A interface deve oferecer duas camadas.

### Beginner

Explique de forma prática, por exemplo:

"Este anel melhora sua resistência a frio, mas remove a Dexterity necessária para uma de suas gems."

### Advanced

Mostre:

* contribuição de cada stat;
* pesos;
* caps;
* breakpoints;
* tiers;
* modifier groups;
* local ou global;
* comparáveis;
* fórmula de preço;
* confiança;
* dados descartados;
* limitações.

As duas camadas devem usar o mesmo resultado estruturado, sem gerar conclusões diferentes.

## 19. Simplificar a página inicial

O fluxo principal para iniciantes deve ser:

1. Colar item.
2. Escolher personagem ou build.
3. Analisar.

Mova para **Opções avançadas**:

* item equipado manual;
* mercado manual;
* overrides;
* pesos;
* configurações de busca;
* detalhes técnicos.

Não remova recursos avançados existentes.

## 20. Tornar importadores verificáveis

Para cada importação de build ou guia, mostre:

* campos detectados;
* valor detectado;
* trecho de origem;
* fonte;
* método utilizado;
* confiança por campo;
* campos que exigem confirmação;
* data da importação;
* snapshot salvo.

Caso HTML direto ou Jina Reader falhem, não trate dados incompletos como importação bem-sucedida.

## 21. Criar atualizador de patch operacional

Implemente o processo completo:

* baixar fonte;
* registrar origem;
* validar schema;
* normalizar dados;
* criar nova versão;
* executar testes de regressão;
* comparar com a versão ativa;
* ativar somente se os testes passarem;
* permitir rollback;
* marcar versões antigas como deprecated;
* manter histórico.

Uma atualização inválida nunca deve substituir automaticamente a versão ativa.

## Ordem obrigatória de implementação

Implemente e valide nesta ordem:

1. Integrar o novo mercado ao `/api/analyze`.
2. Unificar os modelos de build.
3. Integrar o `StatValuationEngine`.
4. Unificar o modelo normalizado de item usado por preço, build fit e crafting.
5. Estruturar a base real de modificadores.
6. Corrigir híbridos, local/global, Deflection e Runic Ward.
7. Criar as quatro avaliações e a recomendação final.
8. Criar "Por que este preço?".
9. Criar análise de oportunidade.
10. Criar Build Doctor.
11. Melhorar leveling.
12. Criar perfis persistentes.
13. Transformar crafting em máquina de estados.
14. Criar simulador e histórico de crafting.
15. Criar histórico de mercado.
16. Melhorar importadores e atualização de patch.
17. Simplificar a interface.

## Requisitos técnicos

* Não crie novos motores paralelos.
* Reutilize um único modelo normalizado de item.
* Reutilize um único modelo de build.
* Centralize regras e cálculos no backend.
* Preserve contratos existentes quando possível.
* Crie migrations para alterações no banco.
* Valide entradas e respostas.
* Trate timeouts, rate limits e falhas do Trade2.
* Não esconda fallback ou baixa confiança.
* Não invente preços, tiers, chances ou regras.
* Remova código antigo quando o novo fluxo estiver validado.
* Remova imports, funções, componentes e arquivos mortos.
* Não adicione comentários óbvios ou desnecessários.
* Atualize a documentação da pasta `/docs`.
* Não entregue mocks como implementação final.
* Não marque uma funcionalidade como concluída se ela existir apenas no backend ou apenas no frontend.
* Não altere o visual inteiro sem necessidade.
* Não quebre dados e perfis já salvos.

## Testes obrigatórios

Adicione e execute testes para:

* endpoint `/api/analyze`;
* estratégias de busca;
* relaxamento progressivo;
* cálculo de similaridade;
* remoção de outliers;
* detecção de possíveis price fixes;
* confiança;
* perfil de build unificado;
* pesos por slot;
* caps e breakpoints;
* comparação com equipado;
* modificadores híbridos;
* local versus global;
* Deflection;
* Runic Ward;
* contagem de prefixes e suffixes;
* máquina de estados de crafting;
* currencies incompatíveis;
* item level;
* modifier groups;
* persistência de personagem;
* Build Doctor;
* leveling por faixa;
* histórico de mercado;
* histórico de crafting;
* falhas e timeouts do Trade2;
* interface Beginner e Advanced.

Execute também:

* testes do backend;
* testes do frontend;
* typecheck;
* lint;
* build de produção;
* inicialização completa pelo Docker, caso o projeto utilize Docker;
* teste manual do fluxo principal.

Corrija os erros encontrados e repita os testes até tudo passar.

## Critérios de conclusão

Só finalize quando:

* o botão principal utilizar o novo motor de mercado;
* o sistema antigo não for mais o responsável pelo preço principal;
* preço, build fit, comparação e crafting utilizarem o mesmo item normalizado;
* existir apenas um modelo real de build;
* o `StatValuationEngine` afetar a decisão final;
* os comparáveis e a confiança forem visíveis;
* híbridos, local/global, Deflection e Runic Ward estiverem funcionando;
* as novas páginas estiverem conectadas à navegação e às APIs;
* migrations forem aplicáveis;
* os testes passarem;
* o frontend compilar;
* o backend iniciar;
* a aplicação funcionar de ponta a ponta;
* `/docs` estiver atualizado.

Ao finalizar, apresente somente um resumo objetivo contendo:

* principais alterações realizadas;
* arquivos centrais modificados;
* migrations criadas;
* testes executados e resultados;
* funcionalidades que ficaram totalmente integradas;
* qualquer limitação real que ainda dependa de uma fonte externa.

Não pare ao encontrar o primeiro erro. Continue corrigindo e validando até entregar a implementação funcional.
