Quero transformar este aplicativo em um assistente completo para jogadores de Path of Exile 2, especialmente jogadores novos.

Antes de implementar qualquer coisa, analise todo o repositório atual, identifique a arquitetura, as funcionalidades existentes, as tecnologias usadas e os pontos que podem ser reaproveitados. Não reescreva o projeto desnecessariamente e não remova funcionalidades existentes.

O sistema deve ser capaz de:

1. Ler e entender qualquer item do Path of Exile 2.
2. Explicar para que tipos de build o item é bom.
3. Avaliar cada modificador individualmente.
4. comparar o item com o equipamento atualmente usado.
5. Recomendar rotas válidas de crafting.
6. Impedir recomendações de crafting impossíveis.
7. Estimar o valor de mercado com base em itens comparáveis reais.
8. Explicar tudo de forma simples para jogadores iniciantes.
9. Funcionar para várias classes, ascendências, skills, armas e arquétipos.
10. Manter todo o conhecimento separado por versão e patch do jogo.

Não crie uma lógica fixa apenas para Ice Shot Deadeye.

==================================================
PRINCÍPIO CENTRAL
==================================================

O valor de um atributo não deve ser definido somente pela classe.

Exemplo:

“Ranger” ou “Deadeye” não é informação suficiente.

Uma build deve ser representada por:

- classe;
- ascendência;
- skill principal;
- skills secundárias;
- tipo de arma;
- tags de dano;
- fonte principal de dano;
- tipo de ataque ou spell;
- dano físico, cold, fire, lightning ou chaos;
- crítico ou não crítico;
- conversão de dano;
- defesa principal;
- vida, Energy Shield, Evasion, Armour, Deflection ou combinação;
- conteúdo alvo;
- campanha, mapas, bosses, pinnacle bosses ou hardcore;
- estágio da build;
- leveling, early endgame, midgame ou endgame;
- orçamento;
- requisitos obrigatórios;
- atributos necessários;
- Spirit necessário;
- resistências necessárias;
- problemas atuais do personagem.

O sistema deve utilizar BuildProfile, e não somente PlayerClass.

==================================================
FASE 1 — DOCUMENTAÇÃO E PROGRAMA DE ESTUDO
==================================================

Crie a pasta:

/docs/poe-knowledge/

Crie os seguintes documentos:

/docs/poe-knowledge/00-overview.md
/docs/poe-knowledge/01-data-sources.md
/docs/poe-knowledge/02-item-system.md
/docs/poe-knowledge/03-modifiers.md
/docs/poe-knowledge/04-build-profiles.md
/docs/poe-knowledge/05-stat-valuation.md
/docs/poe-knowledge/06-crafting-engine.md
/docs/poe-knowledge/07-market-pricing.md
/docs/poe-knowledge/08-user-explanations.md
/docs/poe-knowledge/09-versioning.md
/docs/poe-knowledge/10-testing.md
/docs/poe-knowledge/11-compliance.md

Esses documentos devem explicar como o sistema funciona e devem ser atualizados junto com o código.

Antes da implementação final, estude e documente:

- classes de itens;
- bases de itens;
- implicits;
- prefixes;
- suffixes;
- tiers;
- modifier groups;
- modificadores híbridos;
- modificadores locais;
- modificadores globais;
- requisitos de item level;
- quantidade máxima de afixos;
- sockets;
- runes;
- quality;
- corrupção;
- itens únicos;
- itens raros;
- itens mágicos;
- essences;
- omens;
- exalted currencies;
- annulment;
- chaos crafting;
- desecrated modifiers;
- regras de incompatibilidade entre modificadores;
- modificadores exclusivos de determinados tipos de item.

Todo conhecimento precisa registrar:

- patch do jogo;
- versão do conjunto de dados;
- fonte;
- data de atualização;
- nível de confiança;
- se é dado oficial, comunitário ou inferido.

==================================================
FASE 2 — MODELO NORMALIZADO DE ITEM
==================================================

Crie um modelo ItemAnalysisInput semelhante a:

