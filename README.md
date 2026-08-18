# Relatório de Reconhecimento e Diagnóstico de Rede

**Documento Técnico de Postura e Hardening de Segurança**
**Autor:** Eduardo Morningstar (Analista de Segurança Sênior / Operador de Blue Team)
**Data de Referência:** 17 de Agosto de 2026
**Classificação:** Confidencial / Uso Interno

---

## 1. Sumário Executivo

Este relatório apresenta um diagnóstico de segurança estruturado a partir do mapeamento e da enumeração de uma infraestrutura corporativa simulada em ambiente containerizado (Docker). A análise adota uma perspectiva estritamente defensiva (Blue Team), identificando as brechas que expõem os ativos críticos do negócio a riscos de comprometimento de confidencialidade, integridade e disponibilidade.

Durante o processo de auditoria de postura, foram detectadas múltiplas falhas de configuração padrão e vulnerabilidades severas na camada de aplicação e de rede, incluindo:
*   Acesso anônimo em serviços de transferência de arquivos.
*   Uso de credenciais e chaves criptográficas em texto claro no banco de dados e em arquivos de histórico.
*   Exposição de protocolos de monitoramento com configurações padrão de fábrica (*community strings* genéricas).
*   Vulnerabilidades clássicas de injeção de código e de inclusão local de arquivos (LFI) que permitem o comprometimento total do sistema operacional host e dos bancos de dados internos.

O impacto estimado para o negócio sob o cenário atual é **crítico**. Um ator de ameaça externo com nível básico de sofisticação possui insumos suficientes para exfiltrar a totalidade dos dados cadastrais de clientes, obter segredos industriais (chaves de API de produção) e estabelecer persistência na infraestrutura de rede corporativa.

---

## 2. Objetivo e Escopo

O principal objetivo desta atividade consistiu em realizar o levantamento passivo e ativo de portas, serviços e configurações de rede da infraestrutura simulada da **TechCorp Solutions**, compreendendo os limites lógicos do ambiente containerizado.

### Limites do Escopo:
*   **Alvo Primário:** Endereço IPv4 de Gateway/Proxy Externo: `98.95.207.28`.
*   **Rede Interna:** Sub-rede lógica Docker `172.20.0.0/24`.
*   **Serviços Analisados:** HTTP (Portas 80 e 8080), SSH (Porta 2222), FTP (Porta 21), SMB (Portas 139/445) e SNMP (Porta 161).
*   **Foco da Análise:** Detecção de falhas de arquitetura, serviços desatualizados e vazamento de informações sensíveis, sem aplicação de técnicas de negação de serviço (DoS) ou exploração destrutiva.

---

## 3. Metodologia

A análise de segurança baseou-se nas melhores práticas descritas por frameworks de testes de invasão e conformidade técnica (como o NIST SP 800-115 e o OWASP Testing Guide). O fluxo de trabalho utilizou o sistema operacional Kali Linux como estação de trabalho, operando de maneira sequencial através de quatro fases técnicas principais:

1.  **Varredura Rápida de Portas (*Fast Port Scanning*):** Utilização do **Rustscan** para identificar rapidamente portas TCP abertas, reduzindo o tempo de exposição e otimizando a posterior varredura detalhada.
2.  **Detecção de Versão e Vulnerabilidade (*Service Scanning*):** Execução do **Nmap** com argumentos de detecção de versão (`-sV`) e scripts básicos da Nmap Scripting Engine (`-sC`) para identificar as tecnologias em execução nas portas descobertas.
3.  **Enumeração de Serviços de Compartilhamento (Samba/SMB):** Utilização da ferramenta **Enum4linux-ng** para extrair metadados, compartilhamentos públicos sem autenticação e possíveis listas de usuários do domínio local nas portas TCP 139 e 445.
4.  **Enumeração de Protocolo de Monitoramento (SNMP):** Emprego da ferramenta **Snmpwalk** para consultar a árvore MIB (*Management Information Base*) do protocolo SNMP na porta UDP 161, buscando credenciais de leitura padrão de mercado.

---

## 4. Diagrama de Rede (Representação Estruturada)

