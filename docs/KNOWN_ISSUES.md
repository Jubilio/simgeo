# Problemas conhecidos e dívida de validação

Este registo descreve limitações que podem afetar resultados ou operação. Não é
uma lista de funcionalidades desejadas. Ao resolver um item, acrescente o teste
de regressão e mova o estado para **resolvido**, preservando o histórico.

| ID | Estado | Severidade | Problema | Mitigação atual | Critério de encerramento |
| --- | --- | --- | --- | --- | --- |
| GEE-001 | aberto | alta | Tiles do Earth Engine podem devolver `503` de forma transitória ou expirar. | Mensagem de indisponibilidade e nova execução do cenário. | retry controlado, renovação de tile e teste de integração. |
| GEE-002 | mitigado | alta | Reduções nacionais podem exceder o prazo interativo. | agregação prévia e fallback de escala no impacto de cheias. | processamento assíncrono ou benchmark que cumpra o orçamento definido. |
| GEE-003 | mitigado | alta | WKT personalizado não foi aceite pelo parser de projeção. | `EPSG:4326` e `pixelArea()`. | manter teste de regressão e validar cada novo serviço. |
| SCI-001 | aberto | alta | Índices ambientais e produtos modelados ainda não têm validação de campo local abrangente. | disclaimers e uso limitado a triagem. | evidência V4 documentada por módulo. |
| SCI-002 | aberto | média | Alguns endpoints GEE legados ainda não estão no registo científico. | não os classificar como módulos validados. | ficha e caso de referência para LULC, litologia, groundwater e flood básico. |
| DATA-001 | aberto | média | Alguns joins GAUL–OCHA dependem de nome normalizado quando não há geometria/P-code comum. | lista de correspondências e não correspondências. | adotar geometria COD OCHA e join primário por P-code. |
| API-001 | aberto | média | A API Google Flood Forecasting depende de aprovação e disponibilidade externa. | Flood Hub como contingência. | credencial aprovada e teste real agendado. |
| UI-001 | aberto | média | Ainda não existe uma suíte end-to-end para pesquisa, zoom, mapa 2D/3D e painéis. | verificação manual e build do frontend. | testes automatizados dos fluxos críticos. |

## Como atualizar

Cada nova entrada deve indicar impacto, mitigação e condição verificável de
encerramento. Erros operacionais sem impacto científico podem ser acompanhados
no GitHub, mas devem entrar aqui quando alterarem disponibilidade,
interpretação, escala ou qualidade dos resultados.
