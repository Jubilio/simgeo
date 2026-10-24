from rest_framework.permissions import BasePermission


class CanImportInfrastructure(BasePermission):
    """Allow spatial imports only to users who may create both records it writes."""

    message = "Sem permissão para importar infraestruturas."
    required_permissions = ("maps.add_spatialdataset", "maps.add_infrastructure")

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.has_perms(self.required_permissions)
        )
