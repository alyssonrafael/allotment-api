import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ParseVenueDto,
  PARSE_VENUE_SCHEMA,
  ParseVenueResponse,
  ParsedVenue,
  RawParseVenueResponse,
} from './dto/parse-venue.dto';
import {
  ParseEventDto,
  PARSE_EVENT_SCHEMA,
  ParseEventResponse,
  ParsedEventCollected,
  RawParseEventResponse,
} from './dto/parse-event.dto';
import { runLayout } from './layout.engine';
import { normalizeDimension } from './dimension.util';
import type { ChatMessage, LlmProvider } from './llm/llm-provider.interface';
import { LLM_PROVIDER } from './llm/llm-provider.interface';

// ─── Blocos reutilizáveis ────────────────────────────────────────────────────

const REQUIRED_DATA_RULE = `REGRA — Dados obrigatórios:
Se qualquer dado obrigatório não estiver no prompt ou no histórico da conversa,
retorne status "needs_info" com perguntas claras e específicas em português.
NUNCA invente cidade, estado, nome, datas ou dimensões.
Pergunte apenas o mínimo necessário por turno (máx. 3 perguntas por vez).
Quando todos os dados obrigatórios estiverem disponíveis, retorne status "complete".
Em "needs_info", preencha "collected" com o que já foi entendido e "assistantMessage"
com uma frase natural para exibir no chat.`;

const OUT_OF_CONTEXT_RULE = `FORA DO CONTEXTO:
Se o usuário enviar uma mensagem não relacionada à criação de pavilhões ou eventos
(ex: perguntas sobre clima, piadas, outros assuntos), responda via "needs_info" com
uma mensagem educada em "assistantMessage" redirecionando para o assunto, mantendo
"collected" com o que já foi coletado e "questions" com o próximo dado que falta.
Exemplo de assistantMessage: "Só consigo ajudar com a criação de pavilhões e eventos.
Voltando: [próxima pergunta necessária]"`;

const DIMENSION_RULE = `MEDIDAS — REGRA ABSOLUTA (INEGOCIÁVEL):
- width (largura) e height (comprimento/profundidade) de QUALQUER stand ou pavilhão DEVEM ser números INTEIROS >= 1.
- NUNCA, em hipótese alguma, emita decimais/frações (ex: 2.5, 3.1, 0.5, 1.7) — nem mesmo se o usuário insistir.
- Se o usuário informar uma medida quebrada ("2,5m", "dois e meio", "3.1"), NÃO bloqueie e NÃO pergunte:
  ARREDONDE para o inteiro mais próximo (mínimo 1) e siga normalmente. O sistema mostrará o ajuste ao usuário para ele confirmar.
- Arredondamento = inteiro mais próximo (0,5 arredonda para cima): 2.4→2, 2.5→3, 3.1→3, 0.5→1, 0→1.
- count (quantidade de stands de um grupo) também é INTEIRO >= 1.
- Valores válidos: 1, 2, 3, 4, 5, 10, 20... Decimais são SEMPRE inválidos.`;

function buildDateRule(currentDate: string): string {
  return `DATAS — Interpretação em português (hoje é ${currentDate}):
- Converta qualquer expressão de data para ISO 8601 usando SEMPRE "T12:00:00.000Z" como horário.
  Exemplos corretos: "2026-08-10T12:00:00.000Z", "2026-03-15T12:00:00.000Z"
  NUNCA use T00:00:00.000Z — causa erro de fuso horário no Brasil (UTC-3), fazendo a data aparecer um dia antes.
- "10/08/2026 a 15/08/2026" → startDate "2026-08-10T12:00:00.000Z", endDate "2026-08-15T12:00:00.000Z"
- "de 5 a 10 de maio" → startDate "YYYY-05-05T12:00:00.000Z", endDate "YYYY-05-10T12:00:00.000Z"
- "março", "em março" → sem ano explícito, use o próximo mês de março a partir de hoje.
- "mês que vem" → primeiro ao último dia do próximo mês.
- "semana que vem" / "próxima semana" → segunda a domingo da próxima semana.
- "no dia 10" → próximo dia 10 a partir de hoje (mesmo mês se ainda não passou, senão mês seguinte).
- Se o mês já passou no ano corrente, avance para o mesmo mês no próximo ano.
- Nunca invente datas — se nenhuma referência temporal existir no histórico, peça as datas.`;
}