{
  "game": "poe2",
  "league": "",
  "patch": "",
  "itemClass": "",
  "baseType": "",
  "rarity": "",
  "itemLevel": 0,
  "requiredLevel": 0,
  "quality": 0,
  "corrupted": false,
  "identified": true,
  "sockets": [],
  "implicitModifiers": [],
  "prefixes": [],
  "suffixes": [],
  "unknownModifiers": [],
  "baseDefences": {
    "armour": 0,
    "evasion": 0,
    "energyShield": 0,
    "deflection": 0,
    "runicWard": 0
  }
}

Cada modificador deve ser normalizado como:

{
  "id": "",
  "text": "",
  "type": "prefix",
  "group": "",
  "tier": 1,
  "minimumRoll": 0,
  "maximumRoll": 0,
  "actualRoll": 0,
  "rollPercentile": 0,
  "tags": [],
  "local": false,
  "crafted": false,
  "desecrated": false,
  "source": ""
}

O parser deve reconhecer:

- texto copiado diretamente do jogo;
- item com linhas separadas;
- intervalos mostrados ao segurar Alt;
- tier;
- prefix e suffix;
- modificadores crafted;
- modificadores híbridos com duas linhas;
- implicits;
- modificadores adicionados por corrupção;
- qualidade;
- sockets;
- requisitos;
- valores aumentados;
- valores locais e globais.

Priorize o texto copiado do jogo como método principal.

OCR de screenshot deve ser um recurso secundário e deve exibir baixa confiança quando houver dúvida.

Nunca invente tier, modifier group ou item level.

==================================================
FASE 3 — PERFIS DE BUILD
==================================================

Crie um sistema de BuildProfile em formato JSON ou YAML.

Exemplo:

{
  "id": "deadeye-ice-shot-endgame",
  "name": "Ice Shot Deadeye Endgame",
  "patch": "",
  "class": "Ranger",
  "ascendancy": "Deadeye",
  "mainSkill": "Ice Shot",
  "weaponTypes": ["Bow"],
  "damageTags": [
    "Attack",
    "Projectile",
    "Physical",
    "Cold",
    "Critical"
  ],
  "defenceTags": [
    "Evasion",
    "Energy Shield"
  ],
  "stage": "Endgame",
  "budget": "Medium",
  "content": [
    "Mapping",
    "Bossing"
  ],
  "mandatoryRequirements": [],
  "slotPriorities": {},
  "statWeights": {},
  "conditionalRules": [],
  "sources": []
}

Para cada build, crie prioridades específicas por slot.

Exemplo de estrutura:

"slotPriorities": {
  "bow": [],
  "quiver": [],
  "helmet": [],
  "bodyArmour": [],
  "gloves": [],
  "boots": [],
  "amulet": [],
  "ring": [],
  "belt": [],
  "jewel": []
}

Não copie cegamente listas de um único guia.

Quando possível:

- compare pelo menos duas fontes atuais;
- identifique divergências;
- registre qual variante está sendo usada;
- permita que o usuário altere pesos;
- permita perfis personalizados;
- permita importar ou cadastrar builds manualmente.

O aplicativo deve começar com uma biblioteca inicial abrangendo arquétipos diferentes:

- bow physical;
- bow elemental;
- crossbow;
- melee physical;
- melee elemental;
- spell caster;
- minion;
- chaos damage;
- critical;
- non-critical;
- life;
- Energy Shield;
- Armour;
- Evasion;
- híbridos defensivos;
- leveling;
- mapping;
- bossing;
- hardcore.

Não é necessário cadastrar todas as builds do jogo manualmente na primeira versão. Crie uma arquitetura expansível e alguns perfis representativos bem testados.

==================================================
FASE 4 — MOTOR DE VALOR DOS ATRIBUTOS
==================================================

Crie um StatValuationEngine.

Cada atributo deve receber um valor baseado em:

- build selecionada;
- slot do item;
- tier;
- roll percentile;
- sinergia com outros mods;
- requisitos atuais do personagem;
- limites e caps;
- orçamento;
- conteúdo alvo;
- oferta de mercado;
- dificuldade de obter o modificador;
- possibilidade de substituição por outro slot.

