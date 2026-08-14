"""Shared projection settings for interactive Earth Engine analyses."""


# EPSG:4326 is always available in Earth Engine. Area bands still contain
# geodesic square metres because they are built with ee.Image.pixelArea().
# This avoids relying on the server-side parser for custom/equal-area CRS
# definitions while keeping the API calculations portable.
ANALYSIS_CRS = "EPSG:4326"
