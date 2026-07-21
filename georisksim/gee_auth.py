import ee
import logging

logger = logging.getLogger(__name__)

def initialize_gee():
    """
    Inicializa a API do Earth Engine usando o projeto do Google Cloud.
    Requer que o utilizador tenha feito 'earthengine authenticate' localmente ou
    que exista um ficheiro de credentials configurado nas variáveis de ambiente.
    """
    project_id = 'forest-436014'
    
    try:
        # Tenta inicializar com o projeto fornecido
        # Utilizará as credenciais locais caso existam
        ee.Initialize(project=project_id)
        logger.info(f"Google Earth Engine inicializado com sucesso (Projeto: {project_id})")
        return True
    except Exception as e:
        logger.error(f"Erro ao inicializar o Earth Engine: {e}")
        logger.warning(
            "Por favor, execute o seguinte comando no terminal para se autenticar:\n"
            "earthengine authenticate --auth_mode=localhost"
        )
        return False
