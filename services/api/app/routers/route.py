import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.route_store import RouteDataUnavailableError, load_route
from app.schemas import RouteData

logger = logging.getLogger(__name__)

router = APIRouter(tags=["route"])


@router.get("/route")
def get_route(settings: Annotated[Settings, Depends(get_settings)]) -> RouteData:
    try:
        return load_route(settings.route_data_path)
    except RouteDataUnavailableError:
        logger.exception("route data unavailable")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Route data is not available yet.",
        ) from None
