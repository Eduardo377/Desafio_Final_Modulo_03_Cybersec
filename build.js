const fs = require("fs");
const path = require("path");
const { minify } = require("html-minifier-terser"); // Importação desestruturada correta

// Definição dos caminhos dos arquivos
const configPath = path.join(__dirname, ".htmlminifierrc");
const inputHtml = path.join(__dirname, "index.html"); // Altere se o seu arquivo tiver outro nome (ex: admin.php)
const outputHtml = path.join(__dirname, "index.html");

// Função assíncrona para lidar com a Promise do html-minifier-terser
async function executarBuild() {
  try {
    // 1. Validar e ler o arquivo de configuração (.htmlminifierrc)
    if (!fs.existsSync(configPath)) {
      console.error(
        "❌ Erro: Arquivo de configuração .htmlminifierrc não encontrado!",
      );
      process.exit(1);
    }
    const configRaw = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configRaw);

    // 2. Validar e ler o HTML original do laboratório
    if (!fs.existsSync(inputHtml)) {
      console.error(
        `❌ Erro: Arquivo HTML de entrada '${inputHtml}' não encontrado!`,
      );
      console.log(
        "👉 Certifique-se de que o arquivo HTML/PHP do lab está na mesma pasta ou ajuste o caminho no script.",
      );
      process.exit(1);
    }
    const htmlRaw = fs.readFileSync(inputHtml, "utf8");

    console.log(
      "🧹 Iniciando a higienização de segurança do HTML (Removendo comentários)...",
    );

    // 3. Executar a minificação esperando (await) a Promise ser resolvida
    const sanitizedHtml = await minify(htmlRaw, config);

    // 4. Salvar o arquivo limpo
    fs.writeFileSync(outputHtml, sanitizedHtml, "utf8");
    console.log(
      "✅ Sucesso! HTML higienizado com segurança. Todos os comentários de depuração e flags foram removidos.",
    );
  } catch (error) {
    console.error(
      "❌ Ocorreu um erro durante a execução do build de segurança:",
      error.message,
    );
    process.exit(1);
  }
}

// Executa a função do build
executarBuild();