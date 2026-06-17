import React from "react";

import { FaArrowRight, FaInstagram, FaFacebook, FaWhatsapp } from "react-icons/fa";

import DashtockLogo from "../../../components/brand/DashtockLogo";

import DashtockLogoMark from "../../../components/brand/DashtockLogoMark";



const InboxOnboardingWelcome = ({ onContinue, ctaLabel = "Devam Et" }) => (

    <div className="ec-inbox-onboard">

        <div className="ec-inbox-onboard__logo">

            <DashtockLogo size={34} full />

        </div>

        <div className="ec-inbox-onboard__card">

            <h1>Destek Hizmetine Hoş Geldin!</h1>

            <p>

                Bağladığın kanallardan gelen tüm müşteri mesajları burada toplanır. Konuşmaları tek

                ekrandan görüp kolayca yanıtlayabilirsin.

            </p>

            <div className="ec-inbox-onboard__brand">

                <div className="ec-inbox-onboard__brand-glow" aria-hidden />

                <div className="ec-inbox-onboard__illus">

                    <DashtockLogoMark size={56} animated className="ec-inbox-onboard__brand-mark" />

                    <span className="ec-inbox-onboard__illus-ch ec-inbox-onboard__illus-ch--ig" aria-hidden>

                        <FaInstagram />

                    </span>

                    <span className="ec-inbox-onboard__illus-ch ec-inbox-onboard__illus-ch--fb" aria-hidden>

                        <FaFacebook />

                    </span>

                    <span className="ec-inbox-onboard__illus-ch ec-inbox-onboard__illus-ch--wa" aria-hidden>

                        <FaWhatsapp />

                    </span>

                </div>

            </div>

            <button type="button" className="ec-inbox-onboard__primary" onClick={onContinue}>

                {ctaLabel} <FaArrowRight />

            </button>

        </div>

    </div>

);



export default InboxOnboardingWelcome;

