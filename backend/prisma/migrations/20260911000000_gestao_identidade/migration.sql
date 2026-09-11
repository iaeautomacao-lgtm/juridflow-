-- JuridFlow - gestao de identidade
--
-- Escrita a mao, nao gerada pelo `prisma migrate dev`: o ambiente de
-- desenvolvimento nao tem banco, e o Prisma nao emite clausula de engine -
-- herda o default do servidor, que no cPanel de producao e MyISAM. Ver o
-- cabecalho de 20260908000000_init para o estrago que isso causa.

-- ---------------------------------------------------------------------------
-- User: revogacao de sessao e senha provisoria
-- ---------------------------------------------------------------------------
--
-- token_valido_apos: token emitido ANTES deste instante e recusado, mesmo com
-- assinatura valida. E o que torna a revogacao imediata - antes, desativar um
-- usuario ou trocar a senha dele nao derrubava a sessao, e ele seguia dentro
-- por ate 12 horas.
--
-- NULL nas linhas existentes, de proposito: ninguem e deslogado pela
-- migration.
ALTER TABLE `User` ADD COLUMN `token_valido_apos` DATETIME(3) NULL;

-- senha_provisoria: senha definida por outra pessoa (seed, ou redefinicao
-- pelo socio). Enquanto true, o authMiddleware libera apenas a rota de troca
-- de senha.
--
-- FALSE nas linhas existentes para nao trancar ninguem fora no momento do
-- deploy. Os usuarios criados pelo seed compartilham a mesma senha e
-- DEVERIAM ser marcados como provisorios - isso e feito depois do deploy,
-- pela tela de redefinicao ou pelo comando em DOCUMENTACAO.md.
ALTER TABLE `User` ADD COLUMN `senha_provisoria` BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- TentativaLogin: limite de forca bruta
-- ---------------------------------------------------------------------------
--
-- Em tabela e nao em memoria porque esta hospedagem nao tem Passenger: o
-- processo Node e reiniciado pelo cron, e um contador em memoria zeraria a
-- cada reinicio. Um atacante so precisaria esperar.
--
-- Nao ha coluna para a senha tentada, nem hash dela: registrar o que foi
-- digitado transformaria esta tabela num deposito de senhas provaveis dos
-- usuarios, util a quem invadisse o banco.
--
-- Sem chave estrangeira para User: tentativa contra e-mail inexistente
-- tambem precisa contar, senao varrer quais contas existem sai de graca.
CREATE TABLE `TentativaLogin` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NOT NULL,
    `sucesso` BOOLEAN NOT NULL DEFAULT false,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TentativaLogin_email_criado_em_idx`(`email`, `criado_em`),
    INDEX `TentativaLogin_ip_criado_em_idx`(`ip`, `criado_em`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
