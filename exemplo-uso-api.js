// exemplo-uso-api.js
// Exemplo de como usar a API de análise de jurisprudência - Caso Marcelo Ltda

require('dotenv').config();
const axios = require('axios');

// 🔧 CONFIGURAÇÕES A PARTIR DO ARQUIVO .ENV
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

// 🔑 CHAVES DE API VÁLIDAS - lidas do arquivo .env
const API_KEYS = process.env.API_KEYS
  ? process.env.API_KEYS.split(',').map(k => k.trim()).filter(Boolean)
  : [];

if (API_KEYS.length === 0) {
  console.error('❌ Nenhuma chave de API foi definida no .env. Verifique a variável API_KEYS.');
  process.exit(1);
}

// 📊 CONFIGURAÇÕES DE PROCESSAMENTO (do .env)
const MAX_ACORDAOS = parseInt(process.env.MAX_ACORDAOS) || 50;
const MAX_RESULTADOS = parseInt(process.env.MAX_RESULTADOS) || 10;
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 120000;
const HEALTH_CHECK_TIMEOUT = parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000;
const INFO_TIMEOUT = parseInt(process.env.INFO_TIMEOUT) || 10000;
const AUTH_TEST_TIMEOUT = parseInt(process.env.AUTH_TEST_TIMEOUT) || 5000;

// Usar a primeira chave por padrão
const API_KEY = API_KEYS[0];

// 📋 CASO CONCRETO ESPECÍFICO - Marcelo Ltda
const casoConcreto = `
CASO CONCRETO - LICITAÇÃO EMPRESA MARCELO LTDA

CONTEXTUALIZAÇÃO:
A empresa Marcelo Ltda foi vencedora de licitação pública realizada pelo Governo do Estado do Amazonas em 2025, tendo como objeto o fornecimento de 100 impressoras multifuncionais modelo HP DeskJet Ink 2874, pelo valor total de R$ 23 milhões.

ASPECTOS ESPECÍFICOS PARA ANÁLISE:
1. VALOR DO CONTRATO: R$ 23 milhões para 100 impressoras (R$ 230.000 por impressora)
2. ESPECIFICAÇÃO TÉCNICA: HP DeskJet Ink 2874 (modelo específico)
3. QUANTIDADE: 100 unidades de impressoras multifuncionais
4. CONTRATANTE: Governo do Estado do Amazonas
5. CONTRATADA: Empresa Marcelo Ltda
6. ANO: 2025

PONTOS DE ATENÇÃO PARA JURISPRUDÊNCIA:
- Possível sobrepreço ou superfaturamento no valor unitário das impressoras
- Especificação restritiva de marca e modelo específico (HP DeskJet Ink 2874)
- Direcionamento de licitação para equipamentos de marca específica
- Ausência de pesquisa de preços adequada ou critérios técnicos justificados
- Falta de motivação técnica para exigências específicas de marca/modelo
- Irregularidades em processos licitatórios envolvendo equipamentos de informática
- Critérios desproporcionais que limitam a competitividade
- Dano ao erário decorrente de contratações com preços acima do mercado
- Falhas na fase de planejamento ou especificação técnica da licitação
- Questões relacionadas à capacidade técnica e operacional do fornecedor

OBJETIVO DA CONSULTA:
Buscar precedentes do TCU sobre irregularidades em licitações similares, especialmente relacionadas a:
- Sobrepreço em equipamentos de informática
- Especificações restritivas em editais
- Direcionamento de licitações
- Metodologias de apuração de dano ao erário
- Sanções aplicadas em casos análogos
`;

