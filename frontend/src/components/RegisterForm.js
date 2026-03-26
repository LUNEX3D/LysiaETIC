    import React, { useState } from "react";
    import axios from "../services/api";
    import { useNavigate } from "react-router-dom";
    import Particles from "react-tsparticles";
    import { loadSlim } from "tsparticles-slim";
    import { FaUser, FaEnvelope, FaLock } from "react-icons/fa";
    import "../styles/login.css"; // Aynı stil dosyasını kullanıyoruz

    const RegisterForm = () => {
        const [formData, setFormData] = useState({ name: "", email: "", password: "" });
        const [message, setMessage] = useState("");
        const [isLoading, setIsLoading] = useState(false);
        const navigate = useNavigate();

        const handleChange = (e) => {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsLoading(true);

            console.log("Kayıt bilgileri gönderiliyor:", formData); // 🔍 Konsola kayıt bilgilerini yazdır

            try {
                const response = await axios.post("/auth/register", formData);
                console.log("API Yanıtı:", response.data); // 🔍 API'den dönen yanıtı konsolda göster

                setMessage("Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...");

                setTimeout(() => {
                    document.querySelector(".register-box")?.classList.add("fade-out");
                    setTimeout(() => navigate("/login"), 500);
                }, 2000);
            } catch (error) {
                console.error("❌ Kayıt hatası:", error.response?.data || error);
                setMessage("Hata: " + (error.response?.data?.message || "Bir hata oluştu"));
            } finally {
                setIsLoading(false);
            }
        };

        const particlesInit = async (engine) => {
            await loadSlim(engine);
        };

        return (
            <div className="login-container">
                <Particles
                    id="tsparticles"
                    init={particlesInit}
                    options={{
                        background: {
                            color: {
                                value: "#0d47a1",
                            },
                        },
                        fpsLimit: 60,
                        interactivity: {
                            events: {
                                onHover: {
                                    enable: true,
                                    mode: "bubble",
                                },
                                onClick: {
                                    enable: true,
                                    mode: "push",
                                },
                            },
                            modes: {
                                bubble: {
                                    distance: 200,
                                    size: 10,
                                    duration: 2,
                                    opacity: 0.8,
                                    speed: 3,
                                },
                                push: {
                                    quantity: 4,
                                },
                            },
                        },
                        particles: {
                            color: {
                                value: "#ffffff",
                            },
                            links: {
                                color: "#ffffff",
                                distance: 150,
                                enable: true,
                                opacity: 0.5,
                                width: 1,
                            },
                            collisions: {
                                enable: true,
                            },
                            move: {
                                direction: "none",
                                enable: true,
                                outModes: {
                                    default: "bounce",
                                },
                                random: false,
                                speed: 3,
                                straight: false,
                            },
                            number: {
                                density: {
                                    enable: true,
                                    area: 800,
                                },
                                value: 100,
                            },
                            opacity: {
                                value: 0.5,
                            },
                            shape: {
                                type: "circle",
                            },
                            size: {
                                value: { min: 1, max: 5 },
                            },
                        },
                        detectRetina: true,
                    }}
                />
                <div className="brand-text">LysiaETİC</div>
                <div className="register-box">
                    <h2>Kayıt Ol</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <FaUser className="icon" />
                            <input
                                type="text"
                                name="name"
                                placeholder="Adınız"
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <FaEnvelope className="icon" />
                            <input
                                type="email"
                                name="email"
                                placeholder="E-posta"
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <FaLock className="icon" />
                            <input
                                type="password"
                                name="password"
                                placeholder="Şifre"
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <div className="spinner"></div>
                            ) : (
                                "Kayıt Ol"
                            )}
                        </button>
                    </form>
                    {message && <p className="message">{message}</p>}
                    <div className="auth-links">
                        <p>Zaten hesabınız var mı? <span onClick={() => navigate("/login")}>Giriş Yap</span></p>
                    </div>
                </div>
            </div>
        );
    };

    export default RegisterForm;