const EVENT_TYPE_RULE = `TIPOS DE EVENTO — Mapeamento e explicação:
Mapeie o que o usuário diz para um dos 4 valores aceitos:
  "feira", "feirão", "feira livre", "feira comercial", "trade show"  → FEIRA
  "congresso", "conferência", "simpósio", "summit", "workshop"       → CONGRESSO
  "expo", "exposição", "exhibition", "mostra"                        → EXPO
  "corporativo", "empresarial", "evento interno", "reunião"          → CORPORATE

Quando o nome do evento já indicar o tipo (ex: "Expo Tecnologia", "Feira do Empreendedor",
"Congresso de Inovação"), extraia o type do próprio nome — não pergunte novamente.

Se o usuário perguntar "quais tipos existem?", "que tipos tem?" ou similar,
responda via "needs_info" com assistantMessage explicando os 4 tipos em linguagem
natural e perguntando qual se encaixa melhor:
  "Os tipos disponíveis são: **Feira** (feiras comerciais e exposições de negócios),
   **Congresso** (conferências, simpósios e workshops), **Expo** (exposições e mostras)
   e **Corporativo** (eventos internos e empresariais). Qual desses melhor descreve seu evento?"`;

// ─── System prompts ──────────────────────────────────────────────────────────

function buildSystemPromptVenue(currentDate: string): string {
  return `Você é um assistente especializado em gestão de feiras e eventos.
Extraia do texto do usuário as informações de um pavilhão (venue) e,
se mencionado, de um evento inicial.

Retorne SOMENTE JSON válido seguindo o schema fornecido.

Dados OBRIGATÓRIOS do pavilhão (nunca invente): name, city, state, width, height.
Dados OPCIONAIS (pode assumir null sem perguntar): street, neighborhood, zipCode, description.

CORES — Presets disponíveis (use o mais próximo do que o usuário pediu):
- "azul": accent="#2563eb"
- "laranja": accent="#f97316"
- "violeta": accent="#8b5cf6"
- "verde": accent="#10b981"
Se nenhuma cor for mencionada, use "azul".

Para state, use a sigla UF de 2 letras (ex: "SP", "RJ", "MG").

${DIMENSION_RULE}

${buildDateRule(currentDate)}

${EVENT_TYPE_RULE}

Preencha o array "missing" com os nomes dos campos que você precisou assumir
um valor padrão (use nomes amigáveis em português).

${REQUIRED_DATA_RULE}

${OUT_OF_CONTEXT_RULE}`;
}