Com base no reconhecimento dos serviços ativos e das relações de confiança lógicas identificadas no ambiente, a topologia de rede simula a seguinte interconexão lógica de ativos:

*   **Camada Externa (Borda):**
    *   **Gateway / Proxy Público (`98.95.207.28`):** Concentra as requisições de entrada da Internet e realiza o encaminhamento de porta (*Port Forwarding*) para os serviços correspondentes no segmento interno de containers.
*   **Camada de Aplicação e Serviços Internos (Sub-rede `172.20.0.0/24`):**
    *   **Servidor Web Principal (`172.20.0.10`):** Executa o servidor Apache (portas 80 e 8080) com interpretador PHP 7.4.33, hospedando as páginas lógicas `login.php`, `panel.php` e `search.php`.
    *   **Servidor de Banco de Dados (`172.20.0.2`):** Instância interna do MySQL 8.0.44 (porta 3306), configurada com a base de dados `techcorp_db`. Não deve possuir exposição direta à rede WAN, mas responde a requisições originadas do Servidor Web e de usuários locais autorizados.
    *   **Serviço de Arquivos (FTP/vsftpd):** Executa na porta 21 e permite a persistência temporária ou distribuição de artefatos na pasta padrão `/var/www/html/`.
    *   **Serviço de Compartilhamento (Samba):** Atua no compartilhamento de diretórios através de portas SMB tradicionais (139/445).
    *   **Serviço de Monitoramento (SNMP):** Monitora estatísticas de rede e recursos de hardware do container de gerência através da porta UDP 161.
    *   **Acesso Administrativo (SSH):** Exposto na porta não padrão 2222, fornecendo acesso direto ao console shell do sistema Linux Ubuntu 20.04.6 LTS.

---

## 5. Diagnóstico de Exposição

### 5.1. Enumeração de Usuários e Compartilhamentos via SMB (Portas 139/445)
O serviço Samba foi identificado sem restrições adequadas de controle de acesso na rede interna. A varredura utilizando o `Enum4linux-ng` confirmou as seguintes falhas graves:
*   **Sessão Nula (*Null Session*):** O servidor permitiu conexões de convidados sem o fornecimento de credenciais válidas. Isso possibilitou a enumeração da lista completa de usuários do sistema operacional.
*   **Vazamento de Compartilhamentos:** Foi possível listar os caminhos absolutos de diretórios compartilhados de forma pública, permitindo que qualquer máquina presente no segmento Docker acesse arquivos de configuração e scripts internos sem barreira de autenticação.

### 5.2. Vazamento de Informações Sensíveis via SNMP (Porta 161)
O protocolo SNMP foi configurado utilizando a versão obsoleta `v2c`, a qual transmite dados em texto claro. Além disso, identificou-se o uso da *community string* padrão `public`:
*   Através de requisições estruturadas via `Snmpwalk`, pôde-se mapear as interfaces de rede lógicas da rede interna, tabelas de roteamento ARP, caminhos de diretórios do sistema e a lista de processos em execução.
*   Este vazamento fornece a um atacante informações críticas de inteligência sobre o ecossistema interno, facilitando a identificação de novos alvos e a análise de vulnerabilidades de outros serviços sem gerar alertas volumosos nos logs de segurança.

### 5.3. Serviços Vulneráveis e Vetores de Exploração Detectados
A análise cruzada das informações coletadas nas bases de dados extraídas e no histórico revelou múltiplos vetores de ataque ativos:

1.  **Injeção de SQL (SQLi) no painel de Login (`login.php`):**
    O parâmetro `username` enviado via requisição POST é processado de forma insegura pela aplicação PHP ao interagir com o MySQL. Conforme verificado nos logs do utilitário `sqlmap` (consultados retrospectivamente):
    *   Foi possível realizar a extração completa do banco de dados `techcorp_db`.
    *   Foram coletadas tabelas altamente sensíveis como `secret_data` (contendo chaves privadas de API, caminhos de backup em `/var/backups/techcorp/backup_20240115.tar.gz` e flags de validação) e `users` (contendo hashes e senhas em texto plano).
