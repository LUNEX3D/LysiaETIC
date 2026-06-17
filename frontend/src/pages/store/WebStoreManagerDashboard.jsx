/**
 * frontend/src/pages/store/WebStoreManagerDashboard.jsx
 *
 * Web Mağaza Yönetim Paneli
 * IKAS, Ticimax, IdeaSoft, Shopify tarzı
 *
 * Bölümler:
 * - Dashboard (satış, ürün, müşteri)
 * - Ürünler
 * - Siparişler
 * - Müşteriler
 * - Pazaryeri Senkronizasyonu
 * - Raporlar
 * - Ayarlar
 */

import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import api from '../../services/api';

const TAB_SECTIONS = {
  OVERVIEW: 0,
  PRODUCTS: 1,
  ORDERS: 2,
  CUSTOMERS: 3,
  MARKETPLACE: 4,
  REPORTS: 5,
  SETTINGS: 6,
};

export default function WebStoreManagerDashboard({ storeId }) {
  const [activeTab, setActiveTab] = useState(TAB_SECTIONS.OVERVIEW);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Load Dashboard Data
  useEffect(() => {
    loadDashboardData();
  }, [storeId]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/web-store/${storeId}/dashboard?dateRange=30`);
      setDashboardData(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Dashboard yükleme hatası');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMarketplace = async (marketplace) => {
    setSyncing(true);
    try {
      await api.post(`/web-store/${storeId}/sync-marketplace`, {
        marketplace,
      });

      Alert.success(`${marketplace} başarıyla senkronize edildi`);
      loadDashboardData();
    } catch (err) {
      Alert.error(err.response?.data?.message || 'Senkronizasyon hatası');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          🏪 Web Mağaza Yönetim Paneli
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Mağazanızı takip edin ve yönetin
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<DashboardIcon />} label="Genel Bakış" />
          <Tab icon={<InventoryIcon />} label="Ürünler" />
          <Tab icon={<ShoppingCartIcon />} label="Siparişler" />
          <Tab icon={<PeopleIcon />} label="Müşteriler" />
          <Tab icon={<SyncIcon />} label="Pazaryeri" />
          <Tab icon={<AssessmentIcon />} label="Raporlar" />
          <Tab icon={<SettingsIcon />} label="Ayarlar" />
        </Tabs>
      </Card>

      {/* 0. OVERVIEW TAB */}
      {activeTab === TAB_SECTIONS.OVERVIEW && dashboardData && (
        <Grid container spacing={3}>
          {/* KPI CARDS */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Toplam Siparişler
                </Typography>
                <Typography variant="h5">
                  {dashboardData.summary.totalOrders}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Toplam Ciro
                </Typography>
                <Typography variant="h5">
                  ₺ {dashboardData.summary.totalRevenue.toLocaleString('tr-TR')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Ort. Sipariş Değeri
                </Typography>
                <Typography variant="h5">
                  ₺ {Math.round(dashboardData.summary.averageOrderValue).toLocaleString('tr-TR')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Aktif Ürünler
                </Typography>
                <Typography variant="h5">
                  {dashboardData.summary.totalProducts}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* CHARTS */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Günlük Satışlar
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dashboardData.charts.dailySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="orders" stroke="#8884d8" />
                    <Line type="monotone" dataKey="revenue" stroke="#82ca9d" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Top Ürünler
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.charts.topProducts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Orders */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Son Siparişler
                </Typography>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Sipariş No</TableCell>
                      <TableCell>Müşteri</TableCell>
                      <TableCell>Tutar</TableCell>
                      <TableCell>Durum</TableCell>
                      <TableCell>Tarih</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboardData.recentOrders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell>{order.number}</TableCell>
                        <TableCell>{order.customer}</TableCell>
                        <TableCell>₺ {order.amount}</TableCell>
                        <TableCell>
                          <Chip
                            label={order.status}
                            color={order.status === 'delivered' ? 'success' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{new Date(order.date).toLocaleDateString('tr-TR')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 1. PRODUCTS TAB */}
      {activeTab === TAB_SECTIONS.PRODUCTS && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              📦 Ürün Yönetimi
            </Typography>
            <Typography color="textSecondary">
              Ürün yönetimi özelliği geliştirilme aşamasında
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* 2. ORDERS TAB */}
      {activeTab === TAB_SECTIONS.ORDERS && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              🛒 Sipariş Yönetimi
            </Typography>
            <Typography color="textSecondary">
              Sipariş yönetimi özelliği geliştirilme aşamasında
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* 3. CUSTOMERS TAB */}
      {activeTab === TAB_SECTIONS.CUSTOMERS && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              👥 Müşteri Yönetimi
            </Typography>
            <Typography color="textSecondary">
              Müşteri yönetimi özelliği geliştirilme aşamasında
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* 4. MARKETPLACE TAB */}
      {activeTab === TAB_SECTIONS.MARKETPLACE && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Alert severity="info">
              Pazaryerlerinizle senkronizasyon yapın ve ürünlerinizi otomatik güncelleyin
            </Alert>
          </Grid>

          {['trendyol', 'hepsiburada', 'n11', 'amazon', 'noon'].map(marketplace => (
            <Grid item xs={12} sm={6} md={4} key={marketplace}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ textTransform: 'capitalize', mb: 2 }}>
                    {marketplace}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<SyncIcon />}
                    onClick={() => handleSyncMarketplace(marketplace)}
                    disabled={syncing}
                    fullWidth
                  >
                    Senkronize Et
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* 5. REPORTS TAB */}
      {activeTab === TAB_SECTIONS.REPORTS && (
        <Grid container spacing={3}>
          {['sales', 'products', 'customers', 'financial', 'inventory'].map(report => (
            <Grid item xs={12} sm={6} md={4} key={report}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ textTransform: 'capitalize', mb: 2 }}>
                    {report} Raporu
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AssessmentIcon />}
                    fullWidth
                  >
                    Rapor Oluştur
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* 6. SETTINGS TAB */}
      {activeTab === TAB_SECTIONS.SETTINGS && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3 }}>
                  💳 Ödeme Ayarları
                </Typography>
                <Button variant="outlined" fullWidth>
                  Ödeme Yöntemi Ekle
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3 }}>
                  📦 Kargo Ayarları
                </Typography>
                <Button variant="outlined" fullWidth>
                  Kargo Sağlayıcısı Ekle
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3 }}>
                  💰 Vergi Ayarları
                </Typography>
                <Button variant="outlined" fullWidth>
                  Vergi Yapılandırması
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
}

