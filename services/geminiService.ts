import { GoogleGenAI, Modality, Type } from "@google/genai";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeFace = async (
  imageBase64: string,
  mimeType: string,
  deepAnalysis: boolean = false
) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const modelId = "gemini-3-pro-preview";

  const config: any = {
    systemInstruction: `Você é um 'Visagista e Psicólogo Comportamental' de elite, especialista em conectar a aparência física com a identidade interior e a percepção social. Sua análise vai além da estética; ela revela a psicologia por trás dos traços. Analise a foto enviada e crie uma consultoria psicológica e visagista profunda.

    **Para a Consultoria:**
    - Identifique o formato do rosto e os traços dominantes (olhos, boca, nariz).
    - **Análise Psicológica:** Conecte cada traço a possíveis características de personalidade, emoções e como a pessoa pode ser percebida (ex: 'Sobrancelhas arqueadas podem comunicar determinação e dinamismo', 'Um queixo arredondado pode sugerir uma natureza mais receptiva e gentil').
    - Analise o tom de pele e sugira maquiagem e acessórios que não apenas harmonizem, mas que também reforcem a mensagem que a cliente deseja transmitir (poder, acessibilidade, criatividade, etc.).

    **Para a Paleta de Cores:**
    - Gere uma paleta de 6 a 8 cores EXTREMAMENTE VIBRANTES e com ALTO CONTRASTE.
    - **Justificativa Psicológica:** Para cada cor, explique o impacto emocional e psicológico que ela causa e por que ela é recomendada para a personalidade inferida ou para os objetivos de imagem da cliente.

    **Para os Cortes de Cabelo:**
    - Sugira exatamente 3 cortes de cabelo.
    - **Justificativa Psicológica:** Explique como cada corte alinha a imagem externa com a identidade interna, ajudando a projetar a imagem desejada (ex: 'Este corte 'pixie' projeta uma imagem de independência e confiança, ideal para quem busca se destacar em ambientes corporativos').
    - Forneça um prompt técnico em INGLÊS para uma IA generativa aplicar o corte, mantendo o foco em realismo e iluminação de estúdio.

    Responda estritamente em JSON.`,
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        consultancy: {
          type: Type.STRING,
          description:
            "Uma consultoria completa, extensa e detalhada em Português, cobrindo formato do rosto, análise detalhada do tom de pele com insights psicológicos sobre os traços faciais, e sugestões de maquiagem e acessórios para reforçar a imagem desejada.",
        },
        palette: {
          type: Type.ARRAY,
          description:
            "Uma paleta de cores recomendada com 6 a 8 cores intensas, vibrantes e com alto contraste, cada uma com uma justificativa psicológica sobre seu impacto emocional.",
          items: {
            type: Type.OBJECT,
            properties: {
              hex: {
                type: Type.STRING,
                description: "Código Hex da cor (ex: #RRGGBB)",
              },
              name: {
                type: Type.STRING,
                description: "Nome da cor em Português",
              },
            },
            required: ["hex", "name"],
          },
        },
        cuts: {
          type: Type.ARRAY,
          description:
            "3 sugestões de cortes de cabelo ideais, com justificativas psicológicas.",
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: "Nome do corte em Português",
              },
              description: {
                type: Type.STRING,
                description:
                  "Por que combina com o rosto e a imagem que a cliente deseja projetar (análise psicológica).",
              },
              technicalPrompt: {
                type: Type.STRING,
                description:
                  "Prompt técnico em INGLÊS para uma IA de imagem. FOCO TOTAL EM REALISMO E ILUMINAÇÃO DE ESTÚDIO. Deve incluir: 'Award-winning studio portrait', 'Softbox lighting', 'Rim light to highlight hair texture', 'Cinematic depth of field'. PELE: 'Hyper-realistic skin texture', 'Visible pores', 'Subsurface scattering' (sem pele de plástico). CABELO: 'Ultra-detailed hair strands'. Ex: 'Professional studio portrait of a woman with [Cut Name], shot on 85mm lens f/1.8, perfectly balanced soft lighting, hyper-realistic 8k texture'.",
              },
            },
            required: ["name", "description", "technicalPrompt"],
          },
        },
      },
      required: ["consultancy", "palette", "cuts"],
    },
  };

  // If deep analysis is requested, enable thinking
  if (deepAnalysis) {
    config.thinkingConfig = { thinkingBudget: 16000 }; // Balanced budget
  }

  const response = await ai.models.generateContent({
    model: modelId,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: imageBase64,
          },
        },
        {
          text: "Analise este rosto. Forneça uma consultoria psicológica e visagista, paleta de cores com justificativa emocional e 3 sugestões de cortes com base na imagem desejada.",
        },
      ],
    },
    config: config,
  });

  // Parse JSON response
  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Error parsing JSON", e);
    throw new Error("Falha ao processar a resposta da IA.");
  }
};

