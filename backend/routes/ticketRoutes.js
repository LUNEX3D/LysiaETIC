/**
 * Ticket Routes — Kullanıcı Tarafı
 * Kullanıcıların destek talebi oluşturma, listeleme, detay ve yanıt işlemleri.
 */
const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");
const {
    getMyTickets,
    getMyTicketDetail,
    createTicket,
    replyToTicket,
} = require("../controllers/ticketController");

const router = express.Router();

// Tüm route'lar auth gerektirir
router.use(authMiddleware);

// Kullanıcının ticketlarını listele
router.get("/", getMyTickets);

// Yeni ticket oluştur
router.post("/", createTicket);

// Ticket detayı
router.get("/:id", getMyTicketDetail);

// Ticket'a yanıt yaz
router.post("/:id/reply", replyToTicket);

module.exports = router;
