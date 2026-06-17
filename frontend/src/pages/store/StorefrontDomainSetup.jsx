/**
 * frontend/src/pages/store/StorefrontDomainSetup.jsx
 *
 * Depo custom domain kurulumu
 * Step-by-step wizard for domain setup, DNS verification, SSL provisioning
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Copy,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
  Schedule as ScheduleIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import api from '../../services/api';

const steps = ['Domain Gir', 'DNS Doğrula', 'SSL Oluştur', 'Tamamlandı'];

export default function StorefrontDomainSetup({ storeId, onSuccess }) {
  const [activeStep, setActiveStep] = useState(0);
  const [domain, setDomain] = useState('');
  const [domainRecord, setDomainRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState({
    cname: null,
    txt: null,
  });

  // Step 1: Domain Initiate
  const handleInitiateDomain = async () => {
    if (!domain) {
      setError('Lütfen bir domain adı girin');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/store/${storeId}/domain/initiate`, {
        domain: domain,
      });

      setDomainRecord(response.data.customDomain);
      setActiveStep(1);
    } catch (err) {
      setError(err.response?.data?.message || 'Domain kurulumu başarısız');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify DNS Records
  const handleVerifyDNS = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/store/domain/${domainRecord._id}/verify-dns`);

      if (response.data.success) {
        setVerificationStatus({
          cname: response.data.verification.cname,
          txt: response.data.verification.txt,
        });
        setActiveStep(2);
      } else {
        setError('DNS doğrulaması başarısız oldu. Lütfen kayıtları kontrol edin.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'DNS doğrulama hatası');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Provision SSL
  const handleProvisionSSL = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/store/domain/${domainRecord._id}/provision-ssl`);

      setDomainRecord(prev => ({
        ...prev,
        ssl: response.data.ssl,
      }));
      setActiveStep(3);

      // Callback
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'SSL sertifikası oluşturma başarısız');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 2 }}>
      <Card sx={{ p: 3 }}>
        {/* Header */}
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
          🌐 Özel Domain Kurulumu
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Step 1: Domain Input */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Deponuz için kullanmak istediğiniz domain adını yazın
            </Typography>

            <TextField
              label="Domain Adı"
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase())}
              fullWidth
              variant="outlined"
              sx={{ mb: 3 }}
              helperText="example.com veya shop.example.com (root domain öneriliyor)"
            />

            <Alert severity="info" sx={{ mb: 3 }}>
              <strong>İpucu:</strong> Henüz bir domaine sahip değil misiniz?
              <a href="https://www.namecheap.com" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>
                Namecheap
              </a>
              {' '}veya{' '}
              <a href="https://www.godaddy.com" target="_blank" rel="noopener noreferrer">
                GoDaddy
              </a>
              {' '}gibi sitelerde satın alabilirsiniz.
            </Alert>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleInitiateDomain}
                disabled={loading || !domain}
              >
                {loading ? <CircularProgress size={24} /> : 'Devam Et'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 2: DNS Verification */}
        {activeStep === 1 && domainRecord && (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              <strong>Adım 2:</strong> Lütfen aşağıdaki DNS kayıtlarını domain sağlayıcınızda ekleyin
            </Alert>

            {/* CNAME Record */}
            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, fontWeight: 'bold' }}>
              1️⃣ CNAME Kaydı (Gerekli)
            </Typography>

            <Card sx={{ p: 2, bgcolor: '#f5f5f5', mb: 2 }}>
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">
                    <strong>Name:</strong>
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => copyToClipboard(domain)}
                    startIcon={<Copy />}
                  >
                    Kopyala
                  </Button>
                </Box>
                <TextField
                  value={domain}
                  fullWidth
                  disabled
                  size="small"
                  variant="outlined"
                />
              </Box>

              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">
                    <strong>Type:</strong> CNAME
                  </Typography>
                </Box>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">
                    <strong>Target/Value:</strong>
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => copyToClipboard('lysiaetic.dashtock.io')}
                    startIcon={<Copy />}
                  >
                    Kopyala
                  </Button>
                </Box>
                <TextField
                  value="lysiaetic.dashtock.io"
                  fullWidth
                  disabled
                  size="small"
                  variant="outlined"
                />
              </Box>

              <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
                TTL: 3600 (veya default)
              </Typography>
            </Card>

            <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
              📌 DNS değişiklikleri 5-30 dakika içinde yayılır. Devam etmeden önce bekleyin.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(0)}
              >
                Geri
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={handleVerifyDNS}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'DNS Doğrula'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 3: SSL Provisioning */}
        {activeStep === 2 && (
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              ✅ DNS kayıtları başarıyla doğrulandı!
            </Alert>

            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
              3️⃣ SSL Sertifikası Oluştur
            </Typography>

            <Typography variant="body2" sx={{ mb: 3 }}>
              SSL sertifikası otomatik olarak Let's Encrypt tarafından oluşturulup kurulacaktır.
              Bu işlem 1-5 dakika sürebilir.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleProvisionSSL}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <LockIcon />}
              >
                {loading ? 'Oluşturuluyor...' : 'SSL Sertifikası Oluştur'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 4: Completion */}
        {activeStep === 3 && domainRecord && (
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="h6">✨ Tebrikler!</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Deponuz artık <strong>{domain}</strong> adresinde canlı.
              </Typography>
            </Alert>

            <Card sx={{ p: 2, bgcolor: '#e8f5e9', mb: 3, border: '2px solid #4caf50' }}>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon sx={{ color: '#4caf50' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Domain Bağlandı"
                    secondary={domain}
                  />
                </ListItem>

                <Divider />

                <ListItem>
                  <ListItemIcon>
                    <LockIcon sx={{ color: '#4caf50' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="SSL Sertifikası Aktif"
                    secondary={`Sona erme: ${new Date(domainRecord.ssl.expirationDate).toLocaleDateString('tr-TR')}`}
                  />
                </ListItem>

                <Divider />

                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon sx={{ color: '#4caf50' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Otomatik Yenileme"
                    secondary="SSL sertifikası otomatik olarak yenilenecek"
                  />
                </ListItem>
              </List>
            </Card>

            {/* Quick Links */}
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
              Sonraki Adımlar:
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              <Button variant="outlined" size="small">
                🎨 Tema ve Tasarımı Özelleştir
              </Button>
              <Button variant="outlined" size="small">
                📧 Email Pazarlaması Kur
              </Button>
              <Button variant="outlined" size="small">
                🔍 SEO Ayarlarını Yapılandır
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={() => window.location.reload()}
              >
                Devam
              </Button>
            </Box>
          </Box>
        )}
      </Card>

      {/* Support Info */}
      <Card sx={{ p: 2, mt: 3, bgcolor: '#f9f9f9' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
          💡 Sorun mu yaşıyorsunuz?
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <a href="https://docs.lysiaetic.com/custom-domain" target="_blank" rel="noopener noreferrer">
            Dokümantasyonu
          </a>
          {' '}inceleyin veya{' '}
          <a href="mailto:support@lysiaetic.com">
            support@lysiaetic.com
          </a>
          {' '}ile iletişime geçin.
        </Typography>
      </Card>
    </Box>
  );
}

