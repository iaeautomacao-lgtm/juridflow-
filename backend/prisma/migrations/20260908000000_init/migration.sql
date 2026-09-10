-- JuridFlow - schema inicial
--
-- ENGINE = InnoDB e ROW_FORMAT = DYNAMIC sao explicitos de proposito.
--
-- O Prisma nao emite clausula de engine: ele herda o default do servidor. No
-- cPanel usado em producao o default e MyISAM, e isso quebra duas coisas:
--
--   1. Limite de indice de 1000 bytes. Os indices compostos daqui somam
--      1528 bytes (duas colunas VARCHAR(191) em utf8mb4, 764 bytes cada) e a
--      migration falhava com "Specified key was too long" (erro 1071).
--
--   2. MyISAM NAO SUPORTA chave estrangeira. Ele aceita a sintaxe e ignora
--      em silencio. As 19 FKs abaixo, com ON DELETE CASCADE a partir de
--      Tenant, simplesmente nao existiriam - apagar um escritorio deixaria
--      registro orfao em 16 tabelas, sem erro nenhum. O isolamento
--      multi-tenant depende desse cascade.
--
-- O item 2 e o grave: sem ele o banco perde integridade referencial em
-- silencio. InnoDB com ROW_FORMAT DYNAMIC tambem eleva o limite de indice
-- para 3072 bytes, resolvendo o item 1.
--
-- Migration nova gerada pelo Prisma vem SEM engine: conferir antes de
-- aplicar. Ver DEPLOY_CPANEL_MYSQL.md.