export const editHairImage = async (
  imageBase64: string,
  mimeType: string,
  prompt: string
) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const finalPrompt = `Professional studio portrait photography, 8k resolution. Apply these changes: ${prompt}. Lighting: Masterful studio lighting setup, softbox key light, subtle rim light to separate hair from background. Skin: Hyper-realistic texture, visible pores, natural imperfections (no smoothing/plastic look). Camera: Shot on 85mm prime lens, f/1.8. Maintain exact facial identity. The result must look like a high-end beauty magazine cover.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: imageBase64,
          },
        },
        {
          text: finalPrompt,
        },
      ],
    },
  });

  // Extract image
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  throw new Error("Não foi possível gerar a imagem");
};

export const generateColoristConsultancy = async (
  clientImageBase64: string,
  clientMime: string,
  prompt: string,
  brand: string,
  refImageBase64?: string,
  refMime?: string
) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const parts: any[] = [
    { inlineData: { mimeType: clientMime, data: clientImageBase64 } },
  ];

  if (refImageBase64 && refMime) {
    parts.push({ inlineData: { mimeType: refMime, data: refImageBase64 } });
    parts.push({
      text: "A primeira imagem é a Cliente. A segunda imagem é a Referência de cor desejada.",
    });
  } else {
    parts.push({ text: "Esta é a imagem da Cliente." });
  }

  parts.push({
    text: `Atue como um Colorista Master e Visagista de renome internacional. Seja extremamente detalhado, técnico e preciso. O objetivo é: ${prompt}. A marca de produtos escolhida é: ${brand}.
    Analise a viabilidade, o fundo de clareamento necessário e crie um dossiê técnico completo e aprofundado.
    
    IMPORTANTE: Se o visual desejado envolver mechas, luzes, balayage ou reflexos, você DEVE detalhar a 'highlightingTechnique' (ex: eriçado, costurado, freehands, contour) e explicar como executar. Se for cor global, explique a técnica de aplicação.

    Responda ESTRITAMENTE em JSON seguindo este schema.`,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          visagismAnalysis: {
            type: Type.STRING,
            description:
              "Análise de visagismo aprofundada: A cor combina com o tom de pele, cor dos olhos e sub-tom? Explique a teoria das cores aplicada. Sugira variações de tom (mais quente/frio).",
          },
          diagnosis: {
            type: Type.STRING,
            description:
              "Diagnóstico completo do cabelo atual: inclua porcentagem de brancos, histórico químico aparente, e o fundo de clareamento exato a ser atingido (ex: 9.0 Dourado-Amarelo).",
          },
          highlightingTechnique: {
            type: Type.STRING,
            description:
              "Nome e explicação detalhada da técnica de mechas/iluminação específica (ex: 'Contour + Eriçado 30%'). Se for coloração global, explique o método de aplicação.",
          },
          formula: {
            type: Type.OBJECT,
            properties: {
              primary: {
                type: Type.STRING,
                description: `Receita exata usando a nomenclatura e produtos da marca ${brand} (Ex: 30g de 9.1 + 45g Oxidante 20vol).`,
              },
              toner: {
                type: Type.STRING,
                description: `Fórmula do tonalizante, se aplicável, da marca ${brand}.`,
              },
              alternatives: {
                type: Type.STRING,
                description:
                  "Sugestão de fórmula alternativa com outra marca ou para um orçamento diferente.",
              },
            },
          },
          techniqueStepByStep: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Passo a passo numérico e cronológico da aplicação técnica, incluindo tempos de pausa exatos e o que observar durante o processo.",
          },
          troubleshooting: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Solução de Problemas: Liste 2-3 problemas comuns (ex: 'Manchou a raiz', 'Cor ficou chumbada') e como corrigi-los.",
          },
          postChemicalCare: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Dicas de manutenção e produtos home care sugeridos para máxima durabilidade da cor.",
          },
        },
        required: [
          "visagismAnalysis",
          "diagnosis",
          "highlightingTechnique",
          "formula",
          "techniqueStepByStep",
          "troubleshooting",
          "postChemicalCare",
        ],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("JSON Parse Error", e);
    throw new Error("Erro ao gerar consultoria técnica.");
  }
};

export const generateHairstylistConsultancy = async (
  clientImageBase64: string,
  clientMime: string,
  prompt: string,
  brand: string,
  refImageBase64?: string,
  refMime?: string
) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const parts: any[] = [
    { inlineData: { mimeType: clientMime, data: clientImageBase64 } },
  ];

  if (refImageBase64 && refMime) {
    parts.push({ inlineData: { mimeType: refMime, data: refImageBase64 } });
    parts.push({
      text: "A primeira imagem é a Cliente. A segunda é a Referência do corte desejado.",
    });
  } else {
    parts.push({ text: "Esta é a imagem da Cliente." });
  }

  let mainInstruction = `Atue como um Hairstylist Visagista de elite, criando um dossiê técnico 5D. A marca de produtos preferida é ${brand}.`;
  if (prompt) {
    mainInstruction += ` O corte desejado pelo cliente é: "${prompt}".`;
    if (refImageBase64) {
      mainInstruction +=
        " A imagem de referência serve como principal inspiração visual para este pedido.";
    }
  } else if (refImageBase64) {
    mainInstruction +=
      " O cliente não forneceu um texto. Baseie TODA a sua análise na imagem de referência para determinar o corte desejado e criar um plano para aplicá-lo na cliente.";
  }

  mainInstruction += ` Analise a(s) imagem(ns), a estrutura facial e o pedido. Crie um plano de corte extremamente completo e detalhado.
        IMPORTANTE: Gere três 'technicalPrompts' concisos em INGLÊS para uma IA de imagem gerar simulações visuais realistas do corte na cliente: um de FRENTE (Front view), um de LADO (Side view/Profile) e um de COSTAS (Back view).
        
        CRUCIAL PARA OS PROMPTS:
        1. CONSISTÊNCIA: Os três prompts devem descrever EXATAMENTE O MESMO CORTE. O comprimento, textura, camadas e estilo devem ser idênticos nas três visões.
        2. SIDE VIEW (PERFIL): Deve descrever claramente como o corte se comporta na lateral. Se for um Bob, mostre a inclinação (A-line ou reto). Se tiver franja, descreva como ela cai lateralmente.
        3. BACK VIEW (COSTAS): Deve descrever o acabamento na nuca e comprimento total. Ex: "U-shaped back", "Straight cut line", "Graduated nape".
        4. ILUMINAÇÃO E PELE: Todos os prompts devem exigir "Professional studio lighting", "Softbox", "Rim light" e "hyperrealistic skin texture".
        
        Responda ESTRITAMENTE em JSON.`;

  parts.push({ text: mainInstruction });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          visagismAnalysis: {
            type: Type.STRING,
            description:
              "Análise visagista profunda: Por que este corte harmoniza com o formato do rosto e traços? Detalhe os pontos de equilíbrio que o corte cria. Sugira pequenas variações para outros formatos de rosto.",
          },
          viabilityVerdict: {
            type: Type.STRING,
            description:
              "Veredito de viabilidade e Nível de Dificuldade (Iniciante, Intermediário, Avançado). O cabelo da cliente (textura, densidade) é adequado? Quais adaptações são CRÍTICAS para o sucesso?",
          },
          preparation: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Passos para preparar o cabelo para o corte (lavagem, tipo de produto, nível de umidade).",
          },
          toolsAndAccessories: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Lista de ferramentas e acessórios específicos necessários (ex: 'Tesoura fio navalha 6.0', 'Máquina de corte com pente #2', 'Pente de carbono').",
          },
          diagram3d: {
            type: Type.STRING,
            description:
              "Descrição textual do Diagrama 3D do corte, detalhando as seções, divisões e linhas guias.",
          },
          products: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: `Lista de produtos de styling da marca ${brand} para preparar e finalizar o look (ex: 'Mousse de volume', 'Protetor térmico', 'Pomada efeito matte').`,
          },
          techniqueStepByStep: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Passo a passo técnico numerado e detalhado do corte: inclua ângulos de elevação em graus, e técnicas de texturização (ex: 'point cutting', 'slide cutting').",
          },
          finalizationSecrets: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Segredos de Finalização: dicas profissionais sobre como secar e estilizar o cabelo para replicar o look do salão.",
          },
          postCutCare: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Dicas de manutenção para a cliente em casa e frequência ideal de retorno ao salão.",
          },
          prompts: {
            type: Type.OBJECT,
            properties: {
              front: {
                type: Type.STRING,
                description:
                  "Prompt técnico em INGLÊS, extremamente detalhado para a visão FRONTAL. DEVE INCLUIR: 'Professional studio lighting', 'Soft key light', 'Rim light', 'Hyper-realistic skin texture'. Ex: 'Studio portrait, Front View, [Cut Name], softbox lighting, 8k'.",
              },
              side: {
                type: Type.STRING,
                description:
                  "Prompt técnico em INGLÊS para a visão LATERAL (PROFILE VIEW). Mesma iluminação de estúdio. Ex: 'Studio portrait, Side Profile, [Cut Name], rim light, realistic texture'.",
              },
              back: {
                type: Type.STRING,
                description:
                  "Prompt técnico em INGLÊS para a visão DE COSTAS (BACK VIEW). Mesma iluminação de estúdio. Ex: 'Studio portrait, Back View, [Cut Name], professional lighting'.",
              },
            },
            required: ["front", "side", "back"],
          },
        },
        required: [
          "visagismAnalysis",
          "viabilityVerdict",
          "preparation",
          "toolsAndAccessories",
          "diagram3d",
          "products",
          "techniqueStepByStep",
          "finalizationSecrets",
          "postCutCare",
          "prompts",
        ],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("JSON Parse Error", e);
    throw new Error("Erro ao gerar consultoria de corte.");
  }
};

export const createLookGenerationPrompt = async (
  clientImageBase64: string,
  clientMime: string,
  prompt: string,
  refImageBase64?: string,
  refMime?: string
) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const parts: any[] = [
    { inlineData: { mimeType: clientMime, data: clientImageBase64 } },
  ];

  if (refImageBase64 && refMime) {
    parts.push({ inlineData: { mimeType: refMime, data: refImageBase64 } });
    parts.push({
      text: "A primeira imagem é o rosto da Cliente. A segunda é a inspiração para o look.",
    });
  } else {
    parts.push({ text: "Esta é a imagem do rosto da Cliente." });
  }

  parts.push({
    text: `
      Sua tarefa é criar um prompt técnico para uma IA de geração de imagem.
      O objetivo é descrever um look de corpo inteiro para a pessoa na primeira imagem.
      O look deve ser inspirado por: "${prompt}". Se a imagem de referência for fornecida, use-a como principal inspiração.
      
      O prompt gerado deve estar em INGLÊS e ser extremamente detalhado. Inclua detalhes sobre:
      - Estilo de roupa (ex: 'chic evening gown', 'bohemian summer dress', 'streetwear hoodie and cargo pants').
      - Cores e tecidos.
      - Cabelo e maquiagem que complementem o look.
      - Cenário/fundo (ex: 'minimalist studio background', 'urban city street at night', 'enchanted forest').
      - Iluminação (ex: 'professional studio softbox lighting', 'cinematic lighting', 'rim light').
      - Qualidade: 'photorealistic, 8k, hyper-detailed, sharp focus, hyper-realistic skin'.
      - Frase chave: 'full body shot of the same person'.
      - Proporção: 'The image MUST have a vertical 9:16 aspect ratio'.

      Responda apenas com o prompt de texto, nada mais.
    `,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts },
  });

  return response.text;
};

export const generateLookImage = async (
  technicalPrompt: string,
  clientImageBase64: string,
  clientMime: string
) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const finalPrompt = `Ultra realistic 8k full body photo. The final image must be photorealistic, with professional studio lighting (softbox key light, rim light), soft shadows, and hyperrealistic skin texture (visible pores, no smoothing). Maintain the original facial identity and features from the provided image. Create the look as described here: ${technicalPrompt}. Add a subtle catchlight to the eyes for realism.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: clientMime,
            data: clientImageBase64,
          },
        },
        {
          text: finalPrompt,
        },
      ],
    },
  });

  // Extract generated image data
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }

  throw new Error(
    "Falha ao gerar a imagem do look. O modelo pode não ter retornado uma imagem."
  );
};