async function analisarCasoMarceloLtda() {
  try {
    console.log('🏢 ANÁLISE DE JURISPRUDÊNCIA - CASO MARCELO LTDA');
    console.log('📋 Licitação: 100 impressoras HP DeskJet por R$ 23 milhões');
    console.log('🚀 Iniciando consulta aos precedentes do TCU...\n');

    const response = await axios.post(`${API_BASE_URL}/analyze`, {
      casoConcreto: casoConcreto,
      maxAcordaos: MAX_ACORDAOS,
      maxResultados: MAX_RESULTADOS
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        'User-Agent': 'TCU-Analysis-Client/1.0'
      },
      timeout: REQUEST_TIMEOUT
    });

    console.log('✅ Análise concluída com sucesso!');
    console.log(`📊 Status HTTP: ${response.data.code}`);
    console.log(`📋 ${response.data.message}`);
    console.log(`🎯 Precedentes relevantes: ${response.data.data.totalRelevantes}`);
    console.log(`📄 Acórdãos processados: ${response.data.data.totalProcessados}`);
    console.log(`📚 Total disponível: ${response.data.data.totalDisponiveis}`);
    console.log(`⏰ Processado em: ${response.data.data.processedAt}\n`);

    if (response.data.data.acordaosRelevantes.length > 0) {
      console.log('🏛️ PRECEDENTES JURISPRUDENCIAIS RELEVANTES:');
      console.log('='.repeat(80));

      response.data.data.acordaosRelevantes.forEach((acordao, index) => {
        console.log(`\n📖 ${index + 1}. ACÓRDÃO Nº ${acordao.numeroAcordao}/${acordao.anoAcordao}`);
        console.log(`📌 Título: ${acordao.titulo}`);
        console.log(`👨‍⚖️ Relator: ${acordao.relator}`);
        console.log(`📅 Data da Sessão: ${acordao.dataSessao}`);
        console.log(`🏛️ Colegiado: ${acordao.colegiado}`);
        console.log(`📝 Tipo: ${acordao.tipo}`);
        console.log(`\n📋 RESUMO:`);
        console.log(`   ${acordao.resumo}`);
        console.log(`\n🎯 RELEVÂNCIA PARA O CASO:`);
        console.log(`   ${acordao.analiseRelevancia}`);
        console.log(`\n⏰ Processado em: ${acordao.processedAt}`);
        console.log('-'.repeat(80));
      });

      console.log(`\n📊 SUMÁRIO EXECUTIVO:`);
      console.log(`📈 Taxa de relevância: ${((response.data.data.totalRelevantes / response.data.data.totalProcessados) * 100).toFixed(1)}%`);
      console.log(`🔍 Precedentes encontrados: ${response.data.data.totalRelevantes} de ${response.data.data.totalProcessados} analisados`);
    } else {
      console.log('⚠️ Nenhum precedente jurisprudencial relevante foi encontrado para este caso específico.');
      console.log('💡 Sugestões:');
      console.log('   - Ampliar os critérios de busca');
      console.log('   - Aumentar o parâmetro maxAcordaos');
      console.log('   - Revisar a descrição do caso concreto');
    }

    return response.data;
  } catch (error) {
    console.error('\n❌ ERRO NA ANÁLISE:');
    if (error.response) {
      console.error(`📊 Status HTTP: ${error.response.status}`);
      console.error(`🔧 Código do erro: ${error.response.data.code}`);
      console.error(`💬 Mensagem: ${error.response.data.message}`);
      if (error.response.status === 401 || error.response.status === 403) {
        console.error('🔑 Problema de autenticação - verifique a API Key');
      } else if (error.response.status === 429) {
        console.error('⏱️ Limite de requisições atingido - aguarde e tente novamente');
      } else if (error.response.status === 408) {
        console.error('⏰ Timeout - tente com menos acórdãos (maxAcordaos)');
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('⏰ Timeout na requisição - o processamento demorou muito');
      console.error('💡 Tente reduzir maxAcordaos ou maxResultados');
    } else {
      console.error(`🌐 Erro de conexão: ${error.message}`);
    }
  }
}

async function verificarSaudeAPI() {
  try {
    console.log('🏥 Verificando saúde da API...');
    const response = await axios.get(`${API_BASE_URL}/health`, {
      timeout: HEALTH_CHECK_TIMEOUT
    });
    console.log(`✅ ${response.data.message}`);
    console.log(`⏰ Timestamp: ${response.data.timestamp}`);
    return true;
  } catch (error) {
    console.error('❌ API não está respondendo:', error.message);
    return false;
  }
}

