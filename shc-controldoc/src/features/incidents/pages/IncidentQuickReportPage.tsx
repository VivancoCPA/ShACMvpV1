import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../../stores/authStore";
import { getIncidentPermissions } from "../utils/incidentPermissions";
import { IncidentQuickReportForm } from "../components/IncidentQuickReportForm";

export function IncidentQuickReportPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const permissions = user ? getIncidentPermissions(null, user.rol) : null;

  useEffect(() => {
    if (permissions && !permissions.canCreate) {
      navigate("/no-autorizado", { replace: true });
    }
  }, [permissions, navigate]);

  if (!permissions?.canCreate) return null;

  return <IncidentQuickReportForm />;
}