function buildSystemPromptEvent(
  canvasWidth: number,
  canvasHeight: number,
  currentDate: string,
): string {
  return `Você é um assistente especializado em layout de feiras e exposições.
Extraia do texto do usuário as informações de um evento e, opcionalmente, o layout de stands.

O canvas disponível é de ${canvasWidth}m × ${canvasHeight}m.
IMPORTANTE: Você NÃO precisa calcular coordenadas — apenas extraia a intenção do layout.
O posicionamento será calculado por um algoritmo separado.

FLUXO DE COLETA — siga exatamente esta ordem:

PASSO 1 — Colete os dados obrigatórios do evento: name, type, startDate, endDate.
  Se qualquer um faltar, retorne "needs_info" pedindo apenas o que falta.

PASSO 2 — Quando os 4 dados do evento estiverem disponíveis:
  - Se o usuário JÁ informou dados de stands (quantidade, tamanho ou qualquer menção a lotes)
    no prompt atual ou no histórico → vá para o PASSO 3a.
  - Se o usuário NÃO mencionou nada sobre stands nem dispensou → retorne "needs_info" com:
      questions: ["Deseja adicionar lotes/stands agora?"]
      assistantMessage: "Ótimo! Evento configurado. Deseja adicionar lotes/stands agora?
        Se sim, me diga quantos, os tamanhos e o valor padrão por stand (ex: 10 stands de 3x3 a R$ 1500).
        Se preferir fazer depois, o evento será criado sem stands."

PASSO 3a — Usuário informou stands (quantidade e tamanho disponíveis):
  - O VALOR PADRÃO por stand (basePrice) é OBRIGATÓRIO para criar stands.
  - Se o usuário informou um valor/preço (ex: "a R$ 1500", "1000 cada", "valor 800") → preencha basePrice e retorne "complete".
  - Se o usuário NÃO informou o valor → retorne "needs_info" pedindo APENAS o preço:
      questions: ["Qual o valor padrão de cada stand? (ex: 1000)"]
      assistantMessage: "Quase lá! Para criar os stands preciso de um valor padrão por stand (ex: R$ 1.000). Você poderá ajustar individualmente depois."
  - NUNCA invente o valor: sem preço informado, jamais retorne "complete" com stands.

PASSO 3b — Usuário dispensou stands ("não", "depois", "sem stands", "só o evento"):
  Retorne "complete" com layoutIntent: null.

Dados OBRIGATÓRIOS do evento (nunca invente): name, type, startDate, endDate.
Stands são OPCIONAIS — nunca invente grupos de stands se o usuário não informou.
Mas SE houver stands, o valor padrão por stand (basePrice) passa a ser OBRIGATÓRIO — nunca o invente.

Quando status for "complete" COM stands, retorne layoutIntent com:
- groups: lista de grupos de stands
- basePrice: o valor padrão por stand informado pelo usuário (número > 0; NUNCA null quando há stands)

TAMANHOS DIFERENTES — múltiplos grupos:
- Cada tamanho distinto de stand é UM grupo separado no array "groups", com seu próprio width, height e count.
- Ex: "10 stands de 3x3 e 5 stands de 2x2" → groups: [{width:3,height:3,count:10,...}, {width:2,height:2,count:5,...}].
- NUNCA misture tamanhos diferentes no mesmo grupo. Pode haver quantos grupos forem necessários.
- O basePrice é único e vale para TODOS os stands, independentemente do tamanho.

ESPAÇAMENTO / CORREDORES — como extrair do pedido do usuário:
- corridorV = espaço (metros) entre stands lado a lado, na MESMA fileira.
- corridorH = espaço (metros) entre FILEIRAS (uma fileira e a de baixo).
- Espaçamento genérico ("2m entre os stands", "corredores de 2 metros", "deixe 1m de espaço")
  → aplique o MESMO valor a corridorV E corridorH.
- Direções separadas ("2m entre fileiras e 1m entre stands") → corridorH:2, corridorV:1.
- "Sem espaço"/"stands encostados" → corridorH:0, corridorV:0.
- Corredores DEVEM ser INTEIROS >= 0 (mesma regra das medidas; arredonde decimais).
- Padrão se não mencionado: corridorH:2, corridorV:2.
- mainCorridorH / mainCorridorV: corredor central mais largo (entre as duas metades do canvas).
  Use só se o usuário pedir explicitamente "corredor central"/"corredor principal"; senão, null.

POSICIONAMENTO DOS STANDS — startCorner:
O usuário pode especificar de qual canto ou ponto os stands começam a ser distribuídos:
  "canto superior esquerdo", "início", "padrão" → startCorner: "top-left"    (padrão)
  "canto superior direito"                       → startCorner: "top-right"
  "canto inferior esquerdo"                      → startCorner: "bottom-left"
  "canto inferior direito"                       → startCorner: "bottom-right"
  "centro", "centralizado", "no meio"            → startCorner: "center"
Se não for mencionado, use startCorner: null (equivale a "top-left").

${DIMENSION_RULE}

${EVENT_TYPE_RULE}

${buildDateRule(currentDate)}

Preencha "missing" com os campos assumidos (use nomes amigáveis em português).

${REQUIRED_DATA_RULE}

${OUT_OF_CONTEXT_RULE}`;
}

