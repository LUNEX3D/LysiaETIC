import React, { useState } from "react";
import { FaArrowLeft, FaTimes, FaSearch } from "react-icons/fa";
import EcSelect from "../../../components/ecommerce/EcSelect";

const SECTIONS = [
    { id: "products", label: "Ürünler", hint: "Çeviri yok" },
    { id: "categories", label: "Kategoriler", hint: "Çeviri yok" },
    { id: "brands", label: "Markalar", hint: "Çeviri yok" },
    { id: "tags", label: "Ürün Etiketleri", hint: "Çeviri yok" },
];

const ProductTranslationsPanel = ({ productTitle, onClose }) => {
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(null);

    const filtered = SECTIONS.filter((s) => s.label.toLowerCase().includes(query.toLowerCase()));

    return (
        <div className="ec-prod-translations">
            <header className="ec-prod-form-topbar ec-prod-form-topbar--edit">
                <div className="ec-prod-form-topbar__left">
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose} aria-label="Geri">
                        <FaArrowLeft />
                    </button>
                    <span className="ec-prod-breadcrumb">
                        {productTitle} &gt; <strong>Çeviri Düzenle</strong>
                    </span>
                </div>
                <div className="ec-prod-head-actions">
                    <label className="ec-prod-lang-select">
                        Çevirilecek Dil:
                        <EcSelect defaultValue="en">
                            <option value="en">English</option>
                            <option value="de">Deutsch</option>
                        </EcSelect>
                    </label>
                    <button type="button" className="ec-prod-btn" disabled>
                        Kaydet
                    </button>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </div>
            </header>
            <div className="ec-prod-translations__body">
                <aside className="ec-prod-translations__sidebar">
                    <h2>Bölüm Çevirileri</h2>
                    <label className="ec-prod-search">
                        <FaSearch />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ara"
                        />
                    </label>
                    <ul>
                        {filtered.map((s) => (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    className={active === s.id ? "active" : ""}
                                    onClick={() => setActive(s.id)}
                                >
                                    <span>{s.label}</span>
                                    <small>{s.hint}</small>
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>
                <main className="ec-prod-translations__main">
                    {!active ? (
                        <div className="ec-prod-empty">
                            <p>
                                <strong>Çevirilecek bölüm seçimi yapınız</strong>
                            </p>
                            <p className="ec-prod-muted">
                                Lütfen seçtiğiniz dili ve çeviri yapmak istediğiniz bölümü sol taraftan seçerek
                                çeviriye başlayın.
                            </p>
                        </div>
                    ) : (
                        <p className="ec-prod-muted">Çeviri editörü yakında eklenecek.</p>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ProductTranslationsPanel;
