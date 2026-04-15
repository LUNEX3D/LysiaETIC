import { Navigate } from "react-router-dom";

/**
 * AdminPanelPage — /admin/panel yönlendirmesi
 * Eski URL'den gelen kullanıcıları ana dashboard'a yönlendirir.
 */
const AdminPanelPage = () => <Navigate to="/admin" replace />;

export default AdminPanelPage;
