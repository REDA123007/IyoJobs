import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="container page">
      <h1>{t("notfound.title")}</h1>
      <p className="lead">{t("notfound.body")}</p>
      <Link to="/" className="btn btn-primary">
        {t("notfound.home")}
      </Link>
    </div>
  );
}