2.  **Inclusão Local de Arquivos (LFI) via `panel.php`:**
    A aplicação expõe o parâmetro `?file=`, que aceita sequências de travessia de diretório (`../../`). Isso permite que um usuário autenticado (ou um atacante que burle a autenticação via SQLi) leia arquivos arbitrários do sistema de arquivos do servidor, como o `/etc/passwd` ou os arquivos de backup gerados pelo sistema, ampliando significativamente a superfície de exposição.
3.  **Configurações de Credenciais Fracas e Histórico Exposto (`.bash_history`):**
    A auditoria identificou que senhas administrativas padrão e segredos de conexões com o MySQL (como o usuário `techcorp_user` com a senha `T3chC0rp_S3cr3t_2024!` e o usuário `root` com a senha `r00t_P4ssw0rd_2024`) foram digitados diretamente no terminal de comandos e salvos no arquivo local de histórico `.bash_history`. Isso anula qualquer controle de criptografia em trânsito ou repúdio de acesso, dado que qualquer comprometimento simples de conta de usuário expõe o acesso total à base de dados.
4.  **Acesso FTP Anônimo Permitido (Porta 21):**
    O daemon do servidor FTP (vsftpd) foi configurado para aceitar autenticações sob a identidade `anonymous`. Esse comportamento permite que arquivos sejam lidos por qualquer agente não identificado na rede corporativa.

---

## 6. Recomendações e Plano de Ação (Abordagem 80/20)

Para mitigar 80% das vulnerabilidades estruturais identificadas com o menor esforço operacional possível, recomenda-se a aplicação imediata do seguinte conjunto de ações de hardening:

### Plano 1: Desativação de Serviços Desnecessários e Acesso Anônimo (Esforço: Baixo | Impacto: Alto)
*   **Desativar FTP Anônimo:** Alterar a diretiva no arquivo de configuração do vsftpd (`/etc/vsftpd.conf`) para `anonymous_enable=NO` e reiniciar o serviço.
*   **Hardening do Samba (SMB):** Desabilitar o suporte a sessões nulas de convidados adicionando a linha `restrict anonymous = 2` na seção global do arquivo de configuração do Samba (`/etc/samba/smb.conf`).
*   **Hardening do SNMP:** Substituir o SNMPv2c pelo **SNMPv3**, que exige autenticação criptografada por usuário (SHA/MD5) e encriptação de tráfego (AES/DES). Se o protocolo não for estritamente necessário para o monitoramento externo, bloquear o acesso à porta UDP 161 no firewall local (IPTables/UFW).

### Plano 2: Correção e Sanitização de Código da Aplicação Web (Esforço: Médio | Impacto: Altíssimo)
*   **Correção de SQL Injection:** Migrar as consultas SQL na aplicação PHP (`login.php`, `search.php`) para utilizar consultas preparadas (**Prepared Statements**) com a extensão PDO ou MySQLi. Exemplo conceitual de correção segura:
    ```php
    $stmt = $pdo->prepare('SELECT id, password, role FROM users WHERE username = :username');
    $stmt->execute(['username' => $input_username]);
    $user = $stmt->fetch();
    ```
*   **Correção de Local File Inclusion (LFI):** Eliminar a passagem de caminhos de arquivos arbitrários via parâmetros de URL no script `panel.php`. Implementar uma lista de permissões estrita (*whitelist*) onde o usuário selecione apenas IDs de páginas predefinidos, impossibilitando travessias de diretórios.

### Plano 3: Higienização de Credenciais e Políticas de Segurança (Esforço: Baixo | Impacto: Médio)
*   **Limpeza de Histórico e Configurações:** Limpar o histórico do console executando `history -c` e garantir que arquivos contendo chaves criptográficas em plaintext (como `.bash_history` antigos, arquivos temporários de dump e backups do banco na pasta `/var/www/html/` ou `/tmp/`) sejam removidos ou movidos para locais isolados com permissões de acesso exclusivas ao usuário `root` (permissão `600` ou `400`).
*   **Rotação Global de Credenciais:** Alterar imediatamente todas as senhas expostas nos dumps (como as contas de banco `techcorp_user` e `backup_user`, e os acessos SSH). Aplicar a obrigatoriedade do uso de chaves criptográficas SSH (RSA/ED25519) e desativar logins baseados em senhas estáticas em `/etc/ssh/sshd_config`.

