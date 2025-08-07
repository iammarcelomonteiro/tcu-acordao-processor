const express = require('express');
const cors = require('cors');
const axios = require('axios');
const pdf = require('pdf-parse');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Verificação de dependências
let GoogleGenerativeAI, OpenAI;

try {
  ({ GoogleGenerativeAI } = require('@google/generative-ai'));
} catch (error) {
  console.error('❌ Módulo @google/generative-ai não encontrado. Execute: npm install @google/generative-ai');
}

try {
  OpenAI = require('openai');
} catch (error) {
  console.warn('⚠️ Módulo openai não encontrado. OpenAI será desabilitada.');
  OpenAI = null;
}

// Carregar variáveis de ambiente
require('dotenv').config();

// Validar variáveis de ambiente obrigatórias
if (!process.env.GEMINI_KEYS) {
  console.error('❌ ERRO: Variável GEMINI_KEYS não encontrada no arquivo .env');
  console.error('   Adicione: GEMINI_KEYS=sua_chave1,sua_chave2');
  process.exit(1);
}

if (!process.env.API_KEYS) {
  console.error('❌ ERRO: Variável API_KEYS não encontrada no arquivo .env');
  console.error('   Adicione: API_KEYS=chave1,chave2,chave3');
  process.exit(1);
}

// Configuração das chaves (lidas do arquivo .env)
const GEMINI_KEYS = process.env.GEMINI_KEYS.split(',').map(key => key.trim()).filter(key => key.length > 0);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const VALID_API_KEYS = process.env.API_KEYS.split(',').map(key => key.trim()).filter(key => key.length > 0);

// Validar se as chaves foram carregadas corretamente
if (GEMINI_KEYS.length === 0) {
  console.error('❌ ERRO: Nenhuma chave válida encontrada em GEMINI_KEYS');
  process.exit(1);
}

if (VALID_API_KEYS.length === 0) {
  console.error('❌ ERRO: Nenhuma chave válida encontrada em API_KEYS');
  process.exit(1);
}

console.log(`🔑 ${GEMINI_KEYS.length} chave(s) Gemini carregada(s)`);
console.log(`🔑 ${VALID_API_KEYS.length} chave(s) de API carregada(s)`);
if (OPENAI_API_KEY) {
  console.log('🔑 Chave OpenAI carregada');
} else {
  console.log('⚠️ Chave OpenAI não encontrada - apenas Gemini será usado');
}

// Diretório temporário para PDFs
const TEMP_DIR = path.join(__dirname, 'temp_pdfs');

class TCUAnalysisService {
  constructor() {
    this.currentGeminiKeyIndex = 0;
    this.geminiKeysExhausted = false;
    this.genAI = null;
    this.openai = null;
    this.downloadedFiles = new Set(); // Track para arquivos baixados
    this.initializeService();
  }

  async initializeService() {
    // Criar diretório temporário se não existir
    await this.ensureTempDir();
    // Inicializar serviços de IA
    this.initializeAI();
  }

  async ensureTempDir() {
    try {
      // Verificar se o diretório já existe
      try {
        const stats = await fs.stat(TEMP_DIR);
        if (stats.isDirectory()) {
          console.log(`📁 Diretório temporário já existe: ${TEMP_DIR}`);
          return;
        }
      } catch (error) {
        // Diretório não existe, será criado
      }

      // Criar o diretório recursivamente
      await fs.mkdir(TEMP_DIR, { recursive: true });
      console.log(`📁 Diretório temporário criado: ${TEMP_DIR}`);

      // Verificar permissões de escrita
      await fs.access(TEMP_DIR, fs.constants.W_OK);
      console.log('✅ Permissões de escrita verificadas no diretório temporário');

    } catch (error) {
      console.error('❌ Erro ao criar/verificar diretório temporário:', error.message);
      console.error('   Certifique-se de que a aplicação tem permissões para criar diretórios');
      process.exit(1);
    }
  }

