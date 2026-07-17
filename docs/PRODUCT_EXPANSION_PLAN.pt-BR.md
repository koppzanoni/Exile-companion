# Plano de expansão — Builds, mercado e Gemini

## Princípios

- Motores determinísticos continuam responsáveis por parsing, preço, comparação, crafting e validação.
- Gemini consulta resultados estruturados, explica decisões e solicita ferramentas; nunca inventa evidência nem executa transações.
- Toda recomendação registra patch, fonte, confiança, limitações e dados utilizados.
- Anúncios e vendas concluídas permanecem conceitos separados.

## Fase 1 — Decisão de compra

- Comparar vários candidatos para o mesmo ou diferentes slots.
- Recalcular o perfil completo para cada candidato.
- Classificar ganho, risco, preço e ganho por Exalted.
- Criar plano de compras limitado por orçamento, sem selecionar duas substituições para o mesmo slot.
- Gerar buscas que preservem somente dependências reais.

## Fase 2 — Persistência e aprendizado local

- Conversas Gemini por personagem e análise de venda.
- Snapshots do personagem e comparação temporal.
- Feedback de recomendação e resultado real da ação.
- Diário de anúncios, mudanças de preço e vendas concluídas.
- Auditoria das ferramentas chamadas pelo Gemini.

## Fase 3 — Conhecimento avançado de build

- Skills, supports, passivas, weapon sets e Spirit reservado.
- Breakpoints, conversões e dependências entre mecânicas.
- Perfis semelhantes com fonte, patch e tamanho da amostra.
- Separação explícita entre popularidade e recomendação.

## Fase 4 — Agente controlado

- Ferramentas permitidas: diagnóstico, inspeção, busca, simulação, comparação, plano de orçamento e revisão de preço.
- Confirmação do usuário antes de qualquer navegação ou mutação persistente.
- Perfis Iniciante, Avançado, Trader, Crafter e Racer.
- Memória limitada, revisável e apagável.

## Fase 5 — Operação de vendas

- Painel Minhas Vendas.
- Alertas de preço e liquidez.
- Comparação por pacote de atributos, não apenas pela base.
- Registro de preço final e tempo até vender.

## Fase 6 — Governança

- Versão do patch e catálogo em toda análise.
- Métricas de latência, erros, rate limit, schema inválido, tokens e modelo Gemini.
- Testes de regressão por categoria, build e patch.
- Degradação segura quando Gemini, Trade2 ou fontes externas falharem.