---

## 7. Visão AI-First: Integração com o Kensei Log Auditor (KLA)

Em cenários onde múltiplos serviços legados ou expostos precisam operar por demandas de negócio, o monitoramento reativo em tempo real torna-se um pilar fundamental da resiliência cibernética. É neste contexto que ferramentas modernas como o **Kensei Log Auditor (KLA)** oferecem automação no fluxo de detecção e resposta a incidentes.

O KLA Agent atua como um agente autônomo de SecOps de baixa latência [14, README.md]. Ao monitorar arquivos críticos de eventos do kernel e logs do sistema operacional (como o `/var/log/auth.log` do Ubuntu host) por meio de um daemon baseado em eventos [14, README.md]:
*   **Detecção de Brute Force e Intrusão:** Tentativas consecutivas de acesso falho nas portas de SSH (2222) ou de FTP seriam detectadas pelo monitor do arquivo de log [14, README.md].
*   **Triagem e Classificação Inteligente:** Através de integrações com grandes modelos de linguagem (Llama 3.1 via Groq Cloud), o KLA processa fragmentos desses logs crus e gera relatórios automáticos classificando a gravidade da ameaça e seu significado tático [20, 14, README.md].
*   **Sugestão de Contramedidas Rápidas:** O agente IA fornece comandos imediatos de mitigação no terminal (ex: regras para inserção no `ufw` ou `iptables` a fim de banir o IP atacante) [20, 14, README.md].

A implementação do KLA Agent no ecossistema da TechCorp Solutions reduziria drasticamente o tempo médio de detecção (MTTD), permitindo que a equipe de Blue Team tome decisões críticas baseadas na filosofia *Human-in-the-Loop* (HITL) [14, README.md], validando as sugestões da inteligência artificial antes de sua aplicação definitiva e evitando potenciais erros de configuração sistêmica [14, README.md].

---

## 8. Conclusão

A avaliação de segurança indicou que a postura defensiva atual da rede simulada apresenta fragilidades estruturais acentuadas, com falhas decorrentes principalmente de desatenção em configurações iniciais de hardening e ausência de práticas seguras de desenvolvimento de software (*Secure Coding*).

No entanto, a infraestrutura sob análise é altamente responsiva a contramedidas simples. A aplicação do plano de ação sugerido (correção de injeções de SQL, isolamento do SNMP/Samba, remoção de arquivos expostos e centralização de monitoramento com suporte de IA) elevará significativamente a resiliência do ambiente Docker, restabelecendo o controle de acesso e protegendo as informações confidenciais do negócio contra vetores comuns de exploração oportunista.

---

## 9. Anexos: Exemplos de Execução no Terminal

Para fins de documentação interna e auditoria, seguem os comandos de referência recomendados para a realização de novas varreduras de conformidade técnica pela equipe de segurança:

### Varredura de Portas TCP Detalhada (Nmap)
```bash
nmap -p 21,22,80,139,445,2222,8080 -sV -sC -Pn -oA /tmp/diagnostico_servicos 98.95.207.28
```
*   **`-sV`**: Habilita a detecção de versão de serviço.
*   **`-sC`**: Executa scripts utilitários padrão da Nmap Scripting Engine.
*   **`-Pn`**: Ignora a descoberta de hosts por ping para evitar bloqueios de ICMP.

### Enumeração do Serviço SNMP (Snmpwalk)
```bash
snmpwalk -v2c -c public 98.95.207.28:161 1.3.6.1.2.1.1
```
*   **`-v2c`**: Define o uso da versão 2c do protocolo SNMP.
*   **`-c public`**: Especifica a community string padrão de leitura de fábrica.
*   **`1.3.6.1.2.1.1`**: OID padrão do sistema (*system group*) para extrair metadados gerais do host.

### Enumeração SMB (Enum4linux-ng)
```bash
enum4linux-ng -A 98.95.207.28
```
*   **`-A`**: Executa todos os testes de enumeração disponíveis, incluindo sessões nulas, descoberta de usuários, compartilhamento de diretórios e políticas de conta.

---
*Fim do Relatório.*