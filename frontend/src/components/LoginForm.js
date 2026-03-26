import React, { useState } from "react";
import axios from "../services/api";
import { useNavigate } from "react-router-dom";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import { FaEnvelope, FaLock } from "react-icons/fa";
import "../styles/login.css";

const LoginForm = () => {
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage("");

        try {
            // ✅ API'ye giriş isteği gönder
            const response = await axios.post("/auth/login", formData);

            // 📌 **Token kaydedilmeli!**
            localStorage.setItem("token", response.data.token); // ✅ Token saklandı

            // ✅ Kullanıcı bilgilerini al
            const userResponse = await axios.get("/auth/profile", {
                headers: { Authorization: `Bearer ${response.data.token}` }, // ✅ Token gönderildi
            });

            console.log("Profil Yanıtı:", userResponse.data);

            if (!userResponse.data._id) {
                console.error("❌ Kullanıcı ID API'den alınamadı!");
                setMessage("❌ Kullanıcı bilgileri yüklenemedi.");
                return;
            }

            // ✅ Kullanıcı bilgilerini kaydet
            localStorage.setItem("userId", userResponse.data._id);
            localStorage.setItem("userEmail", userResponse.data.email);
            localStorage.setItem("userName", userResponse.data.name || "Bilinmiyor");
            localStorage.setItem("userRole", userResponse.data.role || "user");

            setMessage("✅ Giriş başarılı! Yönlendiriliyorsunuz...");

            // Yönlendirme
            setTimeout(() => {
                if (userResponse.data.role === "admin") {
                    navigate("/admin");
                } else {
                    navigate("/dashboard");
                }
            }, 1500);

        } catch (error) {
            console.error("❌ Giriş hatası:", error.response?.data || error);
            setMessage("❌ Hata: " + (error.response?.data?.message || "Bir hata oluştu."));
        } finally {
            setIsLoading(false);
        }
    };


    const particlesInit = async (engine) => {
        await loadSlim(engine);
    };

    return (
        <div className="login-container">
            {/* 3D Particles Effect */}
            <Particles
                id="tsparticles"
                init={particlesInit}
                options={{
                    background: { color: { value: "#0d47a1" } },
                    fpsLimit: 60,
                    interactivity: {
                        events: {
                            onHover: { enable: true, mode: "bubble" },
                            onClick: { enable: true, mode: "push" },
                        },
                        modes: {
                            bubble: { distance: 200, size: 10, duration: 2, opacity: 0.8, speed: 3 },
                            push: { quantity: 4 },
                        },
                    },
                    particles: {
                        color: { value: "#ffffff" },
                        links: { color: "#ffffff", distance: 150, enable: true, opacity: 0.5, width: 1 },
                        move: { direction: "none", enable: true, outModes: { default: "bounce" }, speed: 3 },
                        number: { density: { enable: true, area: 800 }, value: 100 },
                        opacity: { value: 0.5 },
                        shape: { type: "circle" },
                        size: { value: { min: 1, max: 5 } },
                    },
                    detectRetina: true,
                }}
            />

            {/* Login Form */}
            <div className="brand-text">LysiaETİC</div>
            <div className="login-box">
                <h2>Giriş Yap</h2>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <FaEnvelope className="icon" />
                        <input
                            type="email"
                            name="email"
                            placeholder="E-posta"
                            value={formData.email}
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
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? <div className="spinner"></div> : "Giriş Yap"}
                    </button>
                </form>
                {message && <p className="message">{message}</p>}
                <div className="auth-links">
                    <p>Hesabınız yok mu? <span onClick={() => navigate("/register")}>Kayıt Ol</span></p>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;
