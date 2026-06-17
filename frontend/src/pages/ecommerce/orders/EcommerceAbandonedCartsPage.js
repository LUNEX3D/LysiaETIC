import React from "react";
import { FaInfoCircle } from "react-icons/fa";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";

const EcommerceAbandonedCartsPage = () => (
    <div className="ec-prod-page ec-orders-page">
        <div className="ec-prod-panel">
            <header className="ec-prod-head">
                <h1>
                    Terk Edilmiş Sepetler <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                </h1>
            </header>
            <div className="ec-orders-empty">
                <div className="ec-barcode-label-empty__icon" style={{ marginBottom: "1rem" }} />
                <h2>Terk Edilmiş Sepetleri Yönetin</h2>
                <p>
                    Sepette ürün bırakan müşterilerinize bildirim gönderin ve satışlarınızı artırın.
                    Otomasyon kuralları bir sonraki sürümde eklenecek.
                </p>
            </div>
        </div>
    </div>
);

export default EcommerceAbandonedCartsPage;
