<?php
declare(strict_types=1);

/**
 * Ponte entre o Apache e a API Node do JuridFlow.
 *
 * POR QUE ISTO EXISTE
 *   A hospedagem nao tem Passenger nem Node.js Selector, e o Apache do
 *   usuario nao tem mod_proxy. O Node roda e responde em 127.0.0.1:3001, mas
 *   nada encaminha o trafego externo ate ele. Este arquivo faz esse caminho
 *   em PHP, que a hospedagem executa.
 *
 * LIMITACAO CONHECIDA
 *   E remendo, nao arquitetura. Cada requisicao sobe um processo PHP so para
 *   repassar bytes, o processo Node pode ser morto por limite de recurso a
 *   qualquer momento, e o cron que o ressuscita deixa janela de
 *   indisponibilidade. Para demonstrar o sistema, serve. Para o escritorio
 *   depender disso em controle de prazo, o caminho e Node.js Selector pelo
 *   provedor ou um VPS para o backend. Ver DEPLOY_CPANEL_MYSQL.md.
 *
 * SEGURANCA
 *   O destino e fixo no codigo: host e porta nao vem do pedido, entao nao ha
 *   como usar isto como proxy aberto (SSRF). O caminho e obrigado a comecar
 *   com /api. E o X-Forwarded-For e SOBRESCRITO com o IP real da conexao -
 *   se fosse repassado do cliente, qualquer um forjaria o IP que aparece na
 *   trilha de auditoria LGPD.
 */

const DESTINO_HOST  = '127.0.0.1';
const DESTINO_PORTA = 3001;
const TIMEOUT_SEG   = 30;

/** Responde em JSON e encerra. O frontend espera JSON, nunca HTML. */
function falhar(int $status, string $mensagem, string $codigo): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        ['message' => $mensagem, 'codigo' => $codigo],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit;
}

$caminho = $_SERVER['REQUEST_URI'] ?? '';

// So /api passa. Sem isto, o arquivo viraria proxy para qualquer rota do
// processo Node, inclusive as que nao deveriam ser publicas.
if (strncmp($caminho, '/api', 4) !== 0) {
    falhar(404, 'Rota nao encontrada.', 'ROTA_INVALIDA');
}

if (!function_exists('curl_init')) {
    falhar(500, 'A extensao cURL do PHP nao esta disponivel nesta hospedagem.', 'SEM_CURL');
}

$url = 'http://' . DESTINO_HOST . ':' . DESTINO_PORTA . $caminho;

// --- cabecalhos de entrada -------------------------------------------------
$cabecalhos = [];
$ignorar = [
    'host',               // seria o dominio publico, nao o destino local
    'connection',         // hop-by-hop
    'content-length',     // o cURL recalcula
    'accept-encoding',    // evita resposta comprimida que teriamos de decodificar
    'x-forwarded-for',    // sobrescrito abaixo - nunca confiar no que o cliente manda
    'x-forwarded-proto',
    'x-real-ip',
];

foreach ($_SERVER as $chave => $valor) {
    if (strncmp($chave, 'HTTP_', 5) !== 0) {
        continue;
    }
    $nome = strtolower(str_replace('_', '-', substr($chave, 5)));
    if (in_array($nome, $ignorar, true)) {
        continue;
    }
    $cabecalhos[] = $nome . ': ' . $valor;
}

if (!empty($_SERVER['CONTENT_TYPE'])) {
    $cabecalhos[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
}

// IP real da conexao. O Express esta com trust proxy 1 e o auditLogger le
// este cabecalho primeiro - e dele que sai o IP gravado no AuditLog.
$cabecalhos[] = 'X-Forwarded-For: ' . ($_SERVER['REMOTE_ADDR'] ?? '');
$cabecalhos[] = 'X-Forwarded-Proto: ' . (empty($_SERVER['HTTPS']) ? 'http' : 'https');
$cabecalhos[] = 'X-Forwarded-Host: ' . ($_SERVER['HTTP_HOST'] ?? '');

// --- requisicao ------------------------------------------------------------
$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$corpo  = file_get_contents('php://input');

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST  => $metodo,
    CURLOPT_HTTPHEADER     => $cabecalhos,
    CURLOPT_TIMEOUT        => TIMEOUT_SEG,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_FOLLOWLOCATION => false,
]);

if ($corpo !== '' && $corpo !== false) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $corpo);
}

// Repassa os cabecalhos da resposta, menos os que nao fazem sentido atravessar.
$naoRepassar = ['transfer-encoding', 'connection', 'keep-alive', 'content-length', 'content-encoding'];
curl_setopt($ch, CURLOPT_HEADERFUNCTION, function ($_ch, string $linha) use ($naoRepassar): int {
    $tamanho = strlen($linha);
    $partes = explode(':', $linha, 2);
    if (count($partes) === 2) {
        $nome = strtolower(trim($partes[0]));
        if (!in_array($nome, $naoRepassar, true)) {
            header(trim($partes[0]) . ': ' . trim($partes[1]), false);
        }
    }
    return $tamanho;
});

$resposta = curl_exec($ch);
$status   = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$erroNum  = curl_errno($ch);
$erroMsg  = curl_error($ch);
curl_close($ch);

// --- resposta --------------------------------------------------------------
if ($resposta === false || $erroNum !== 0) {
    // Conexao recusada e o caso comum: o processo Node caiu ou ainda nao
    // subiu. A mensagem precisa dizer isso, nao um erro generico.
    $recusada = in_array($erroNum, [CURLE_COULDNT_CONNECT, CURLE_OPERATION_TIMEDOUT], true);
    falhar(
        503,
        $recusada
            ? 'A API do JuridFlow nao esta respondendo no servidor. '
              . 'O processo pode ter sido reiniciado - tente de novo em instantes.'
            : 'Falha ao falar com a API interna: ' . $erroMsg,
        $recusada ? 'API_FORA' : 'PROXY_ERRO'
    );
}

http_response_code($status ?: 502);
echo $resposta;
