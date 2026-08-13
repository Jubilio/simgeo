"""
Utilitário para obter a geometria de Moçambique a partir do FAO GAUL 2015 (level0).
Usado para clipar/filtrar todas as camadas GEE ao território nacional.
"""
import ee

_MOZ_GEOMETRY_CACHE = None


def get_mozambique_geometry():
    """
    Devolve a geometria de Moçambique como ee.Geometry.
    Usa cache em memória para evitar pedidos repetidos ao GEE.
    """
    global _MOZ_GEOMETRY_CACHE
    if _MOZ_GEOMETRY_CACHE is None:
        _MOZ_GEOMETRY_CACHE = (
            ee.FeatureCollection('FAO/GAUL/2015/level0')
            .filter(ee.Filter.eq('ADM0_NAME', 'Mozambique'))
            .geometry()
        )
    return _MOZ_GEOMETRY_CACHE