const COLOR_PRESETS: Record<string, { accent: string; photo: string }> = {
  '#2563eb': {
    accent: '#2563eb',
    photo: 'linear-gradient(135deg, #2563eb 0%, #6366f1 60%, #8b5cf6 100%)',
  },
  '#f97316': {
    accent: '#f97316',
    photo: 'linear-gradient(135deg, #f97316 0%, #ea580c 60%, #c2410c 100%)',
  },
  '#8b5cf6': {
    accent: '#8b5cf6',
    photo: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 60%, #ec4899 100%)',
  },
  '#10b981': {
    accent: '#10b981',
    photo: 'linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%)',
  },
};

const DEFAULT_PRESET = COLOR_PRESETS['#2563eb'];

function resolveColorPreset(accent: string): { accent: string; photo: string } {
  return COLOR_PRESETS[accent.toLowerCase()] ?? DEFAULT_PRESET;
}

function stripNulls<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(obj) as (keyof T)[]).forEach((key) => {
    const value = obj[key];
    if (value !== null && value !== undefined) out[key] = value;
  });
  return out;
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async parseVenue(dto: ParseVenueDto): Promise<ParseVenueResponse> {
    if (!dto.history?.length && dto.prompt.trim().length < 10) {
      throw new BadRequestException(
        'O prompt inicial deve ter pelo menos 10 caracteres',
      );
    }

    const currentDate = new Date().toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPromptVenue(currentDate) },
      ...(dto.history ?? []),
      { role: 'user', content: dto.prompt },
    ];

    const raw = (await this.llm.complete(
      messages,
      PARSE_VENUE_SCHEMA,
    )) as RawParseVenueResponse;

    if (raw.status === 'needs_info') {
      return {
        status: 'needs_info',
        questions: raw.questions ?? [],
        collected: this.cleanCollectedVenue(raw.collected),
        assistantMessage: raw.assistantMessage ?? '',
      };
    }

    if (!raw.venue || raw.venue.width <= 0 || raw.venue.height <= 0) {
      throw new UnprocessableEntityException(
        'Não foi possível extrair dimensões válidas do pavilhão a partir do prompt',
      );
    }

    const warnings: string[] = [];
    const normalizedWidth = normalizeDimension(raw.venue.width);
    if (normalizedWidth !== raw.venue.width) {
      warnings.push(
        `Largura do pavilhão ${raw.venue.width}m ajustada para ${normalizedWidth}m (apenas medidas inteiras).`,
      );
    }
    const normalizedHeight = normalizeDimension(raw.venue.height);
    if (normalizedHeight !== raw.venue.height) {
      warnings.push(
        `Comprimento do pavilhão ${raw.venue.height}m ajustado para ${normalizedHeight}m (apenas medidas inteiras).`,
      );
    }
    raw.venue.width = normalizedWidth;
    raw.venue.height = normalizedHeight;

    if (raw.suggestedEvent) {
      const start = new Date(raw.suggestedEvent.startDate);
      const end = new Date(raw.suggestedEvent.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        throw new UnprocessableEntityException(
          'Data de término do evento sugerido deve ser posterior à data de início',
        );
      }
    }

    const colorPreset = resolveColorPreset(raw.venue.accent);

    return {
      status: 'complete',
      venue: {
        ...raw.venue,
        accent: colorPreset.accent,
        photo: colorPreset.photo,
      },
      suggestedEvent: raw.suggestedEvent,
      confidence: raw.confidence,
      missing: raw.missing ?? [],
      warnings,
    };
  }

  async parseEvent(dto: ParseEventDto): Promise<ParseEventResponse> {
    if (!dto.history?.length && dto.prompt.trim().length < 10) {
      throw new BadRequestException(
        'O prompt inicial deve ter pelo menos 10 caracteres',
      );
    }

    const venue = await this.prisma.venue.findUnique({
      where: { id: dto.venueId },
    });
    if (!venue) throw new NotFoundException(`Venue ${dto.venueId} not found`);

    if (dto.canvasWidth > venue.width || dto.canvasHeight > venue.height) {
      throw new BadRequestException(
        `Canvas (${dto.canvasWidth}x${dto.canvasHeight}) excede as dimensões do pavilhão (${venue.width}x${venue.height})`,
      );
    }

    const currentDate = new Date().toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    });

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: buildSystemPromptEvent(
          dto.canvasWidth,
          dto.canvasHeight,
          currentDate,
        ),
      },
      ...(dto.history ?? []),
      { role: 'user', content: dto.prompt },
    ];

    const raw = (await this.llm.complete(
      messages,
      PARSE_EVENT_SCHEMA,
    )) as RawParseEventResponse;

    if (raw.status === 'needs_info') {
      return {
        status: 'needs_info',
        questions: raw.questions ?? [],
        collected: stripNulls<ParsedEventCollected>(
          (raw.collected ?? {}) as ParsedEventCollected,
        ),
        assistantMessage: raw.assistantMessage ?? '',
      };
    }

    if (!raw.event) {
      throw new UnprocessableEntityException(
        'A IA não conseguiu extrair os dados do evento a partir do prompt',
      );
    }

    const start = new Date(raw.event.startDate);
    const end = new Date(raw.event.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      throw new UnprocessableEntityException(
        'Data de término deve ser posterior à data de início do evento',
      );
    }

    // layoutIntent null → evento criado sem stands (usuário optou por adicionar depois)
    if (!raw.layoutIntent || (raw.layoutIntent.groups?.length ?? 0) === 0) {
      return {
        status: 'complete',
        event: {
          ...raw.event,
          canvasWidth: dto.canvasWidth,
          canvasHeight: dto.canvasHeight,
        },
        allotments: [],
        summary: { total: 0, placed: 0, discarded: 0, groups: [] },
        warnings: [],
        missing: raw.missing ?? [],
      };
    }

    // O valor base do stand é obrigatório ao criar stands. Se a IA não o
    // coletou, voltamos ao chat pedindo apenas o preço (ajustável depois).
    const basePrice = raw.layoutIntent.basePrice;
    if (
      typeof basePrice !== 'number' ||
      !Number.isFinite(basePrice) ||
      basePrice <= 0
    ) {
      return {
        status: 'needs_info',
        questions: ['Qual o valor padrão de cada stand? (ex: 1000)'],
        collected: {
          name: raw.event.name,
          type: raw.event.type,
          startDate: raw.event.startDate,
          endDate: raw.event.endDate,
        },
        assistantMessage:
          'Quase lá! Para criar os stands preciso de um valor padrão por stand (ex: R$ 1.000). Você poderá ajustar individualmente depois.',
      };
    }

    const layoutResult = runLayout(
      raw.layoutIntent,
      dto.canvasWidth,
      dto.canvasHeight,
    );

    return {
      status: 'complete',
      event: {
        ...raw.event,
        canvasWidth: dto.canvasWidth,
        canvasHeight: dto.canvasHeight,
      },
      allotments: layoutResult.allotments,
      summary: layoutResult.summary,
      warnings: layoutResult.warnings,
      missing: raw.missing ?? [],
    };
  }

  private cleanCollectedVenue(
    collected: Partial<ParsedVenue> | null,
  ): Partial<ParsedVenue> {
    const cleaned = stripNulls<ParsedVenue>((collected ?? {}) as ParsedVenue);
    if (cleaned.accent) {
      const preset = resolveColorPreset(cleaned.accent);
      cleaned.accent = preset.accent;
      cleaned.photo = preset.photo;
    }
    return cleaned;
  }
}
