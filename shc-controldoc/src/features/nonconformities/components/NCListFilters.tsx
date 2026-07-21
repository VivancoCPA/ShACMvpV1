import { useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FilterBar } from "../../../components/shared/FilterBar";
import { Switch } from "../../../components/ui/Switch";
import { useAreas } from "../../areas/hooks/useAreas";
import { useAuthStore } from "../../../stores/authStore";
import type { NCStatus, NCSeveridad } from "../types/nonconformity.types";

const NC_STATUS_VALUES: NCStatus[] = [
  "ABIERTA",
  "EN_INVESTIGACION",
  "ANALISIS_COMPLETADO",
  "EN_EJECUCION",
  "PENDIENTE_CIERRE",
  "CERRADA",
  "ANULADA",
];

const NC_SEVERITY_VALUES: NCSeveridad[] = ["BAJA", "MEDIA", "ALTA", "CRITICA"];

const FILTER_PARAMS = [
  "search",
  "estado",
  "severidad",
  "areaId",
  "fechaDesde",
  "fechaHasta",
  "showDeleted",
  "page",
];

export function NCListFilters() {
  const { t } = useTranslation("nonconformities");
  const [searchParams, setSearchParams] = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const user = useAuthStore((s) => s.user);
  const canSeeDeleted = user?.rol === 'JEFE_CALIDAD_SYST';
  const { data: areas = [] } = useAreas();
  const areasActivas = areas.filter((a) => a.activo);

  const hasActiveFilters = FILTER_PARAMS.some(
    (p) => p !== "page" && searchParams.has(p),
  );

  const fechaCampo = (searchParams.get("fechaCampo") ?? "fechaDeteccion") as
    | "fechaDeteccion"
    | "fechaCierre";

  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        if (key !== "page") next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setParam("search", value);
      }, 300);
    },
    [setParam],
  );

  const handleClear = useCallback(() => {
    setSearchParams(new URLSearchParams({ fechaCampo: "fechaDeteccion" }));
  }, [setSearchParams]);

  const inputBase =
    "h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:placeholder:text-on-dark-soft";

  const selectBase =
    "h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark";

  return (
    <FilterBar>
      {/* Search */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-muted dark:text-on-dark-soft"
          htmlFor="nc-search"
        >
          {t("filters.searchLabel")}
        </label>
        <input
          id="nc-search"
          type="search"
          className={`${inputBase} w-56`}
          placeholder={t("filters.searchPlaceholder")}
          defaultValue={searchParams.get("search") ?? ""}
          onChange={handleSearch}
          aria-label={t("filters.searchLabel")}
        />
      </div>

      {/* Severidad */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-muted dark:text-on-dark-soft"
          htmlFor="nc-severidad"
        >
          {t("filters.severidadLabel")}
        </label>
        <select
          id="nc-severidad"
          className={`${selectBase} w-32`}
          value={searchParams.get("severidad") ?? ""}
          onChange={(e) => setParam("severidad", e.target.value)}
        >
          <option value="">{t("filters.todos")}</option>
          {NC_SEVERITY_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Estado */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-muted dark:text-on-dark-soft"
          htmlFor="nc-estado"
        >
          {t("filters.estadoLabel")}
        </label>
        <select
          id="nc-estado"
          className={`${selectBase} w-40`}
          value={searchParams.get("estado") ?? ""}
          onChange={(e) => setParam("estado", e.target.value)}
        >
          <option value="">{t("filters.todos")}</option>
          {NC_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Área Afectada — select con catálogo administrado (useAreas) */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-muted dark:text-on-dark-soft"
          htmlFor="nc-area"
        >
          {t("filters.areaAfectadaLabel")}
        </label>
        <select
          id="nc-area"
          className={`${selectBase} w-44`}
          value={searchParams.get("areaId") ?? ""}
          onChange={(e) => setParam("areaId", e.target.value)}
        >
          <option value="">{t("filters.todos")}</option>
          {areasActivas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Rango de fechas + campo selector */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-muted dark:text-on-dark-soft"
          htmlFor="nc-fecha-campo"
        >
          {t("filters.fechaCampo.label")}
        </label>
        <div className="flex items-center gap-2">
          <select
            id="nc-fecha-campo"
            className={`${selectBase} w-36`}
            value={fechaCampo}
            onChange={(e) => setParam("fechaCampo", e.target.value)}
            aria-label={t("filters.fechaCampo.label")}
          >
            <option value="fechaDeteccion">
              {t("filters.fechaCampo.fechaDeteccion")}
            </option>
            <option value="fechaCierre">
              {t("filters.fechaCampo.fechaCierre")}
            </option>
          </select>
          <label className="sr-only" htmlFor="nc-fecha-desde">
            {t("filters.fechaDesdeLabel")}
          </label>
          <input
            id="nc-fecha-desde"
            type="date"
            lang="es-PE"
            title={t("filters.fechaDesdeLabel")}
            className={`${inputBase} w-36`}
            value={searchParams.get("fechaDesde") ?? ""}
            onChange={(e) => setParam("fechaDesde", e.target.value)}
          />
          <span className="text-xs text-muted dark:text-on-dark-soft">–</span>
          <label className="sr-only" htmlFor="nc-fecha-hasta">
            {t("filters.fechaHastaLabel")}
          </label>
          <input
            id="nc-fecha-hasta"
            type="date"
            lang="es-PE"
            title={t("filters.fechaHastaLabel")}
            className={`${inputBase} w-36`}
            value={searchParams.get("fechaHasta") ?? ""}
            onChange={(e) => setParam("fechaHasta", e.target.value)}
          />
        </div>
      </div>

      {/* Mostrar eliminados — solo JEFE_CALIDAD_SYST */}
      {canSeeDeleted && (
        <div className="self-end">
          <Switch
            id="nc-show-deleted"
            checked={searchParams.get('showDeleted') === 'true'}
            onChange={() => {
              const current = searchParams.get('showDeleted') === 'true';
              setParam('showDeleted', current ? '' : 'true');
            }}
            label={t("filters.mostrarEliminados")}
            danger
          />
        </div>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClear}
          className="h-9 self-end rounded-md border border-hairline bg-canvas px-3 text-sm text-muted transition-colors hover:border-error/40 hover:text-error dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:text-error"
        >
          {t("filters.limpiar")}
        </button>
      )}
    </FilterBar>
  );
}
