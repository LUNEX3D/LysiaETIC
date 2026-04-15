/**
 * Ticket Controller — Kullanıcı Tarafı
 * Kullanıcıların destek talebi oluşturma, listeleme, detay görme ve yanıt yazma işlemleri.
 */
const Ticket = require("../models/Ticket");
const crypto = require("crypto");

/**
 * Benzersiz ticket numarası üret: TKT-XXXXXX
 */
const generateTicketNumber = () => {
    const hex = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `TKT-${hex}`;
};

/**
 * GET /api/tickets — Kullanıcının kendi ticketlarını listele
 */
exports.getMyTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({ userId: req.user._id })
            .populate("assignedTo", "name")
            .sort({ createdAt: -1 });
        res.json({ success: true, tickets });
    } catch (error) {
        console.error("getMyTickets error:", error);
        res.status(500).json({ success: false, message: "Ticketlar alınamadı." });
    }
};

/**
 * GET /api/tickets/:id — Ticket detayı (sadece kendi ticket'ı)
 */
exports.getMyTicketDetail = async (req, res) => {
    try {
        const ticket = await Ticket.findOne({ _id: req.params.id, userId: req.user._id })
            .populate("assignedTo", "name")
            .populate("messages.sender", "name");
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket bulunamadı." });
        }
        res.json({ success: true, ticket });
    } catch (error) {
        console.error("getMyTicketDetail error:", error);
        res.status(500).json({ success: false, message: "Ticket detayı alınamadı." });
    }
};

/**
 * POST /api/tickets — Yeni ticket oluştur
 */
exports.createTicket = async (req, res) => {
    try {
        const { subject, category, priority, message } = req.body;

        if (!subject || !subject.trim()) {
            return res.status(400).json({ success: false, message: "Konu alanı zorunludur." });
        }
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: "Mesaj alanı zorunludur." });
        }

        // Benzersiz ticket numarası üret (çakışma kontrolü)
        let ticketNumber = generateTicketNumber();
        let attempts = 0;
        while (await Ticket.findOne({ ticketNumber }) && attempts < 10) {
            ticketNumber = generateTicketNumber();
            attempts++;
        }

        const ticket = await Ticket.create({
            userId: req.user._id,
            ticketNumber,
            subject: subject.trim(),
            category: category || "general",
            priority: priority || "medium",
            status: "open",
            messages: [{
                sender: req.user._id,
                senderType: "user",
                message: message.trim(),
                timestamp: new Date(),
            }],
        });

        res.status(201).json({ success: true, ticket });
    } catch (error) {
        console.error("createTicket error:", error);
        res.status(500).json({ success: false, message: "Ticket oluşturulamadı." });
    }
};

/**
 * POST /api/tickets/:id/reply — Ticket'a kullanıcı yanıtı ekle
 */
exports.replyToTicket = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: "Mesaj alanı zorunludur." });
        }

        const ticket = await Ticket.findOne({ _id: req.params.id, userId: req.user._id });
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket bulunamadı." });
        }

        // Kapalı ticket'a yanıt yazılamaz
        if (ticket.status === "closed") {
            return res.status(400).json({ success: false, message: "Kapatılmış ticket'a yanıt yazılamaz." });
        }

        ticket.messages.push({
            sender: req.user._id,
            senderType: "user",
            message: message.trim(),
            timestamp: new Date(),
        });

        // Müşteri bekleniyor durumundaysa tekrar açık yap
        if (ticket.status === "waiting_customer") {
            ticket.status = "open";
        }

        await ticket.save();

        // Populate edip geri dön
        await ticket.populate("messages.sender", "name");
        await ticket.populate("assignedTo", "name");

        res.json({ success: true, ticket });
    } catch (error) {
        console.error("replyToTicket error:", error);
        res.status(500).json({ success: false, message: "Yanıt gönderilemedi." });
    }
};