  initializeAI() {
    // Inicializar Gemini
    if (!this.geminiKeysExhausted && this.currentGeminiKeyIndex < GEMINI_KEYS.length) {
      try {
        const currentKey = GEMINI_KEYS[this.currentGeminiKeyIndex];
        this.genAI = new GoogleGenerativeAI(currentKey);
        console.log(`🤖 Gemini inicializado com chave ${this.currentGeminiKeyIndex + 1}/${GEMINI_KEYS.length}`);
      } catch (error) {
        console.error('❌ Erro ao inicializar Gemini:', error.message);
      }
    }

    // Inicializar OpenAI
    if (OpenAI && OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: OPENAI_API_KEY,
        });
        console.log('🤖 OpenAI inicializada como fallback');
      } catch (error) {
        console.error('❌ Erro ao inicializar OpenAI:', error.message);
      }
    }
  }

  async switchToNextGeminiKey() {
    this.currentGeminiKeyIndex++;
    if (this.currentGeminiKeyIndex >= GEMINI_KEYS.length) {
      this.geminiKeysExhausted = true;
      console.log('⚠️ Todas as chaves Gemini foram esgotadas');
      return false;
    }
    
    try {
      const currentKey = GEMINI_KEYS[this.currentGeminiKeyIndex];
      this.genAI = new GoogleGenerativeAI(currentKey);
      console.log(`🔄 Alternando para chave Gemini ${this.currentGeminiKeyIndex + 1}/${GEMINI_KEYS.length}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao alternar chave Gemini:', error.message);
      return false;
    }
  }

  async generateWithGemini(prompt, maxRetries = null) {
    const maxAttempts = maxRetries || GEMINI_KEYS.length;
    let attempts = 0;

    while (attempts < maxAttempts && !this.geminiKeysExhausted) {
      try {
        if (!this.genAI) {
          throw new Error('Gemini não inicializada');
        }

        const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (error) {
        attempts++;
        console.warn(`⚠️ Tentativa ${attempts} com Gemini falhou:`, error.message);
        
        if (attempts < maxAttempts) {
          const switched = await this.switchToNextGeminiKey();
          if (!switched) break;
          
          // Pausa entre tentativas
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    throw new Error(`Todas as ${attempts} tentativas com Gemini falharam`);
  }

  async generateWithOpenAI(prompt) {
    if (!this.openai) {
      throw new Error('OpenAI não está configurada');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      });

      return response.choices[0].message.content;
    } catch (error) {
      throw new Error(`Erro na OpenAI: ${error.message}`);
    }
  }

  async generateAIResponse(prompt) {
    // Tentar Gemini primeiro
    try {
      if (!this.geminiKeysExhausted) {
        return await this.generateWithGemini(prompt);
      }
    } catch (error) {
      console.warn('⚠️ Gemini falhou, tentando OpenAI...');
    }

    // Fallback para OpenAI
    try {
      if (this.openai) {
        return await this.generateWithOpenAI(prompt);
      }
    } catch (error) {
      console.error('❌ OpenAI também falhou:', error.message);
    }

    throw new Error('Falha em todos os provedores de IA disponíveis (Gemini e OpenAI)');
  }

  async fetchAcordaos(maxAcordaos = 1000) {
    try {
      console.log(`🔍 Buscando até ${maxAcordaos} acórdãos do TCU...`);
      
      const response = await axios.get(
        `https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos?inicio=0&quantidade=${maxAcordaos}`,
        {
          timeout: 60000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      const acordaos = response.data || [];
      console.log(`📊 ${acordaos.length} acórdãos recuperados da API do TCU`);
      
      return acordaos;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout na busca de acórdãos do TCU');
      }
      throw new Error(`Erro ao buscar acórdãos: ${error.message}`);
    }
  }

  generateFileName(url, numeroAcordao) {
    // Gerar nome único para o arquivo usando hash
    const hash = crypto.createHash('md5').update(url + numeroAcordao + Date.now()).digest('hex').substring(0, 8);
    return `acordao_${numeroAcordao}_${hash}.pdf`;
  }

  async downloadPDF(url, numeroAcordao) {
    const fileName = this.generateFileName(url, numeroAcordao);
    const filePath = path.join(TEMP_DIR, fileName);

    try {
      // Verificar se o arquivo já foi baixado recentemente
      try {
        await fs.access(filePath);
        console.log(`📄 PDF já existe: ${fileName}`);
        this.downloadedFiles.add(filePath);
        return filePath;
      } catch {
        // Arquivo não existe, fazer download
      }

      console.log(`⬇️ Baixando PDF: ${numeroAcordao}...`);
      
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf,*/*'
        }
      });

      // Salvar arquivo temporariamente
      const writer = require('fs').createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Verificar se o arquivo foi baixado corretamente
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        throw new Error('Arquivo PDF baixado está vazio');
      }

      this.downloadedFiles.add(filePath);
      console.log(`✅ PDF baixado com sucesso: ${fileName} (${(stats.size / 1024).toFixed(2)} KB)`);
      return filePath;

    } catch (error) {
      // Tentar remover arquivo parcialmente baixado
      try {
        await fs.unlink(filePath);
      } catch {} // Ignorar erro se arquivo não existir

      if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout no download do PDF');
      }
      throw new Error(`Erro ao baixar PDF: ${error.message}`);
    }
  }

  async extractTextFromPDF(filePath) {
    try {
      console.log(`📖 Extraindo texto do PDF: ${path.basename(filePath)}`);
      
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      
      if (!data.text || data.text.trim().length === 0) {
        throw new Error('PDF não contém texto extraível');
      }
      
      console.log(`✅ Texto extraído: ${data.text.length} caracteres`);
      return data.text;
    } catch (error) {
      throw new Error(`Erro ao extrair texto do PDF: ${error.message}`);
    }
  }

  async deletePDFFile(filePath) {
    try {
      await fs.unlink(filePath);
      this.downloadedFiles.delete(filePath);
      console.log(`🗑️ PDF removido: ${path.basename(filePath)}`);
    } catch (error) {
      console.warn(`⚠️ Erro ao remover PDF ${path.basename(filePath)}:`, error.message);
    }
  }

  async cleanupDownloadedFiles() {
    if (this.downloadedFiles.size === 0) {
      return;
    }

    console.log(`🧹 Limpando ${this.downloadedFiles.size} arquivo(s) temporário(s)...`);
    
    const cleanupPromises = Array.from(this.downloadedFiles).map(filePath => 
      this.deletePDFFile(filePath)
    );

    await Promise.allSettled(cleanupPromises);
    
    // Tentar remover o diretório temporário se estiver vazio
    try {
      const files = await fs.readdir(TEMP_DIR);
      if (files.length === 0) {
        await fs.rmdir(TEMP_DIR);
        console.log(`🗂️ Diretório temporário removido`);
      }
    } catch (error) {
      // Ignorar erro se o diretório não estiver vazio ou não existir
    }
  }

  async generateSummary(text) {
    const prompt = `
Faça um resumo conciso em até 2 linhas do seguinte documento jurídico do TCU:

${text.substring(0, 8000)}

FOQUE ESPECIFICAMENTE em:
- Qual foi a irregularidade ou problema na administração pública identificado
- Qual foi a decisão/orientação do TCU sobre o caso
- Se houver, o impacto financeiro, prejuízo ao erário ou sanção aplicada

Resposta em português, sendo direto e objetivo nos pontos principais.
`;

    return await this.generateAIResponse(prompt);
  }

  async analyzeCaseRelevance(text, casoConcreto) {
    const prompt = `
CASO CONCRETO ESPECÍFICO:
${casoConcreto}

JURISPRUDÊNCIA DO TCU PARA ANÁLISE:
${text.substring(0, 8000)}

CRITÉRIOS RIGOROSOS DE RELEVÂNCIA:
Para ser considerada RELEVANTE, a jurisprudência deve atender a PELO MENOS 3 dos seguintes 6 critérios específicos (≥ 50 %):

1. VIOLAÇÃO DE PRINCÍPIOS DA ADMINISTRAÇÃO PÚBLICA:
   - Ilegalidade, impessoalidade, moralidade, publicidade ou eficiência.

2. IRREGULARIDADES EM CONTRATAÇÕES E LICITAÇÕES:
   - Direcionamento de editais, critérios restritivos, dispensa ou inexigibilidade sem fundamentação adequada, pesquisa de preços falha.

3. DANO AO ERÁRIO E ASPECTOS ECONÔMICO-FINANCEIROS:
   - Sobrepreço, superfaturamento, renúncia injustificada de receita, metodologia de cálculo do dano.

4. DEFICIÊNCIAS DE CONTROLE INTERNO E GOVERNANÇA:
   - Ausência de controles internos, falha na prestação de contas, conflito de interesses, opacidade de informações.

5. GESTÃO DE PESSOAL E FOLHA DE PAGAMENTO:
   - Admissão sem concurso, terceirização irregular, pagamentos indevidos, contribuições previdenciárias.

6. PRECEDENTE JURÍDICO COM APLICABILIDADE ESPECÍFICA:
   - Fixação de entendimento, parâmetro objetivo ou metodologia aplicável a casos análogos.

RESPOSTA OBRIGATÓRIA:
Se atender rigorosamente aos critérios, responda EXATAMENTE:
RELEVANTE: [Critérios atendidos: X, Y, Z] - [Explicação específica em até 2 linhas sobre como a jurisprudência se aplica diretamente às irregularidades do caso concreto]

Caso contrário, responda EXATAMENTE:
NÃO RELACIONADO
`;

    return await this.generateAIResponse(prompt);
  }

  isRelevant(analysisText) {
    return analysisText &&
      analysisText.trim().toUpperCase().startsWith('RELEVANTE:') &&
      !analysisText.trim().toUpperCase().includes('NÃO RELACIONADO');
  }

  async processAcordao(acordao, casoConcreto) {
    if (!acordao.urlArquivoPdf) {
      throw new Error('URL do PDF não disponível para este acórdão');
    }

    let filePath = null;

    try {
      // Baixar PDF
      filePath = await this.downloadPDF(acordao.urlArquivoPdf, acordao.numeroAcordao);

      // Extrair texto
      const text = await this.extractTextFromPDF(filePath);

      if (!text || text.trim().length === 0) {
        throw new Error('Não foi possível extrair texto do PDF');
      }

      // Gerar resumo
      const summary = await this.generateSummary(text);

      // Analisar relevância
      const relevanceAnalysis = await this.analyzeCaseRelevance(text, casoConcreto);

      return {
        numeroAcordao: acordao.numeroAcordao,
        titulo: acordao.titulo,
        anoAcordao: acordao.anoAcordao,
        relator: acordao.relator,
        tipo: acordao.tipo,
        dataSessao: acordao.dataSessao,
        colegiado: acordao.colegiado,
        resumo: summary,
        analiseRelevancia: relevanceAnalysis,
        isRelevant: this.isRelevant(relevanceAnalysis),
        processedAt: new Date().toISOString()
      };

    } catch (error) {
      throw error;
    } finally {
      // Remover o arquivo PDF após processamento (independente de sucesso ou erro)
      if (filePath && this.downloadedFiles.has(filePath)) {
        await this.deletePDFFile(filePath);
      }
    }
  }
}

// Configuração da API
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 requisições por IP por janela de tempo
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente em 15 minutos.',
    code: 429
  }
});

app.use('/api/', limiter);

// Middleware de autenticação
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API Key é obrigatória. Inclua no header X-API-Key ou Authorization',
      code: 401
    });
  }

  if (!VALID_API_KEYS.includes(apiKey)) {
    return res.status(403).json({
      success: false,
      message: 'API Key inválida ou não autorizada',
      code: 403
    });
  }

  // Log de uso (opcional)
  console.log(`🔑 Acesso autorizado com API Key: ${apiKey.substring(0, 8)}...`);
  
  next();
};

// Middleware de validação
const validateRequest = (req, res, next) => {
  const { casoConcreto, maxAcordaos, maxResultados } = req.body;

  // Validação do caso concreto
  if (!casoConcreto) {
    return res.status(400).json({
      success: false,
      message: 'Campo "casoConcreto" é obrigatório',
      code: 400
    });
  }

  if (typeof casoConcreto !== 'string' || casoConcreto.trim().length < 50) {
    return res.status(400).json({
      success: false,
      message: 'Campo "casoConcreto" deve ser uma string com pelo menos 50 caracteres',
      code: 400
    });
  }

  // Validação do maxAcordaos
  if (maxAcordaos !== undefined) {
    if (!Number.isInteger(maxAcordaos) || maxAcordaos < 1 || maxAcordaos > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Campo "maxAcordaos" deve ser um número inteiro entre 1 e 10000',
        code: 400
      });
    }
  }

  // Validação do maxResultados
  if (maxResultados !== undefined) {
    if (!Number.isInteger(maxResultados) || maxResultados < 1 || maxResultados > 100) {
      return res.status(400).json({
        success: false,
        message: 'Campo "maxResultados" deve ser um número inteiro entre 1 e 100',
        code: 400
      });
    }
  }

  next();
};

// Middleware de tratamento de erros
const errorHandler = (error, req, res, next) => {
  console.error('Erro capturado:', error);

  // Erro de timeout
  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return res.status(408).json({
      success: false,
      message: 'Timeout na operação. Tente novamente com menos acórdãos.',
      code: 408
    });
  }

  // Erro de rede
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      message: 'Serviço temporariamente indisponível. Tente novamente mais tarde.',
      code: 503
    });
  }

  // Erro de cota da API
  if (error.message.includes('quota') || error.message.includes('rate limit')) {
    return res.status(429).json({
      success: false,
      message: 'Cota de API excedida. Tente novamente mais tarde.',
      code: 429
    });
  }

  // Erro de IA
  if (error.message.includes('IA') || error.message.includes('Gemini') || error.message.includes('OpenAI')) {
    return res.status(502).json({
      success: false,
      message: 'Erro no serviço de IA. Tente novamente mais tarde.',
      code: 502
    });
  }

  // Erro genérico do servidor
  return res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    code: 500,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// Instância do serviço (inicialização assíncrona)
let tcuService = null;

// Função para inicializar o serviço
async function initializeTCUService() {
  try {
    tcuService = new TCUAnalysisService();
    await tcuService.initializeService();
    console.log('✅ Serviço TCU inicializado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar serviço TCU:', error.message);
    process.exit(1);
  }
}

// Middleware para verificar se o serviço foi inicializado
const ensureServiceInitialized = (req, res, next) => {
  if (!tcuService) {
    return res.status(503).json({
      success: false,
      message: 'Serviço ainda está inicializando. Tente novamente em alguns segundos.',
      code: 503
    });
  }
  next();
};

// Rota principal da API (protegida)
app.post('/api/analyze', authenticateApiKey, validateRequest, ensureServiceInitialized, async (req, res, next) => {
  try {
    const { 
      casoConcreto, 
      maxAcordaos = 100, 
      maxResultados = 10 
    } = req.body;

    console.log(`📊 Iniciando análise: maxAcordaos=${maxAcordaos}, maxResultados=${maxResultados}`);

    // Buscar acórdãos
    const acordaos = await tcuService.fetchAcordaos(maxAcordaos);

    if (!acordaos || acordaos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum acórdão encontrado na base de dados do TCU',
        code: 404
      });
    }

    const relevantCases = [];
    let processedCount = 0;

    try {
      // Processar acórdãos até atingir o limite de resultados
      for (const acordao of acordaos) {
        if (relevantCases.length >= maxResultados) {
          break;
        }

        try {
          const processedCase = await tcuService.processAcordao(acordao, casoConcreto);
          processedCount++;

          if (processedCase.isRelevant) {
            relevantCases.push({
              numeroAcordao: processedCase.numeroAcordao,
              titulo: processedCase.titulo,
              anoAcordao: processedCase.anoAcordao,
              relator: processedCase.relator,
              tipo: processedCase.tipo,
              dataSessao: processedCase.dataSessao,
              colegiado: processedCase.colegiado,
              resumo: processedCase.resumo,
              analiseRelevancia: processedCase.analiseRelevancia,
              processedAt: processedCase.processedAt
            });

            console.log(`✅ Caso relevante encontrado: ${processedCase.numeroAcordao}`);
          }

          // Pequena pausa entre processamentos
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`❌ Erro ao processar acórdão ${acordao.numeroAcordao}:`, error.message);
          processedCount++;
          continue; // Continua com o próximo acórdão
        }
      }
    } finally {
      // Garantir limpeza de arquivos restantes
      await tcuService.cleanupDownloadedFiles();
    }

    // Resposta de sucesso
    res.status(200).json({
      success: true,
      message: 'Análise concluída com sucesso',
      code: 200,
      data: {
        acordaosRelevantes: relevantCases,
        totalRelevantes: relevantCases.length,
        totalProcessados: processedCount,
        totalDisponiveis: acordaos.length,
        casoConcreto: casoConcreto,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    // Em caso de erro, também limpar arquivos
    if (tcuService) {
      await tcuService.cleanupDownloadedFiles();
    }
    next(error);
  }
});

// Rota de healthcheck
app.get('/api/health', (req, res) => {
  const isServiceReady = tcuService !== null;
  
  res.status(isServiceReady ? 200 : 503).json({
    success: isServiceReady,
    message: isServiceReady ? 'API funcionando corretamente' : 'API inicializando',
    code: isServiceReady ? 200 : 503,
    timestamp: new Date().toISOString(),
    services: {
      gemini: !tcuService?.geminiKeysExhausted && tcuService?.genAI !== null,
      openai: tcuService?.openai !== null,
      tempDir: true // Sempre true após inicialização
    }
  });
});

// Rota de informações da API (protegida)
app.get('/api/info', authenticateApiKey, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API de Análise de Jurisprudência TCU',
    version: '1.1.0',
    endpoints: [
      {
        method: 'POST',
        path: '/api/analyze',
        description: 'Analisa jurisprudências do TCU baseado em um caso concreto',
        parameters: {
          casoConcreto: 'string (obrigatório, min 50 chars)',
          maxAcordaos: 'integer (opcional, 1-10000, default: 100)',
          maxResultados: 'integer (opcional, 1-100, default: 10)'
        },
        headers: {
          'X-API-Key': 'string (obrigatório) - Sua chave de API',
          'Content-Type': 'application/json'
        }
      },
      {
        method: 'GET',
        path: '/api/health',
        description: 'Verifica o status da API e serviços conectados'
      },
      {
        method: 'GET',
        path: '/api/info',
        description: 'Informações sobre a API e endpoints disponíveis',
        headers: {
          'X-API-Key': 'string (obrigatório) - Sua chave de API'
        }
      }
    ],
    configuration: {
      geminiKeys: GEMINI_KEYS.length,
      openaiEnabled: !!OPENAI_API_KEY,
      tempDirectory: TEMP_DIR,
      validApiKeys: VALID_API_KEYS.length
    },
    code: 200
  });
});

// Middleware de erro deve ser o último
app.use(errorHandler);

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    code: 404,
    availableEndpoints: [
      'POST /api/analyze',
      'GET /api/health',
      'GET /api/info'
    ]
  });
});

// Limpeza ao encerrar o processo
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando aplicação...');
  if (tcuService) {
    await tcuService.cleanupDownloadedFiles();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Encerrando aplicação...');
  if (tcuService) {
    await tcuService.cleanupDownloadedFiles();
  }
  process.exit(0);
});

// Inicializar aplicação
async function startServer() {
  try {
    // Primeiro inicializar o serviço
    await initializeTCUService();
    
    // Depois iniciar o servidor
    app.listen(PORT, () => {
      console.log(`🚀 API rodando na porta ${PORT}`);
      console.log(`📋 Documentação: http://localhost:${PORT}/api/info`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📁 Diretório temporário: ${TEMP_DIR}`);
      console.log(`🔑 ${GEMINI_KEYS.length} chave(s) Gemini carregada(s)`);
      console.log(`🔑 ${VALID_API_KEYS.length} chave(s) de API carregada(s)`);
      if (OPENAI_API_KEY) {
        console.log(`🔑 OpenAI habilitada como fallback`);
      }
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error.message);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();

module.exports = app;