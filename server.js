const express = require('express');
const cors = require('cors');
const axios = require('axios');
const pdf = require('pdf-parse');
const rateLimit = require('express-rate-limit');

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

// Configuração das chaves (use variáveis de ambiente em produção)
const GEMINI_KEYS = process.env.GEMINI_KEYS ? 
  process.env.GEMINI_KEYS.split(',') : 
  [
    'AIzaSyCHrp5HaoB5vdOPzQISzUSizrCjrBzc3oU',
    'AIzaSyB9Jy9VsA_DAG9P8w4fon6Nq38pC1UGerY'
  ];

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 
  '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';

class TCUAnalysisService {
  constructor() {
    this.currentGeminiKeyIndex = 0;
    this.geminiKeysExhausted = false;
    this.genAI = null;
    this.openai = null;
    this.initializeAI();
  }

  initializeAI() {
    // Inicializar Gemini
    if (!this.geminiKeysExhausted && this.currentGeminiKeyIndex < GEMINI_KEYS.length) {
      try {
        this.genAI = new GoogleGenerativeAI(GEMINI_KEYS[this.currentGeminiKeyIndex]);
      } catch (error) {
        console.error('❌ Erro ao inicializar Gemini:', error.message);
      }
    }

    // Inicializar OpenAI
    if (OpenAI && OPENAI_API_KEY && OPENAI_API_KEY !== 'your-openai-api-key-here') {
      try {
        this.openai = new OpenAI({
          apiKey: OPENAI_API_KEY,
        });
      } catch (error) {
        console.error('❌ Erro ao inicializar OpenAI:', error.message);
      }
    }
  }

  async switchToNextGeminiKey() {
    this.currentGeminiKeyIndex++;
    if (this.currentGeminiKeyIndex >= GEMINI_KEYS.length) {
      this.geminiKeysExhausted = true;
      return false;
    }
    this.genAI = new GoogleGenerativeAI(GEMINI_KEYS[this.currentGeminiKeyIndex]);
    return true;
  }

  async generateWithGemini(prompt, maxRetries = null) {
    const maxAttempts = maxRetries || GEMINI_KEYS.length;
    let attempts = 0;

    while (attempts < maxAttempts && !this.geminiKeysExhausted) {
      try {
        const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          const switched = await this.switchToNextGeminiKey();
          if (!switched) break;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    throw new Error('Todas as tentativas com Gemini falharam');
  }

  async generateWithOpenAI(prompt) {
    if (!this.openai) {
      throw new Error('OpenAI não está configurada');
    }

    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    });

    return response.choices[0].message.content;
  }

  async generateAIResponse(prompt) {
    try {
      if (!this.geminiKeysExhausted) {
        return await this.generateWithGemini(prompt);
      }
    } catch (error) {
      // Fallback para OpenAI
    }

    try {
      return await this.generateWithOpenAI(prompt);
    } catch (error) {
      throw new Error('Falha em todos os provedores de IA disponíveis');
    }
  }

  async fetchAcordaos(maxAcordaos = 1000) {
    try {
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

      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout na busca de acórdãos');
      }
      throw new Error(`Erro ao buscar acórdãos: ${error.message}`);
    }
  }

  async downloadPDF(url) {
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      return Buffer.from(response.data);
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout no download do PDF');
      }
      throw new Error(`Erro ao baixar PDF: ${error.message}`);
    }
  }

  async extractTextFromPDF(pdfBuffer) {
    try {
      const data = await pdf(pdfBuffer);
      return data.text;
    } catch (error) {
      throw new Error(`Erro ao extrair texto do PDF: ${error.message}`);
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

    // Baixar PDF
    const pdfBuffer = await this.downloadPDF(acordao.urlArquivoPdf);

    // Extrair texto
    const text = await this.extractTextFromPDF(pdfBuffer);

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

// Instância do serviço
const tcuService = new TCUAnalysisService();

// Rota principal da API
app.post('/api/analyze', validateRequest, async (req, res, next) => {
  try {
    const { 
      casoConcreto, 
      maxAcordaos = 100, 
      maxResultados = 10 
    } = req.body;

    console.log(`Iniciando análise: maxAcordaos=${maxAcordaos}, maxResultados=${maxResultados}`);

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
        }

        // Pequena pausa entre processamentos
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Erro ao processar acórdão ${acordao.numeroAcordao}:`, error.message);
        processedCount++;
        continue; // Continua com o próximo acórdão
      }
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
    next(error);
  }
});

// Rota de healthcheck
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API funcionando corretamente',
    code: 200,
    timestamp: new Date().toISOString()
  });
});

// Rota de informações da API
app.get('/api/info', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API de Análise de Jurisprudência TCU',
    version: '1.0.0',
    endpoints: [
      {
        method: 'POST',
        path: '/api/analyze',
        description: 'Analisa jurisprudências do TCU baseado em um caso concreto',
        parameters: {
          casoConcreto: 'string (obrigatório, min 50 chars)',
          maxAcordaos: 'integer (opcional, 1-10000, default: 100)',
          maxResultados: 'integer (opcional, 1-100, default: 10)'
        }
      },
      {
        method: 'GET',
        path: '/api/health',
        description: 'Verifica o status da API'
      }
    ],
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
    code: 404
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
  console.log(`📋 Documentação: http://localhost:${PORT}/api/info`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;