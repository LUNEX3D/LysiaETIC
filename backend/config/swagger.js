/**
 * Swagger Configuration — LysiaETIC API
 *
 * ✅ P1-3: Tüm API endpoint'leri için otomatik dokümantasyon
 * Erişim: http://localhost:5000/api-docs
 */
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "LysiaETIC API",
            version: "1.0.0",
            description:
                "LysiaETIC — SaaS E-Ticaret Pazaryeri Entegrasyon Platformu API Dokümantasyonu.\n\n" +
                "Bu API, satıcıların Trendyol, Hepsiburada, N11, ÇiçekSepeti ve Amazon gibi " +
                "pazaryerlerini tek panelden yönetmesini sağlar.",
            contact: {
                name: "Dashtock Destek",
                url: "https://dashtock.com",
            },
            license: {
                name: "Proprietary",
            },
        },
        servers: [
            {
                url: "http://localhost:5000/api",
                description: "Geliştirme Sunucusu",
            },
            {
                url: "https://dashtock.com/api",
                description: "Production Sunucusu",
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "JWT Access Token — Login sonrası dönen `token` değerini girin.",
                },
            },
            schemas: {
                // ── Ortak Response Şemaları ──
                Error: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string", example: "Bir hata oluştu." },
                    },
                },
                Success: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string" },
                    },
                },

                // ── Auth Şemaları ──
                LoginRequest: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: { type: "string", format: "email", example: "user@example.com" },
                        password: { type: "string", format: "password", example: "MyP@ss123" },
                    },
                },
                RegisterRequest: {
                    type: "object",
                    required: ["name", "email", "password"],
                    properties: {
                        name: { type: "string", example: "Ahmet Yılmaz" },
                        email: { type: "string", format: "email", example: "ahmet@example.com" },
                        password: { type: "string", format: "password", minLength: 8, example: "MyP@ss123" },
                    },
                },
                AuthResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        token: { type: "string", description: "JWT Access Token" },
                        refreshToken: { type: "string", description: "JWT Refresh Token" },
                        user: {
                            type: "object",
                            properties: {
                                _id: { type: "string" },
                                name: { type: "string" },
                                email: { type: "string" },
                                role: { type: "string", enum: ["user", "admin", "dev"] },
                            },
                        },
                    },
                },
                RefreshTokenRequest: {
                    type: "object",
                    required: ["refreshToken"],
                    properties: {
                        refreshToken: { type: "string", description: "Mevcut refresh token" },
                    },
                },

                // ── User Şemaları ──
                UserProfile: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        name: { type: "string" },
                        email: { type: "string" },
                        role: { type: "string", enum: ["user", "admin", "dev"] },
                        isVerified: { type: "boolean" },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
                ChangePasswordRequest: {
                    type: "object",
                    required: ["currentPassword", "newPassword"],
                    properties: {
                        currentPassword: { type: "string" },
                        newPassword: { type: "string", minLength: 8 },
                    },
                },

                // ── Marketplace Şemaları ──
                Marketplace: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        userId: { type: "string" },
                        marketplaceName: { type: "string", enum: ["Trendyol", "Hepsiburada", "n11", "ÇiçekSepeti", "Amazon"] },
                        isActive: { type: "boolean" },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
                AddMarketplaceRequest: {
                    type: "object",
                    required: ["marketplaceName", "credentials"],
                    properties: {
                        marketplaceName: { type: "string", enum: ["Trendyol", "Hepsiburada", "n11", "ÇiçekSepeti", "Amazon"] },
                        credentials: {
                            type: "object",
                            description: "Pazaryerine göre değişen API anahtarları",
                        },
                    },
                },

                // ── Product Şemaları ──
                Product: {
                    type: "object",
                    properties: {
                        marketplace: { type: "string" },
                        productId: { type: "string" },
                        productName: { type: "string" },
                        productImage: { type: "string" },
                        stock: { type: "number" },
                        price: { type: "number" },
                        listPrice: { type: "number" },
                        barcode: { type: "string" },
                        stockCode: { type: "string" },
                        categoryName: { type: "string" },
                        brand: { type: "string" },
                        status: { type: "string" },
                    },
                },

                // ── Order Şemaları ──
                Order: {
                    type: "object",
                    properties: {
                        orderId: { type: "string" },
                        marketplace: { type: "string" },
                        status: { type: "string" },
                        totalPrice: { type: "number" },
                        orderDate: { type: "string", format: "date-time" },
                    },
                },

                // ── Notification Şemaları ──
                Notification: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        type: { type: "string" },
                        title: { type: "string" },
                        message: { type: "string" },
                        isRead: { type: "boolean" },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },

                // ── Subscription Şemaları ──
                Subscription: {
                    type: "object",
                    properties: {
                        plan: { type: "string", enum: ["free", "starter", "professional", "enterprise"] },
                        status: { type: "string", enum: ["active", "expired", "cancelled"] },
                        startDate: { type: "string", format: "date-time" },
                        endDate: { type: "string", format: "date-time" },
                    },
                },
            },
        },
        tags: [
            { name: "Auth", description: "Kimlik doğrulama — Kayıt, Giriş, Token yenileme, Çıkış" },
            { name: "User", description: "Kullanıcı profili ve ayarları" },
            { name: "Dashboard", description: "Ana panel özet verileri" },
            { name: "Marketplace", description: "Pazaryeri entegrasyon yönetimi (CRUD)" },
            { name: "Products", description: "Pazaryerlerinden ürün çekme" },
            { name: "Product Management", description: "Ürün CRUD, import/export, senkronizasyon" },
            { name: "Advanced Products", description: "Gelişmiş ürün çekme ve karşılaştırma" },
            { name: "Orders", description: "Sipariş yönetimi ve senkronizasyon" },
            { name: "Finance", description: "Finans özeti ve Trendyol mali verileri" },
            { name: "Analytics", description: "Satış analizi, trendler, performans" },
            { name: "Cargo", description: "Kargo takip" },
            { name: "Categories", description: "Kategori listeleme" },
            { name: "AI", description: "AI önerileri, karar motoru, chat" },
            { name: "AI Engine", description: "AI Decision Engine — öneriler, simülasyon, brain" },
            { name: "AI Chat", description: "AI Operatör — chat, otonom döngü" },
            { name: "Roketfy", description: "Marketplace Intelligence — araştırma, analiz" },
            { name: "E-Invoice", description: "E-Fatura / E-Arşiv — çoklu sağlayıcı" },
            { name: "Notifications", description: "Bildirim yönetimi" },
            { name: "PayTR", description: "Ödeme ve abonelik yönetimi" },
            { name: "Admin", description: "Admin panel — kullanıcı, ürün, sipariş yönetimi" },
            { name: "SaaS Admin", description: "SaaS yönetim paneli — tenant, abonelik, ödeme" },
            { name: "Hepsiburada", description: "Hepsiburada özel endpoint'leri" },
            { name: "ÇiçekSepeti", description: "ÇiçekSepeti özel endpoint'leri" },
            { name: "Amazon", description: "Amazon SP-API endpoint'leri" },
            { name: "Brands", description: "Marka yönetimi" },
            { name: "Upload", description: "Ürün yükleme" },
            { name: "Variants", description: "Ürün varyant yönetimi" },
        ],
    },
    apis: ["./docs/swagger/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
