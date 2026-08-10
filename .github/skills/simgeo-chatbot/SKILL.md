---
name: simgeo-chatbot
user-invocable: true
description: "Workspace skill para desenvolver, integrar e gerir a aplicação do Assistente IA (Chatbot) no SimGeo."
---

# SimGeo Chatbot

## Purpose

Esta skill serve como um guia consolidado de como integrar, desenvolver e atualizar a aplicação de Assistente de Inteligência Artificial no ecossistema SimGeo. Fornece passos específicos para ligar o chatbot aos dados espaciais (PostGIS) e ao frontend em React.

## When to Use

- Ao criar novos endpoints para o `ai_agent` no Django.
- Ao atualizar a interface do chatbot no `App.jsx`.
- Quando precisar de treinar ou alterar os prompts de NLP do chatbot para interpretar consultas sobre infraestruturas ou águas subterrâneas.

## Workflow

1.  **Backend (Django `ai_agent`)**:
    - Garantir que a app está registada no `INSTALLED_APPS`.
    - Ligar o endpoint de conversação a um LLM (ex: integração OpenAI ou Ollama local).
    - Criar ferramentas/tools para que o LLM possa consultar os modelos `Infrastructure` e `SpatialDataset`.

2.  **Frontend (React `App.jsx`)**:
    - Criar uma janela sobreposta (modal/sidebar) para a interface de chat.
    - Manter um estado de histórico de conversa.
    - Se a IA devolver coordenadas ou filtros, atualizar o estado do mapa no DeckGL automaticamente.

## Quality Criteria

- O chatbot consegue identificar entidades geográficas (ex: "Mostra-me os hospitais em Sofala").
- A resposta do backend é segura e evita Injeção de SQL nas consultas PostGIS.
- O histórico não ultrapassa o limite de tokens da janela de contexto.

## Example Prompts

- `Inicia a implementação do módulo ai_agent no backend usando a skill simgeo-chatbot.`
- `Atualiza a interface do chatbot no frontend para seguir as regras do simgeo-chatbot.`