Exemplos:

- resistência abaixo do cap pode ser extremamente valiosa;
- resistência acima do necessário perde valor;
- Intelligence pode ser valiosa somente até atingir um requisito;
- Spirit pode ser obrigatório para ativar uma skill;
- flat physical damage pode ser excelente para uma build e irrelevante para outra;
- critical chance pode ser muito importante em uma build crítica e inútil em uma build non-critical;
- mana pode ser valiosa somente quando resolve sustain;
- rarity não deve ser tratada como defesa ou dano;
- life leech deve considerar quanto dano elegível a build realmente causa;
- attack speed pode ter valor diferente por arma e skill;
- Energy Shield em um capacete pode ter sinergia com passivas que utilizem o ES do capacete.

O score deve ser dividido em categorias:

- Offence Score;
- Defence Score;
- Utility Score;
- Build Fit Score;
- Market Score;
- Craft Potential Score.

Produza também um score geral de 0 a 100, mas nunca esconda os scores individuais.

O aplicativo deve explicar:

- por que cada atributo é bom;
- por que cada atributo é ruim;
- quanto ele contribui para a build;
- se o valor é condicional;
- se o personagem já ultrapassou um cap;
- qual modificador está desperdiçado;
- qual modificador seria o melhor upgrade.

Não use somente soma linear de pesos.

Considere:

- diminishing returns;
- hard requirements;
- caps;
- breakpoints;
- sinergias;
- exclusões;
- penalidades;
- modificadores obrigatórios;
- modificadores que habilitam a build.

==================================================
FASE 5 — ANÁLISE ESPECÍFICA POR CATEGORIA
==================================================

Todas as categorias devem aparecer na mesma página, mas cada tipo de item deve possuir análise própria.

Crie analisadores separados para:

- Bow;
- Crossbow;
- Spear;
- Quarterstaff;
- Staff;
- Wand;
- Sceptre;
- One-Handed Weapon;
- Two-Handed Weapon;
- Shield;
- Focus;
- Quiver;
- Helmet;
- Body Armour;
- Gloves;
- Boots;
- Ring;
- Amulet;
- Belt;
- Jewel.

Exemplos:

Bow:

- physical DPS;
- elemental DPS;
- total DPS;
- attacks per second;
- critical chance;
- flat damage;
- increased physical damage;
- attack speed;
- projectile interactions;
- skill levels;
- build compatibility.

Shield:

- block chance;
- local defence;
- Armour;
- Evasion;
- Energy Shield;
- Deflection;
- resistances;
- maximum life;
- utility;
- build-specific interactions.

Helmet:

- defesa total;
- vida;
- Spirit;
- resistências;
- atributos;
- skill levels;
- sockets;
- sinergias com passivas e uniques.

Gloves:

- flat attack damage;
- attack speed;
- cast speed;
- skill levels;
- life;
- defences;
- leech;
- resistances;
- attributes;
- build relevance.

Boots:

- movement speed;
- life;
- defences;
- resistances;
- attributes;
- Spirit;
- utility.

Jewellery:

- flat damage;
- resistances;
- attributes;
- Spirit;
- skill levels;
- critical stats;
- life;
- mana;
- rarity;
- build-enabling modifiers.

==================================================
FASE 6 — MOTOR DE CRAFTING
==================================================

Crie um CraftingEngine baseado em estado.

Cada item deve ser tratado como um CraftState:

{
  "item": {},
  "openPrefixes": 0,
  "openSuffixes": 0,
  "modifierGroups": [],
  "availableActions": [],
  "blockedActions": [],
  "craftGoal": {},
  "estimatedItemValue": 0,
  "estimatedCraftCost": 0
}

Antes de recomendar qualquer currency, valide:

- raridade atual;
- quantidade de prefixes;
- quantidade de suffixes;
- modifier groups existentes;
- item level;
- base type;
- quality;
- corrupção;
- sockets;
- requisitos da currency;
- se a currency aceita aquele tipo de item;
- se já existe um modificador incompatível;
- se a currency substituirá ou adicionará mod;
- se algum Omen está ativo;
- se a sequência é realmente legal.

