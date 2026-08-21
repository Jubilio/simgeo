# Contribuir para o SimGeo

Obrigado por contribuir. O SimGeo combina software, geoprocessamento e métodos
que podem influenciar decisões públicas e humanitárias; por isso, uma mudança
tecnicamente válida também precisa de interpretação responsável.

## Preparação

1. Configure o projeto com o [SETUP_GUIDE](SETUP_GUIDE.md).
2. Leia a [arquitetura](docs/ARCHITECTURE.md).
3. Para módulos científicos, leia o
   [Scientific Development Framework](docs/SCIENTIFIC_DEVELOPMENT_FRAMEWORK.md).
4. Consulte [decisões](docs/DECISIONS.md) e
   [problemas conhecidos](docs/KNOWN_ISSUES.md) antes de escolher uma solução.

## Fluxo

1. Abra uma issue com objetivo, método e critério de aceitação.
2. Crie uma branch curta a partir de `main`.
3. Faça alterações incrementais e acrescente testes.
4. Atualize documentação e registo científico no mesmo commit quando o método
   mudar.
5. Execute as verificações locais.
6. Abra o PR e preencha todos os itens aplicáveis sem marcar testes não
   executados.

## Verificações

```bash
python scripts/validate_scientific_specs.py
python -m unittest scripts.tests.test_validate_scientific_specs
python manage.py test

cd frontend
npm run lint
npm run build
```

As dependências GIS do backend são instaladas pelo `Dockerfile` e pelo CI. Se
GDAL/GEOS não estiverem disponíveis no ambiente local, informe explicitamente
quais testes não foram executados.

## Mudanças metodológicas

São metodológicas as alterações de dataset, versão, período, banda, fórmula,
peso, limiar, máscara, CRS, escala, agregação, tratamento de ausência ou
interpretação. Elas exigem:

- atualização da ficha e do registo científico;
- teste numérico ou espacial adequado;
- caso de regressão quando corrigem erro;
- revisão do disclaimer na API e na interface;
- revisão humana por alguém capaz de avaliar o método.

## Segurança e privacidade

- Nunca faça commit de chaves, credenciais Earth Engine ou dados pessoais.
- Chaves externas ficam no backend e são configuradas por ambiente.
- Use dados agregados para contexto humanitário sempre que possível.
- Não apresente estimativas modeladas como observações individuais.

## Assistência por IA

Declare no PR onde a IA foi utilizada e como o resultado foi verificado. Leia
o código e os testes, confirme o método e mantenha a responsabilidade humana
pelo merge e pelo resultado publicado.