export const generateHairTherapyConsultancy = async (
  hairImageBase64: string,
  hairMime: string,
  description: string,
  brand: string
) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const parts: any[] = [
    { inlineData: { mimeType: hairMime, data: hairImageBase64 } },
    {
      text: `
            Atue como um Tricologista sênior com foco em resultados visíveis e saúde capilar a longo prazo. A marca de produtos escolhida é: ${brand}.
            Analise a imagem do cabelo e a queixa do cliente: "${description}".
            
            Faça um diagnóstico completo e aprofundado da saúde do fio (porosidade, elasticidade, danos).
            Prescreva um tratamento (cronograma ou protocolo específico) usando APENAS produtos da marca ${brand}.
            Seja extremamente detalhado no passo a passo e no cronograma.
            
            Responda ESTRITAMENTE em JSON.
        `,
    },
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          diagnosis: {
            type: Type.OBJECT,
            properties: {
              damageLevel: {
                type: Type.STRING,
                description: "Nível de dano (Baixo, Médio, Alto, Crítico)",
              },
              porosity: {
                type: Type.STRING,
                description: "Porosidade observada e explicada cientificamente",
              },
              elasticity: {
                type: Type.STRING,
                description:
                  "Teste de elasticidade (descrito) e seu significado",
              },
              scalpCondition: {
                type: Type.STRING,
                description:
                  "Condição aparente do couro cabeludo (oleosidade, descamação, etc.)",
              },
              summary: {
                type: Type.STRING,
                description:
                  "Resumo geral do diagnóstico, explicando a causa raiz do problema de forma científica e de fácil compreensão.",
              },
            },
            required: [
              "damageLevel",
              "porosity",
              "elasticity",
              "scalpCondition",
              "summary",
            ],
          },
          treatmentPlan: {
            type: Type.OBJECT,
            properties: {
              protocolName: {
                type: Type.STRING,
                description:
                  "Nome do protocolo de tratamento e seu objetivo principal (ex: 'Terapia de Reposição Lipídica Intensiva').",
              },
              products: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: `Lista de produtos EXATOS da marca ${brand} para o tratamento completo.`,
              },
              stepByStep: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "Passo a passo detalhado da aplicação no salão e uma versão simplificada para manutenção em casa.",
              },
              schedule: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "Cronograma Capilar detalhado para 4 semanas, especificando quais produtos usar em cada etapa (Hidratação, Nutrição, Reconstrução).",
              },
              lifestyleTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "Dicas de estilo de vida e nutrição que apoiam a saúde capilar (ex: 'Aumentar ingestão de biotina', 'Evitar água muito quente').",
              },
              expectedResults: {
                type: Type.STRING,
                description:
                  "Resultados esperados e em quanto tempo (ex: 'Após 2 semanas, espera-se uma redução de 30% na quebra. O brilho deve retornar em 4 semanas.').",
              },
            },
            required: [
              "protocolName",
              "products",
              "stepByStep",
              "schedule",
              "lifestyleTips",
              "expectedResults",
            ],
          },
        },
        required: ["diagnosis", "treatmentPlan"],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("JSON Parse Error", e);
    throw new Error("Erro ao gerar diagnóstico capilar.");
  }
};

