"""Shared equal-area projection definition for Earth Engine analyses."""


EQUAL_AREA_CRS_CODE = "EPSG:6933"

# Earth Engine does not consistently resolve EPSG:6933 by authority code.
# Supplying its official OGC WKT keeps the same NSIDC EASE-Grid 2.0 Global
# equal-area projection while avoiding the server-side CRS parser failure.
EQUAL_AREA_CRS_WKT = (
    'PROJCS["WGS 84 / NSIDC EASE-Grid 2.0 Global",'
    'GEOGCS["WGS 84",'
    'DATUM["WGS_1984",'
    'SPHEROID["WGS 84",6378137,298.257223563,'
    'AUTHORITY["EPSG","7030"]],'
    'AUTHORITY["EPSG","6326"]],'
    'PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],'
    'UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],'
    'AUTHORITY["EPSG","4326"]],'
    'PROJECTION["Cylindrical_Equal_Area"],'
    'PARAMETER["standard_parallel_1",30],'
    'PARAMETER["central_meridian",0],'
    'PARAMETER["false_easting",0],'
    'PARAMETER["false_northing",0],'
    'UNIT["metre",1,AUTHORITY["EPSG","9001"]],'
    'AXIS["Easting",EAST],'
    'AXIS["Northing",NORTH],'
    'AUTHORITY["EPSG","6933"]]'
)
