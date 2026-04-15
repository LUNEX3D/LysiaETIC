/**
 * Ticket API Service — Kullanıcı Tarafı
 * Destek talebi oluşturma, listeleme, detay ve yanıt işlemleri.
 */
import API from "./api";

const BASE = "/tickets";

/** Kullanıcının tüm ticketlarını getir */
export const getMyTickets = () => API.get(BASE);

/** Ticket detayını getir */
export const getMyTicketDetail = (id) => API.get(`${BASE}/${id}`);

/** Yeni ticket oluştur */
export const createTicket = (data) => API.post(BASE, data);

/** Ticket'a yanıt yaz */
export const replyToTicket = (id, message) => API.post(`${BASE}/${id}/reply`, { message });