-- CreateTable
CREATE TABLE `Tenant` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cnpj` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senha` VARCHAR(191) NOT NULL,
    `cargo` VARCHAR(191) NOT NULL,
    `oab` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Processo` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `cnj` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `cliente` VARCHAR(191) NOT NULL,
    `orgao` VARCHAR(191) NOT NULL,
    `instancia` VARCHAR(191) NOT NULL,
    `vara` VARCHAR(191) NOT NULL,
    `comarca` VARCHAR(191) NOT NULL DEFAULT '',
    `status` VARCHAR(191) NOT NULL,
    `valor_causa` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `partes_json` TEXT NOT NULL,
    `data_distribuicao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `Processo_tenant_id_idx`(`tenant_id`),
    INDEX `Processo_tenant_id_cnj_idx`(`tenant_id`, `cnj`),
    INDEX `Processo_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Atendimento` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `cliente_nome` VARCHAR(191) NOT NULL,
    `telefone` VARCHAR(191) NOT NULL DEFAULT '',
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `assunto` TEXT NOT NULL,
    `fase` VARCHAR(191) NOT NULL,
    `valor_estimado` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `origem` VARCHAR(191) NOT NULL DEFAULT '',
    `data_inicio` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `Atendimento_tenant_id_idx`(`tenant_id`),
    INDEX `Atendimento_tenant_id_fase_idx`(`tenant_id`, `fase`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContratoHonorarios` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `cliente_nome` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `valor_total` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `forma_pagamento` VARCHAR(191) NOT NULL DEFAULT '',
    `tipo` VARCHAR(191) NOT NULL DEFAULT 'contratual',
    `percentual_exito` DECIMAL(5, 2) NULL,
    `status` VARCHAR(191) NOT NULL,
    `data_inicio` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `data_fim` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `ContratoHonorarios_tenant_id_idx`(`tenant_id`),
    INDEX `ContratoHonorarios_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pessoa` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cpf_cnpj` VARCHAR(191) NOT NULL,
    `tipo_cliente` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `telefone` VARCHAR(191) NOT NULL DEFAULT '',
    `endereco` TEXT NULL,
    `cidade_uf` VARCHAR(191) NOT NULL DEFAULT '',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Pessoa_tenant_id_idx`(`tenant_id`),
    INDEX `Pessoa_tenant_id_cpf_cnpj_idx`(`tenant_id`, `cpf_cnpj`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Andamento` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `chave_modulo` VARCHAR(191) NOT NULL,
    `codigo_registro_vinculo` VARCHAR(191) NOT NULL,
    `cnj` VARCHAR(191) NOT NULL DEFAULT '',
    `data` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `orgao` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `cliente` VARCHAR(191) NOT NULL DEFAULT '',
    `descricao` TEXT NOT NULL,
    `fonte` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `lido` BOOLEAN NOT NULL DEFAULT false,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Andamento_tenant_id_idx`(`tenant_id`),
    INDEX `Andamento_tenant_id_chave_modulo_codigo_registro_vinculo_idx`(`tenant_id`, `chave_modulo`, `codigo_registro_vinculo`),
    INDEX `Andamento_tenant_id_lido_idx`(`tenant_id`, `lido`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tarefa` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `chave_modulo` VARCHAR(191) NULL,
    `codigo_registro_vinculo` VARCHAR(191) NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `tipo` VARCHAR(191) NOT NULL DEFAULT 'Prazo',
    `vencimento` DATETIME(3) NOT NULL,
    `prazo_fatal` DATETIME(3) NULL,
    `prioridade` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `responsavel_id` VARCHAR(191) NULL,
    `responsavel_nome` VARCHAR(191) NOT NULL DEFAULT '',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `Tarefa_tenant_id_idx`(`tenant_id`),
    INDEX `Tarefa_tenant_id_chave_modulo_codigo_registro_vinculo_idx`(`tenant_id`, `chave_modulo`, `codigo_registro_vinculo`),
    INDEX `Tarefa_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Documento` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `chave_modulo` VARCHAR(191) NULL,
    `codigo_registro_vinculo` VARCHAR(191) NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `tamanho_bytes` BIGINT NOT NULL DEFAULT 0,
    `url` TEXT NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Documento_tenant_id_idx`(`tenant_id`),
    INDEX `Documento_tenant_id_chave_modulo_codigo_registro_vinculo_idx`(`tenant_id`, `chave_modulo`, `codigo_registro_vinculo`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Financeiro` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `chave_modulo` VARCHAR(191) NULL,
    `codigo_registro_vinculo` VARCHAR(191) NULL,
    `descricao` VARCHAR(191) NOT NULL,
    `valor` DECIMAL(15, 2) NOT NULL,
    `tipo_receita_despesa` VARCHAR(191) NOT NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `data_vencimento` DATETIME(3) NOT NULL,
    `data_pagamento` DATETIME(3) NULL,
    `status_pago` BOOLEAN NOT NULL DEFAULT false,
    `cliente` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `Financeiro_tenant_id_idx`(`tenant_id`),
    INDEX `Financeiro_tenant_id_chave_modulo_codigo_registro_vinculo_idx`(`tenant_id`, `chave_modulo`, `codigo_registro_vinculo`),
    INDEX `Financeiro_tenant_id_tipo_receita_despesa_idx`(`tenant_id`, `tipo_receita_despesa`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Intimacao` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `cnj` VARCHAR(191) NOT NULL,
    `disponibilizacao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publicacao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `orgao` VARCHAR(191) NOT NULL,
    `cliente` VARCHAR(191) NOT NULL DEFAULT '',
    `descricao` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `oab_uf` VARCHAR(191) NOT NULL,
    `fonte` VARCHAR(191) NOT NULL DEFAULT 'djen',
    `id_externo` VARCHAR(191) NULL,
    `processo_id` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Intimacao_tenant_id_idx`(`tenant_id`),
    INDEX `Intimacao_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `Intimacao_processo_id_idx`(`processo_id`),
    UNIQUE INDEX `Intimacao_tenant_id_id_externo_key`(`tenant_id`, `id_externo`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CapturaPush` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `cnj` VARCHAR(191) NOT NULL,
    `orgao` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `grau` VARCHAR(191) NOT NULL,
    `cadastrar_automatico` BOOLEAN NOT NULL DEFAULT true,
    `capturar_docs` BOOLEAN NOT NULL DEFAULT true,
    `ultima_verificacao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ultimo_erro` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CapturaPush_tenant_id_idx`(`tenant_id`),
    INDEX `CapturaPush_tenant_id_cnj_idx`(`tenant_id`, `cnj`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FranquiaCaptura` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `termo_oab` VARCHAR(191) NOT NULL,
    `nome_pesquisado` VARCHAR(191) NOT NULL DEFAULT '',
    `ufs` VARCHAR(191) NOT NULL DEFAULT '',
    `status` VARCHAR(191) NOT NULL,
    `contratadas` INTEGER NOT NULL DEFAULT 100,
    `consumidas` INTEGER NOT NULL DEFAULT 0,
    `valor_mensal` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FranquiaCaptura_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feriado` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NULL,
    `nome` VARCHAR(191) NOT NULL,
    `data` DATE NOT NULL,
    `abrangencia` VARCHAR(191) NOT NULL,
    `uf` VARCHAR(191) NULL,
    `municipio` VARCHAR(191) NULL,
    `orgao` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Feriado_data_idx`(`data`),
    INDEX `Feriado_tenant_id_data_idx`(`tenant_id`, `data`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModeloDocumento` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `conteudo_template_com_variaveis` TEXT NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ModeloDocumento_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `usuario_id` VARCHAR(191) NULL,
    `acao` VARCHAR(191) NOT NULL,
    `entidade` VARCHAR(191) NOT NULL DEFAULT '',
    `entidade_id` VARCHAR(191) NULL,
    `detalhe` TEXT NULL,
    `ip` VARCHAR(191) NOT NULL DEFAULT '',
    `user_agent` TEXT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_tenant_id_idx`(`tenant_id`),
    INDEX `AuditLog_tenant_id_timestamp_idx`(`tenant_id`, `timestamp`),
    INDEX `AuditLog_tenant_id_entidade_entidade_id_idx`(`tenant_id`, `entidade`, `entidade_id`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CertificadoDigital` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `advogado_id` VARCHAR(191) NULL,
    `advogado_nome` VARCHAR(191) NOT NULL,
    `oab` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL DEFAULT 'A1',
    `validade` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CertificadoDigital_tenant_id_idx`(`tenant_id`),
    INDEX `CertificadoDigital_tenant_id_validade_idx`(`tenant_id`, `validade`),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB ROW_FORMAT = DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Processo` ADD CONSTRAINT `Processo_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Atendimento` ADD CONSTRAINT `Atendimento_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContratoHonorarios` ADD CONSTRAINT `ContratoHonorarios_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pessoa` ADD CONSTRAINT `Pessoa_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Andamento` ADD CONSTRAINT `Andamento_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tarefa` ADD CONSTRAINT `Tarefa_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Documento` ADD CONSTRAINT `Documento_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Financeiro` ADD CONSTRAINT `Financeiro_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Intimacao` ADD CONSTRAINT `Intimacao_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Intimacao` ADD CONSTRAINT `Intimacao_processo_id_fkey` FOREIGN KEY (`processo_id`) REFERENCES `Processo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CapturaPush` ADD CONSTRAINT `CapturaPush_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FranquiaCaptura` ADD CONSTRAINT `FranquiaCaptura_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feriado` ADD CONSTRAINT `Feriado_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModeloDocumento` ADD CONSTRAINT `ModeloDocumento_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CertificadoDigital` ADD CONSTRAINT `CertificadoDigital_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CertificadoDigital` ADD CONSTRAINT `CertificadoDigital_advogado_id_fkey` FOREIGN KEY (`advogado_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