O sistema nunca pode cometer erros como:

- recomendar uma essence que tenta adicionar um modifier group já presente;
- recomendar Augmentation em um item que não aceita outro afixo;
- recomendar crafting normal em item corrompido;
- afirmar que uma currency garante T1 quando ela não garante;
- confundir prefix com suffix;
- confundir modificador híbrido com dois afixos separados;
- confundir requisito de uso com item level;
- recomendar Perfect Currency sem analisar custo e retorno;
- afirmar que um resultado é garantido quando é aleatório.

Crie um LegalActionValidator separado do recomendador.

Nenhuma recomendação pode ser mostrada sem passar pelo LegalActionValidator.

==================================================
PLANEJADOR DE CRAFTING
==================================================

O usuário deve informar um objetivo, por exemplo:

- capacete com 450+ Energy Shield;
- bow com determinado physical DPS;
- luva com vida, attack speed e flat physical;
- botas com movement speed e resistências;
- shield com block e Energy Shield.

O sistema deve gerar:

1. pré-requisitos da base;
2. item level mínimo;
3. modificadores iniciais desejados;
4. sequência de currencies;
5. possíveis falhas;
6. pontos de parada;
7. opção barata;
8. opção intermediária;
9. opção cara;
10. custo estimado;
11. chance estimada de sucesso;
12. valor provável do resultado;
13. comparação entre craftar e comprar pronto.

Use uma representação em grafo:

- cada nó é um estado do item;
- cada aresta é uma ação de crafting;
- cada ação possui custo;
- cada ação possui pré-condições;
- cada ação possui resultados possíveis;
- cada resultado possui probabilidade quando conhecida;
- o sistema deve buscar uma rota eficiente até o objetivo.

Quando probabilidades exatas não estiverem disponíveis:

- não invente números;
- marque a probabilidade como desconhecida;
- use comparação qualitativa;
- mostre nível de confiança.

Crie stop conditions.

Exemplos:

- parar porque o item já vale mais do que o custo esperado do próximo passo;
- parar porque o resultado atual é bom para uso;
- parar porque o craft perdeu o modifier obrigatório;
- parar porque comprar outro item é mais barato;
- parar porque a próxima etapa exige uma currency cara e tem baixo retorno esperado.

==================================================
FASE 7 — PESQUISA E VALORAÇÃO DE MERCADO
==================================================

Crie um MarketValuationEngine.

Não estime o preço somente pela soma dos tiers.

O valor deve ser baseado em:

- demanda das builds;
- relevância do base type;
- item level;
- defesa total;
- DPS;
- sockets;
- qualidade;
- corrupção;
- Spirit;
- modificadores raros;
- combinações de modificadores;
- dificuldade de craft;
- custo esperado de criação;
- preço de itens comparáveis;
- quantidade de resultados;
- idade das listagens;
- liga;
- patch;
- moeda usada.

==================================================
GERAÇÃO DE COMPARÁVEIS
==================================================

Ao receber um item:

1. identifique os atributos que mais influenciam seu preço;
2. não pesquise todos os modificadores ao mesmo tempo;
3. selecione inicialmente os 2 a 4 modificadores mais importantes;
4. considere o tipo de build que gera demanda pelo item;
5. gere várias pesquisas progressivas.

Crie os seguintes grupos:

Pesquisa A — Comparação exata

- mesma base;
- mesma raridade;
- mesmo estado de corrupção;
- mesmas características essenciais;
- valores próximos;
- mesma liga.

Pesquisa B — Comparação funcional

- mesma classe de item;
- defesa ou DPS semelhante;
- mesmos modificadores principais;
- modificadores secundários diferentes.

Pesquisa C — Comparação relaxada

- valores mínimos reduzidos para aproximadamente 90%;
- depois 80%;
- depois 70%, caso não existam resultados suficientes.

Pesquisa D — Comparação por build

- itens que cumprem a mesma função;
- mesmo slot;
- mesma build ou arquétipo;
- mesmo nível aproximado de poder.

Não compare um item mediano com somente os itens perfeitos disponíveis.