// FIX: Add generateVeoVideo function for video generation
export const generateVeoVideo = async (
  prompt: string,
  imageBase64?: string,
  mimeType?: string
) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const videoRequest: any = {
    model: "veo-3.1-fast-generate-preview",
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: "720p",
      aspectRatio: "16:9",
    },
  };

  if (imageBase64 && mimeType) {
    videoRequest.image = {
      imageBytes: imageBase64,
      mimeType: mimeType,
    };
  }

  let operation = await ai.models.generateVideos(videoRequest);

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({
      operation: operation,
    });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw new Error("Video generation failed, no download link found.");
  }

  const response = await fetch(
    `${downloadLink}&key=${import.meta.env.VITE_API_KEY}`
  );
  if (!response.ok) {
    throw new Error("Failed to download video from generated link.");
  }
  const videoBlob = await response.blob();
  const videoUrl = URL.createObjectURL(videoBlob);

  return videoUrl;
};

// FIX: Add searchTrends function for Google Search grounding
export const searchTrends = async (query: string) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: query,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  return {
    text: response.text,
    chunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
  };
};

// FIX: Add searchPlaces function for Google Maps grounding
export const searchPlaces = async (
  query: string,
  latitude: number,
  longitude: number
) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: query,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: latitude,
            longitude: longitude,
          },
        },
      },
    },
  });
  return {
    text: response.text,
    chunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
  };
};

export const getQuickBeautyTip = async () => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents:
      "Me dê uma dica curta e fascinante de beleza ou cuidados com o cabelo para hoje. Mantenha com menos de 30 palavras. Responda em Português do Brasil.",
  });
  return response.text;
};

// Create a persistent chat session
export const createChatSession = () => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
  return ai.chats.create({
    model: "gemini-3-pro-preview",
    config: {
      systemInstruction:
        "Você é o Assistente Inteligente do '4us! Smart Studio AI'. Você é um expert em beleza, cabelos, maquiagem e estilo. Ajude profissionais e clientes com dúvidas técnicas, dicas de produtos, tendências e ideias criativas. Seja sempre educado, profissional e use emojis para tornar a conversa leve. Responda sempre em Português do Brasil.",
    },
  });
};
