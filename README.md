# 🏛️ API de Análise de Jurisprudência TCU

API REST para análise inteligente de jurisprudências do Tribunal de Contas da União (TCU) usando IA (Gemini + OpenAI).

## 🚀 Funcionalidades

- ✅ Análise automática de acórdãos do TCU
- 🤖 Processamento com IA (Gemini + OpenAI como fallback)
- 📊 Geração de resumos e análise de relevância
- 🔍 Filtros rigorosos de relevância jurídica
- 🛡️ Rate limiting e tratamento de erros
- 📝 Documentação completa da API

## 📋 Pré-requisitos

- Node.js >= 16.0.0
- npm ou yarn
- Chaves de API do Google Gemini
- Chave de API da OpenAI (opcional, como fallback)

## 🔧 Instalação

1. **Clone o repositório:**
```bash
git clone https://github.com/iammarcelomonteiro/tcu-acordao-processor.git
cd tcu-acordao-processor
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure as variáveis de ambiente:**
Crie um arquivo `.env` na raiz do projeto:
```env
GEMINI_KEYS=sua_chave_gemini_1,sua_chave_gemini_2
OPENAI_API_KEY=sua_chave_openai
PORT=3000
NODE_ENV=production
```

4. **Inicie o servidor:**
```bash
npm start
```

Para desenvolvimento:
```bash
npm run dev
```

## 📡 Endpoints da API

### `POST /api/analyze`
Analisa jurisprudências do TCU baseado em um caso concreto.

**Parâmetros:**
```json
{
  "casoConcreto": "string (obrigatório, min 50 chars)",
  "maxAcordaos": "integer (opcional, 1-10000, default: 100)",
  "maxResultados": "integer (opcional, 1-100, default: 10)"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Análise concluída com sucesso",
  "code": 200,
  "data": {
    "acordaosRelevantes": [...],
    "totalRelevantes": 5,
    "totalProcessados": 23,
    "totalDisponiveis": 100,
    "casoConcreto": "...",
    "processedAt": "2025-01-XX..."
  }
}
```

### `GET /api/health`
Verifica o status da API.

### `GET /api/info`
Retorna informações e documentação da API.

## 💡 Exemplo de Uso

```javascript
const response = await fetch('http://localhost:3000/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    casoConcreto: 'Análise de irregularidades em licitação pública...',
    maxAcordaos: 50,
    maxResultados: 5
  })
});

const result = await response.json();
console.log(result.data.acordaosRelevantes);
```

## 🔍 Critérios de Relevância

A API usa critérios rigorosos para determinar a relevância jurídica:

1. **Violação de Princípios da Administração Pública**
2. **Irregularidades em Contratações e Licitações**
3. **Dano ao Erário e Aspectos Econômico-Financeiros**
4. **Deficiências de Controle Interno e Governança**
5. **Gestão de Pessoal e Folha de Pagamento**
6. **Precedente Jurídico com Aplicabilidade Específica**

## 🚨 Códigos de Erro

- `400`: Parâmetros inválidos
- `404`: Nenhum acórdão encontrado
- `408`: Timeout na operação
- `429`: Rate limit excedido
- `500`: Erro interno do servidor
- `502`: Erro no serviço de IA
- `503`: Serviço temporariamente indisponível

## 🌐 Deploy

### Opções de Hospedagem Gratuita:

1. **Render** (Recomendado)
2. **Railway**
3. **Cyclic**
4. **Glitch**

Ver seção de deploy no final da documentação.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Faça commit das mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👤 Autor

**Marcelo Monteiro**
- GitHub: [@iammarcelomonteiro](https://github.com/iammarcelomonteiro)

## 🙏 Agradecimentos

- Tribunal de Contas da União pela disponibilização dos dados abertos
- Google Gemini e OpenAI pelos serviços de IA
- Comunidade open source

---

⭐ **Se este projeto foi útil para você, considere dar uma estrela!**