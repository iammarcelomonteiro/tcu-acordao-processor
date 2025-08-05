// exemplo-uso-api.js
// Exemplo de como usar a API de análise de jurisprudência

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

// Exemplo de caso concreto
const casoConcreto = `
Análise de caso sob a jurisdição do Tribunal de Contas do Estado do Amazonas
envolvendo irregularidades na administração pública, especificamente relacionadas a:
- Direcionamento ou favorecimento indevido a terceiros
- Ausência de justificativa técnica adequada para decisões administrativas
- Sobrepreço ou superfaturamento identificado
- Questionamentos sobre habilitação técnica ou capacidade operacional
- Especificações ou critérios restritivos que limitam a competitividade
- Falta de motivação adequada para exigências específicas
- Critérios desproporcionais ou inadequados em processos administrativos
- Irregularidades que causem prejuízo ao erário público
`;

async function exemploUsoAPI() {
  try {
    console.log('🚀 Iniciando análise...');
    
    // Fazer requisição para a API
    const response = await axios.post(`${API_BASE_URL}/analyze`, {
      casoConcreto: casoConcreto,
      maxAcordaos: 50,     // Máximo de 50 acórdãos para analisar
      maxResultados: 5     // Máximo de 5 resultados relevantes
    });

    console.log('✅ Análise concluída!');
    console.log(`📊 Status: ${response.data.code}`);
    console.log(`📋 Mensagem: ${response.data.message}`);
    console.log(`🎯 Acórdãos relevantes encontrados: ${response.data.data.totalRelevantes}`);
    console.log(`📄 Total processados: ${response.data.data.totalProcessados}`);

    // Exibir resultados
    if (response.data.data.acordaosRelevantes.length > 0) {
      console.log('\n📚 JURISPRUDÊNCIAS RELEVANTES:');
      response.data.data.acordaosRelevantes.forEach((acordao, index) => {
        console.log(`\n${index + 1}. Acórdão ${acordao.numeroAcordao}/${acordao.anoAcordao}`);
        console.log(`   Título: ${acordao.titulo}`);
        console.log(`   Relator: ${acordao.relator}`);
        console.log(`   Resumo: ${acordao.resumo}`);
        console.log(`   Análise: ${acordao.analiseRelevancia}`);
      });
    }

  } catch (error) {
    if (error.response) {
      // Erro da API
      console.error('❌ Erro da API:');
      console.error(`   Status: ${error.response.data.code}`);
      console.error(`   Mensagem: ${error.response.data.message}`);
    } else {
      // Erro de rede ou outro
      console.error('❌ Erro:', error.message);
    }
  }
}

// Exemplo de verificação de saúde da API
async function verificarSaudeAPI() {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ API está funcionando:', response.data.message);
  } catch (error) {
    console.error('❌ API não está respondendo:', error.message);
  }
}

// Exemplo de obter informações da API
async function obterInfoAPI() {
  try {
    const response = await axios.get(`${API_BASE_URL}/info`);
    console.log('📋 Informações da API:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Erro ao obter informações:', error.message);
  }
}

// Executar exemplos
async function main() {
  console.log('🔧 Testando API de Análise de Jurisprudência TCU\n');
  
  // 1. Verificar se API está funcionando
  console.log('1. Verificando saúde da API...');
  await verificarSaudeAPI();
  
  // 2. Obter informações da API
  console.log('\n2. Obtendo informações da API...');
  await obterInfoAPI();
  
  // 3. Exemplo de análise
  console.log('\n3. Executando análise de jurisprudência...');
  await exemploUsoAPI();
}

// Para usar com curl (exemplo):
console.log(`
📝 EXEMPLO COM CURL:

curl -X POST ${API_BASE_URL}/analyze \\
  -H "Content-Type: application/json" \\
  -d '{
    "casoConcreto": "Seu caso concreto aqui (mínimo 50 caracteres)...",
    "maxAcordaos": 20,
    "maxResultados": 3
  }'

📋 VERIFICAR SAÚDE:
curl ${API_BASE_URL}/health

📋 OBTER INFORMAÇÕES:
curl ${API_BASE_URL}/info
`);

// Executar se for chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { exemploUsoAPI, verificarSaudeAPI, obterInfoAPI };