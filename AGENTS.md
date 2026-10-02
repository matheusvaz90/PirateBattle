# Instruções de implementação

- Chame o usuário de Mestre. Explique as decisões técnicas importantes depois de cada entrega.
- Leia README.md, ARCHITECTURE.md, docs/IMPLEMENTATION_PLAN.md e docs/PROGRESS.md antes de implementar. Atualize o progresso com os resultados reais e uma próxima tarefa concreta.
- Preserve o trabalho existente e implemente incrementos pequenos e compiláveis. Priorize um jogo funcional antes do polimento visual.
- Use inglês no código da aplicação, em identificadores, nomes de arquivos e logs. Use português brasileiro na documentação da solução. Não adicione comentários ao código-fonte.
- Use TypeScript estrito. Não use `any`, conversões inseguras para contornar verificações ou supressões de erros de tipagem.
- Não inicie a aplicação, servidores de desenvolvimento/pré-visualização nem testes dependentes de navegador. O usuário os executa e avalia o gameplay. Nunca afirme que essas verificações passaram sem os resultados do usuário.
- São permitidos lint estático, verificações de tipos, builds otimizados, descoberta de testes e testes isolados em Node. Não conecte testes a bancos de dados nem a serviços.
- Nunca acesse segredos ou bancos de dados reais, nem execute comandos destrutivos. Não faça commits, pushes, crie branches ou realize deploy sem autorização explícita.
- Não adicione dependências além da stack e das ferramentas acordadas sem aprovação. Não modifique artefatos gerados manualmente nem edite dependências vendorizadas.
- Preserve a separação entre motor, renderização, entrada e interface. Mantenha o balanceamento em configuração tipada. Não armazene posições contínuas do jogo no estado do React.
- Confirme alterações relevantes nas regras do jogo, na arquitetura ou nos contratos antes de implementá-las. Feedback rotineiro de balanceamento deve ser implementado por configuração.
- Os itens obrigatórios da entrega continuam obrigatórios; diferencie claramente requisitos implementados, verificados e pendentes.