Não compare itens diferentes apenas porque possuem um atributo em comum.

==================================================
ALGORITMO DE PREÇO
==================================================

Para cada resultado de mercado, normalize:

- moeda;
- preço em Divine;
- preço em Exalted;
- preço em moedas menores;
- data e hora;
- status online;
- tempo desde a listagem;
- base;
- item level;
- modificadores;
- valores;
- corrupção;
- sockets;
- qualidade.

Utilize uma combinação de:

- distância ponderada entre atributos;
- weighted nearest neighbours;
- mediana;
- quantis;
- remoção de outliers;
- quantidade de comparáveis;
- recência;
- relevância da base;
- afinidade com a build.

Produza:

- preço de venda rápida;
- preço justo;
- preço inicial para anúncio;
- faixa inferior;
- faixa superior;
- nível de confiança;
- número de comparáveis;
- principais comparáveis;
- justificativa.

Exemplo de resposta:

{
  "quickSell": {
    "amount": 8,
    "currency": "Exalted"
  },
  "fairPrice": {
    "amount": 12,
    "currency": "Exalted"
  },
  "listingPrice": {
    "amount": 15,
    "currency": "Exalted"
  },
  "confidence": 0.74,
  "sampleSize": 18,
  "priceDrivers": [
    "High maximum Life",
    "T1 Dexterity",
    "Lightning Resistance"
  ],
  "pricePenalties": [
    "No Attack Speed",
    "Low Physical Damage tier"
  ]
}

Caso somente listagens ativas estejam disponíveis, deixe claro:

“Esta é uma estimativa baseada em preços pedidos, e não em vendas concluídas.”

Nunca diga que um item certamente vale determinado valor quando a amostra for pequena.

==================================================
INTEGRAÇÃO COM O MERCADO
==================================================

Crie uma interface MarketProvider.

Exemplo:

interface MarketProvider {
  search(query: MarketSearchQuery): Promise<MarketSearchResult>;
  getCurrencyRates(): Promise<CurrencyRates>;
  getProviderStatus(): Promise<ProviderStatus>;
}

Implemente os provedores de forma desacoplada.

Requisitos:

- cache;
- throttling;
- retry controlado;
- timeout;
- identificação do provedor;
- registro da data da consulta;
- tratamento de rate limit;
- tratamento de bloqueio;
- fallback;
- nunca fazer spam de requisições;
- nunca automatizar mensagens ou negociações;
- nunca criar bot de compra;
- nunca criar bot de whisper;
- respeitar termos e limitações das fontes.

Se não houver integração autorizada ou estável:

- gere a pesquisa;
- gere o payload;
- gere a URL ou instrução para abrir no trade;
- permita que o usuário cole os resultados;
- continue a análise localmente.

Não dependa de endpoints internos não documentados como única solução.

==================================================
FASE 8 — COMPARAÇÃO COM ITEM EQUIPADO
==================================================

Ao comparar dois itens, mostre:

- dano ganho ou perdido;
- vida ganha ou perdida;
- Energy Shield ganho ou perdido;
- Evasion ganho ou perdido;
- Armour ganho ou perdido;
- Deflection ganha ou perdida;
- resistências ganhas ou perdidas;
- atributos ganhos ou perdidos;
- Spirit ganho ou perdido;
- requisitos que deixam de ser cumpridos;
- caps que deixam de ser atingidos;
- skills que deixam de funcionar;
- mudança no Build Fit Score;
- mudança no preço estimado.

Não mostre somente “item A é melhor”.

Mostre por que ele é melhor e em qual cenário.

Exemplo:

“Este item aumenta seu dano, mas reduz sua Lightning Resistance para abaixo do cap.”

“Este item oferece mais Energy Shield, mas você perde 5 Spirit e não consegue manter uma skill ativa.”

“Este item é melhor para bosses, porém pior para mapping.”

==================================================
FASE 9 — INTERFACE
==================================================

A página principal deve conter seções separadas, mas permanecer em uma única página:

- Item Overview;
- Build Fit;
- Offensive Analysis;
- Defensive Analysis;
- Modifier Breakdown;
- Equipped Item Comparison;
- Crafting Plan;
- Market Valuation;
- Comparable Listings;
- Risks and Warnings;
- Beginner Explanation.

O conteúdo deve mudar conforme o tipo de item.

Para shields, foque em shield stats.

Para bows, foque em weapon DPS e stats ofensivos.

Para helmets, foque em defesa, vida, Spirit, resistências e sinergias.

Para gloves, foque em dano, velocidade, vida e utilidade.

Adicione dois modos:

Beginner Mode:

- linguagem simples;
- explica termos;
- mostra somente os próximos passos mais seguros;
- avisa quando é melhor parar;
- diferencia uso pessoal e venda.

Advanced Mode:

- tiers;
- modifier groups;
- ranges;
- cálculos;
- comparáveis;
- pesos;
- fontes;
- confiança;
- detalhes do algoritmo.

==================================================
FASE 10 — EXPLICAÇÃO E CONFIANÇA
==================================================

Toda recomendação deve possuir:

- conclusão;
- motivo;
- pré-condições;
- riscos;
- custo;
- alternativa;
- nível de confiança;
- fonte ou regra usada;
- patch dos dados.

Exemplo:

“Não é possível usar esta Essence porque o item já possui um modificador do mesmo grupo.”

“Você pode usar uma Greater Exalted Orb, mas o item não é forte o suficiente para justificar uma Perfect Exalted Orb.”

“Este item é bom para uso, porém não possui combinação de modificadores suficiente para alto valor de mercado.”

Não esconda incerteza.

Use níveis:

- High Confidence;
- Medium Confidence;
- Low Confidence.

==================================================
FASE 11 — BANCO DE DADOS
==================================================

Crie tabelas ou coleções para:

- item bases;
- modifier definitions;
- modifier groups;
- modifier tiers;
- crafting currencies;
- crafting rules;
- build profiles;
- skill profiles;
- slot priorities;
- stat weights;
- market searches;
- market listings;
- currency rates;
- price estimates;
- data sources;
- patch versions;
- analysis history;
- user equipment;
- custom user builds.

Todos os registros dependentes do jogo devem possuir:

- patch;
- source;
- fetchedAt;
- updatedAt;
- confidence;
- deprecated;
- dataVersion.

Nunca sobrescreva silenciosamente dados de uma versão anterior.

==================================================
FASE 12 — ATUALIZAÇÕES
==================================================

Crie um sistema de atualização versionado.

Quando houver novo patch:

1. registrar nova versão;
2. importar ou atualizar fontes;
3. comparar modificadores alterados;
4. identificar currencies alteradas;
5. identificar bases alteradas;
6. marcar builds potencialmente desatualizadas;
7. invalidar cache de mercado;
8. rodar testes de regressão;
9. gerar relatório de mudanças;
10. não aplicar automaticamente mudanças inseguras.

Crie uma página administrativa ou comando interno para visualizar:

- versão atual;
- última atualização;
- fontes;
- erros de importação;
- dados desatualizados;
- builds que precisam de revisão;
- regras conflitantes.

==================================================
FASE 13 — TESTES OBRIGATÓRIOS
==================================================

Crie testes unitários e de integração.

O parser deve ser testado com:

- item normal;
- item mágico;
- item raro;
- item único;
- item corrompido;
- item com modificador híbrido;
- item com crafted mod;
- arma;
- shield;
- helmet;
- gloves;
- boots;
- ring;
- amulet;
- belt;
- quiver;
- jewel.

O CraftingEngine deve testar:

- currency válida;
- currency inválida;
- modifier group incompatível;
- prefixes cheios;
- suffixes cheios;
- item corrompido;
- item level insuficiente;
- essence incompatível;
- Omen ausente;
- Omen ativo;
- ação que substitui mod;
- ação que adiciona mod;
- item sem espaço;
- sequência interrompida;
- stop condition.

O MarketValuationEngine deve testar:

- muitos comparáveis;
- poucos comparáveis;
- nenhum comparável;
- outlier extremamente barato;
- outlier extremamente caro;
- moedas diferentes;
- itens corrompidos;
- bases diferentes;
- item com stat obrigatório;
- item com stats altos, mas combinação sem demanda;
- item com preço artificialmente baixo;
- listagens antigas.

