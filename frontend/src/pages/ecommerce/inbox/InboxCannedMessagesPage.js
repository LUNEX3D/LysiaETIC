import React, { useState } from "react";

import { FaArrowLeft, FaGripVertical, FaPlus } from "react-icons/fa";



const InboxCannedMessagesPage = ({ cannedResponses, onBack, onSave, saving }) => {

    const [rows, setRows] = useState(() =>

        (cannedResponses || []).map((r, i) => ({ id: r.id || `c${i}`, text: r.text || "", order: i }))

    );



    const updateRow = (id, text) => {

        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, text } : r)));

    };



    const addRow = () => {

        setRows((prev) => [...prev, { id: `c_${Date.now()}`, text: "", order: prev.length }]);

    };



    const removeRow = (id) => {

        setRows((prev) => prev.filter((r) => r.id !== id));

    };



    const handleSave = () => {

        onSave(

            rows

                .map((r, i) => ({ id: r.id, text: r.text.trim(), order: i }))

                .filter((r) => r.text.length > 0)

        );

    };



    return (

        <div className="ec-inbox-settings ec-inbox-canned">

            <header className="ec-inbox-manage__head">

                <button type="button" className="ec-inbox-channels__back" onClick={onBack}>

                    <FaArrowLeft />

                </button>

                <h1>Hazır Mesajlar</h1>

                <button

                    type="button"

                    className="ec-inbox-settings__action"

                    onClick={handleSave}

                    disabled={saving}

                >

                    {saving ? "Kaydediliyor…" : "Kaydet"}

                </button>

            </header>

            <p className="ec-inbox-canned__hint">

                Sık kullanılan cevaplarınızı kaydedin ve müşterilerinize hızlı dönüş yapın.

            </p>

            <div className="ec-inbox-canned__list">

                {rows.map((row) => (

                    <div key={row.id} className="ec-inbox-canned__row">

                        <FaGripVertical className="ec-inbox-canned__drag" aria-hidden />

                        <textarea

                            value={row.text}

                            onChange={(e) => updateRow(row.id, e.target.value)}

                            rows={2}

                            placeholder="Hazır mesaj metni"

                        />

                        <button

                            type="button"

                            className="ec-inbox-canned__remove"

                            onClick={() => removeRow(row.id)}

                            aria-label="Sil"

                        >

                            ×

                        </button>

                    </div>

                ))}

                <button type="button" className="ec-inbox-canned__add" onClick={addRow}>

                    <FaPlus /> Mesaj Ekle

                </button>

            </div>

        </div>

    );

};



export default InboxCannedMessagesPage;