async function obterInfoAPI() {
  try {
    console.log('📋 Obtendo informações da API...');
    const response = await axios.get(`${API_BASE_URL}/info`, {
      headers: {
        'X-API-Key': API_KEY
      },
      timeout: INFO_TIMEOUT
    });
    console.log(`✅ API: ${response.data.message}`);
    console.log(`🔢 Versão: ${response.data.version}`);
    console.log(`🔗 Endpoints disponíveis: ${response.data.endpoints.length}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao obter informações:', error.message);
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('🔑 Erro de autenticação: Verifique sua API Key');
    }
    return null;
  }
}

async function testarChavesAPI() {
  console.log('🔐 Testando autenticação com as chaves disponíveis...\n');
  for (let i = 0; i < API_KEYS.length; i++) {
    try {
      const response = await axios.get(`${API_BASE_URL}/info`, {
        headers: {
          'X-API-Key': API_KEYS[i]
        },
        timeout: AUTH_TEST_TIMEOUT
      });
      console.log(`✅ Chave ${i + 1} (${API_KEYS[i].substring(0, 12)}...): VÁLIDA`);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log(`❌ Chave ${i + 1} (${API_KEYS[i].substring(0, 12)}...): INVÁLIDA`);
      } else {
        console.log(`⚠️ Chave ${i + 1} (${API_KEYS[i].substring(0, 12)}...): ERRO - ${error.message}`);
      }
    }
  }
}

function exibirConfiguracoes() {
  console.log('\n📊 CONFIGURAÇÕES ATIVAS:');
  console.log('='.repeat(50));
  console.log(`🌐 URL da API: ${API_BASE_URL}`);
  console.log(`⏰ Request Timeout: ${REQUEST_TIMEOUT}ms`);
  console.log(`📊 Max Acórdãos: ${MAX_ACORDAOS}`);
  console.log(`📋 Max Resultados: ${MAX_RESULTADOS}`);
  console.log(`🏥 Health Check Timeout: ${HEALTH_CHECK_TIMEOUT}ms`);
  console.log(`📋 Info Timeout: ${INFO_TIMEOUT}ms`);
  console.log(`🔐 Auth Test Timeout: ${AUTH_TEST_TIMEOUT}ms`);
  console.log(`🔑 Chaves API configuradas: ${API_KEYS.length}`);
  console.log('='.repeat(50));
}

async function main() {
  console.log('🏛️ SISTEMA DE ANÁLISE DE JURISPRUDÊNCIA TCU');
  console.log('📋 Caso: Marcelo Ltda - Impressoras HP por R$ 23 milhões');
  console.log('='.repeat(80));

  exibirConfiguracoes();

  console.log('\n1️⃣ VERIFICAÇÃO DE CONECTIVIDADE');
  const apiHealth = await verificarSaudeAPI();
  if (!apiHealth) {
    console.error('❌ API não está disponível. Verifique se o servidor está rodando.');
    return;
  }

  console.log('\n2️⃣ VERIFICAÇÃO DE AUTENTICAÇÃO');
  await testarChavesAPI();

  console.log('\n3️⃣ INFORMAÇÕES DA API');
  await obterInfoAPI();

  console.log('\n4️⃣ ANÁLISE JURISPRUDENCIAL');
  await analisarCasoMarceloLtda();

  console.log('\n🏁 ANÁLISE FINALIZADA');
  console.log('='.repeat(80));
}

console.log(`
🔧 EXEMPLOS DE USO COM CURL:

📝 ANÁLISE COMPLETA (Caso Marcelo Ltda):
curl -X POST ${API_BASE_URL}/analyze \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${API_KEY}" \\
  --connect-timeout 30 \\
  --max-time ${REQUEST_TIMEOUT / 1000} \\
  --data '{
    "casoConcreto": "A empresa Marcelo Ltda foi vencedora de licitação pública realizada pelo Governo do Estado do Amazonas em 2025, tendo como objeto o fornecimento de 100 impressoras multifuncionais modelo HP DeskJet Ink 2874, pelo valor total de R$ 23 milhões. Análise de possível sobrepreço e especificação restritiva.",
    "maxAcordaos": ${MAX_ACORDAOS},
    "maxResultados": ${MAX_RESULTADOS}
  }'

📋 VERIFICAR SAÚDE (sem autenticação):
curl --connect-timeout 10 --max-time ${HEALTH_CHECK_TIMEOUT / 1000} ${API_BASE_URL}/health

📋 INFORMAÇÕES DA API (com autenticação):
curl -H "X-API-Key: ${API_KEY}" \\
     --connect-timeout 10 \\
     --max-time ${INFO_TIMEOUT / 1000} \\
     ${API_BASE_URL}/info

🔑 USANDO AUTHORIZATION HEADER:
curl -X POST ${API_BASE_URL}/analyze \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${API_KEY}" \\
  --data '{"casoConcreto":"Caso Marcelo Ltda...","maxAcordaos":${MAX_ACORDAOS}}'

🔀 CHAVES ALTERNATIVAS DISPONÍVEIS:
${API_KEYS.map((key, i) => `   Chave ${i + 1}: ${key.substring(0, 12)}...`).join('\n')}
`);

if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 ERRO FATAL:', error.message);
    process.exit(1);
  });
}

module.exports = {
  analisarCasoMarceloLtda,
  verificarSaudeAPI,
  obterInfoAPI,
  testarChavesAPI,
  exibirConfiguracoes,
  API_KEYS,
  API_KEY,
  casoConcreto,
  API_BASE_URL,
  MAX_ACORDAOS,
  MAX_RESULTADOS,
  REQUEST_TIMEOUT
};