O Build Fit deve testar:

- resistência abaixo do cap;
- atributo abaixo do requisito;
- Spirit insuficiente;
- build crítica;
- build non-critical;
- conversão de dano;
- dano físico usado para leech;
- dano elemental não elegível para leech físico;
- item ofensivo;
- item defensivo;
- item híbrido.

==================================================
FASE 14 — FIXTURES REAIS
==================================================

Adicione fixtures baseadas em situações reais:

1. Capacete com alto increased Energy Shield, mas sem flat Energy Shield.
2. Capacete com três bons prefixes de Energy Shield.
3. Luva com vida, Dexterity, resistência e baixo flat physical.
4. Luva com attack speed e alto flat damage.
5. Shield com alto block, mas defesa local baixa.
6. Bow com alto dano elemental e baixo physical DPS.
7. Bow com alto physical DPS e baixa attack speed.
8. Amuleto que fornece o Spirit necessário para manter a build.
9. Item com muito rarity, mas pouco poder real.
10. Item com seis modificadores, porém dois irrelevantes.
11. Item valioso para uma build e ruim para outra.
12. Item que parece forte, mas perde requisitos obrigatórios ao ser equipado.

==================================================
CRITÉRIOS DE ACEITAÇÃO
==================================================

A tarefa só estará concluída quando:

1. O sistema não recomendar crafts impossíveis.
2. Toda ação de crafting tiver pré-condições validadas.
3. O usuário conseguir selecionar ou criar uma build.
4. O valor dos stats mudar conforme a build.
5. Cada categoria de item possuir análise especializada.
6. O sistema mostrar tiers e rolls corretamente.
7. O sistema diferenciar modificadores híbridos de afixos separados.
8. O sistema comparar o item com o equipamento atual.
9. O preço utilizar múltiplos comparáveis.
10. O preço mostrar amostra e confiança.
11. O sistema diferenciar preço pedido de venda concluída.
12. O sistema oferecer venda rápida, preço justo e preço de anúncio.
13. O sistema registrar a versão do patch.
14. O sistema possuir testes de regressão.
15. A documentação em /docs estiver completa.
16. Jogadores iniciantes conseguirem entender a recomendação.
17. Usuários avançados conseguirem visualizar os dados técnicos.
18. Nenhuma integração depender exclusivamente de scraping não autorizado.
19. Erros de fonte ou mercado não derrubarem a aplicação.
20. O sistema explicar claramente quando não possui dados suficientes.

==================================================
ORDEM DE IMPLEMENTAÇÃO
==================================================

Implemente nesta ordem:

Etapa 1:
- auditoria do projeto;
- documentação;
- interfaces;
- schemas;
- modelo de dados.

Etapa 2:
- parser de itens;
- normalização dos modificadores;
- testes do parser.

Etapa 3:
- BuildProfile;
- perfis iniciais;
- StatValuationEngine;
- Build Fit.

Etapa 4:
- LegalActionValidator;
- CraftingEngine;
- rotas de crafting;
- stop conditions.

Etapa 5:
- MarketProvider;
- geração de pesquisas;
- comparáveis;
- valuation;
- confiança e outliers.

Etapa 6:
- comparação com item equipado;
- interface por categoria;
- Beginner Mode;
- Advanced Mode.

Etapa 7:
- versionamento;
- atualizações;
- testes completos;
- documentação final.

Não tente implementar tudo em um único arquivo ou em uma única etapa.

Ao terminar cada etapa:

- execute os testes;
- corrija os erros;
- documente o que foi criado;
- informe quais arquivos foram alterados;
- informe limitações;
- não declare algo concluído sem testar.

Comece agora analisando o repositório e criando:

1. o plano técnico;
2. a estrutura da pasta /docs/poe-knowledge;
3. os schemas principais;
4. as interfaces ItemParser, BuildProfileProvider, CraftingEngine e MarketProvider;
5. a estratégia de testes;
6. a lista de fontes e limitações.

