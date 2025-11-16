const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import Models
const Traffic = require('../models/Traffic');
const Order = require('../models/Order');
// FIX: Sahi model use ho raha hai
const ContactMessage = require('../models/ContactMessage'); 

// =========================================================================
// 1. /api/v1/stats (Stat Cards) 
// =========================================================================
router.get('/stats', async (req, res) => {
    try {
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousMonthEnd = currentMonthStart;

        // Current and Previous Traffic Counts (Uses Traffic Model)
        const currentTraffic = await Traffic.countDocuments({
            createdAt: { $gte: currentMonthStart, $lt: nextMonthStart }
        });
        const previousTraffic = await Traffic.countDocuments({
            createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd }
        });
        const trafficGrowth = previousTraffic > 0 ? ((currentTraffic - previousTraffic) / previousTraffic * 100).toFixed(1) : 0;

        // Current and Previous Sales Counts (Uses ORDER Model)
        const currentSalesCount = await Order.countDocuments({
            createdAt: { $gte: currentMonthStart, $lt: nextMonthStart },
            status: { $in: ['Delivered', 'Shipped'] } 
        });
        const previousSalesCount = await Order.countDocuments({
            createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd },
            status: { $in: ['Delivered', 'Shipped'] }
        });

        // Conversion Rate Calculation
        const conversionRate = currentTraffic > 0 ? (currentSalesCount / currentTraffic * 100).toFixed(1) : 0;
        const previousConversion = previousTraffic > 0 ? (previousSalesCount / previousTraffic * 100) : 0;
        const conversionGrowth = previousConversion > 0 ? ((conversionRate - previousConversion) / previousConversion * 100).toFixed(1) : 0;

        // Active Users (Unique Browsers) Aggregation (Uses Traffic Model)
        const activeUsersAggregation = await Traffic.aggregate([
            { $match: { createdAt: { $gte: currentMonthStart, $lt: nextMonthStart } } },
            { $group: { _id: '$browser' } },
            { $count: 'uniqueBrowsers' }
        ]);
        const activeUsers = activeUsersAggregation.length > 0 ? activeUsersAggregation[0].uniqueBrowsers : 0;

        const previousActiveAggregation = await Traffic.aggregate([
            { $match: { createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } } },
            { $group: { _id: '$browser' } },
            { $count: 'uniqueBrowsers' }
        ]);
        const previousActive = previousActiveAggregation.length > 0 ? previousActiveAggregation[0].uniqueBrowsers : 0;
        const usersGrowth = previousActive > 0 ? ((activeUsers - previousActive) / previousActive * 100).toFixed(1) : 0;

        // Mock data for Operational Health & Session
        const sessionDuration = 85;
        const sessionGrowth = -22;
        const avgDailySales = await Order.aggregate([
            { $match: { status: 'Delivered' } },
            { $group: { _id: null, totalSales: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
        ]);
        const totalSales = avgDailySales.length > 0 ? avgDailySales[0].totalSales : 0;
        const daysInMonth = (nextMonthStart - currentMonthStart) / (1000 * 60 * 60 * 24);
        const avgSales = totalSales / daysInMonth;


        res.json({
            websiteTraffic: currentTraffic.toLocaleString(),
            conversionRate: conversionRate + '%',
            activeUsers: activeUsers.toLocaleString(),
            sessionDuration: sessionDuration + ' Sec',
            trafficGrowth: (trafficGrowth >= 0 ? '+' : '') + trafficGrowth + '%',
            conversionGrowth: (conversionGrowth >= 0 ? '+' : '') + conversionGrowth + '%',
            usersGrowth: (usersGrowth >= 0 ? '+' : '') + usersGrowth + '%',
            sessionGrowth: sessionGrowth + '%',
            avgDailySales: avgSales.toFixed(2), 
            serverUptime: '99.9%',
            apiLatencyMs: 45,
            npsScore: 7.8
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// =========================================================================
// 2. /api/v1/earnings-report (Bar Chart) - Uses Order Model
// =========================================================================
router.get('/earnings-report', async (req, res) => {
    try {
        const earnings = await Order.aggregate([
            { $match: { status: 'Delivered' } },
            {
                $group: {
                    _id: { $month: '$createdAt' },
                    totalAmount: { $sum: '$totalAmount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dataA = new Array(12).fill(0); 
        const dataB = new Array(12).fill(0); 

        earnings.forEach(item => {
            const monthIndex = item._id - 1;
            dataA[monthIndex] = item.totalAmount;
            dataB[monthIndex] = item.totalAmount * 0.8;
        });

        const totalEarnings = dataA.reduce((sum, val) => sum + val, 0);
        const totalProfit = dataB.reduce((sum, val) => sum + val, 0);
        const totalTax = totalEarnings * 0.1; 
        const totalExpense = totalEarnings * 0.1; 

        res.json({
            labels,
            dataA,
            dataB,
            summary: {
                earnings: "$" + totalEarnings.toFixed(2),
                profit: "$" + totalProfit.toFixed(2),
                tax: "$" + totalTax.toFixed(2),
                expense: "$" + totalExpense.toFixed(2)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// =========================================================================
// 3. /api/v1/device-visits (Progress Bars) - Uses Traffic
// =========================================================================
router.get('/device-visits', async (req, res) => {
    try {
        const deviceData = await Traffic.aggregate([
            { $group: { _id: '$device', count: { $sum: 1 } } }
        ]);

        const total = deviceData.reduce((sum, item) => sum + item.count, 0);
        let mobile = 0, tablet = 0, web = 0;

        deviceData.forEach(item => {
            const percent = total > 0 ? (item.count / total * 100).toFixed(0) : 0;
            if (item._id === 'Mobile') mobile = percent;
            if (item._id === 'Tablet') tablet = percent;
            if (item._id === 'Web') web = percent;
        });

        res.json({
            mobile,
            tablet,
            web
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// =========================================================================
// 4. /api/v1/traffic-source (Traffic List) - Uses Traffic
// =========================================================================
router.get('/traffic-source', async (req, res) => {
    try {
        const sourceData = await Traffic.aggregate([
            { $group: { _id: '$source', clicks: { $sum: 1 } } },
            { $sort: { clicks: -1 } }
        ]);

        const maxClicks = sourceData.length > 0 ? sourceData[0].clicks : 0;

        const result = sourceData.map(item => ({
            source: item._id || 'Unknown',
            clicks: item.clicks,
            percentage: maxClicks > 0 ? (item.clicks / maxClicks * 100).toFixed(0) : 0
        }));

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// =========================================================================
// 5. /api/v1/sales-countries (Sales List) - Syntax Error Fix Applied
// =========================================================================
router.get('/sales-countries', async (req, res) => {
    try {
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousMonthEnd = currentMonthStart;

        // Current Month Sales by Country
        const currentSales = await Order.aggregate([
            { $match: { 
                createdAt: { $gte: currentMonthStart, $lt: nextMonthStart },
                status: 'Delivered' 
            } },
            { $group: { 
                _id: '$shippingAddress.country', 
                totalSales: { $sum: '$totalAmount' } 
            } },
            { $sort: { totalSales: -1 } }
        ]);

        // Previous Month Sales by Country
        const previousSales = await Order.aggregate([
            { $match: { 
                createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd },
                status: 'Delivered' 
            } },
            { $group: { 
                _id: '$shippingAddress.country', 
                totalSales: { $sum: '$totalAmount' } 
            } }
        ]);

        const previousMap = new Map(previousSales.map(item => [item._id, item.totalSales]));

        const flags = {
            'United States': '🇺🇸',
            'India': '🇮🇳',
            'Canada': '🇨🇦',
            'New Zealand': '🇳🇿',
            'Pakistan': '🇵🇰' 
        };

        const result = currentSales.map(item => {
            const current = item.totalSales;
            const prev = previousMap.get(item._id) || 0;
            
            // Fixed calculation: calculate number first, then format string
            let growthValue = 0;
            if (prev > 0) {
                growthValue = ((current - prev) / prev * 100);
            }
            
            const growthDisplay = growthValue.toFixed(1); 
            
            return {
                flag: flags[item._id] || '🏳️',
                name: item._id,
                value: '$' + (current / 1000).toFixed(0) + 'K',
                growth: (growthValue >= 0 ? '+' : '') + growthDisplay + '%'
            };
        });

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// =========================================================================
// 6. /api/v1/campaign-source (Campaign Table) - Uses Order Model
// =========================================================================
router.get('/campaign-source', async (req, res) => {
    try {
        const orderChannelData = await Order.aggregate([
            { $match: { status: 'Delivered' } },
            { 
                $group: {
                    _id: '$paymentMethod', 
                    totalSales: { $sum: '$totalAmount' },
                    count: { $sum: 1 } 
                } 
            },
            { $sort: { totalSales: -1 } }
        ]);

        const result = orderChannelData.map(item => {
            let source = 'Unknown';
            let medium = 'Unknown';
            if (item._id === 'cod') {
                source = 'Offline'; medium = 'Cash';
            } else if (item._id === 'stripe' || item._id === 'paypal') {
                source = 'Payment Gateway'; medium = 'Online';
            }
            
            return {
                source: source,
                medium: medium,
                campaign: item._id || 'Unknown',
                clicks: item.count,
                conversion: (item.totalSales / item.count / 100).toFixed(2) + '%' 
            };
        });

        if (result.length < 3) {
            result.push({ source: 'Social', medium: 'Instagram', campaign: 'Q4_Ad', clicks: 400, conversion: '3.00%' });
        }

        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// =========================================================================
// 7. /api/v1/top-pages (Page List) - Uses Traffic
// =========================================================================
router.get('/top-pages', async (req, res) => {
    try {
        const pageData = await Traffic.aggregate([
            { $group: { _id: '$pageUrl', clicks: { $sum: 1 } } },
            { $sort: { clicks: -1 } },
            { $limit: 4 }
        ]);

        const result = pageData.map(item => ({
            url: item._id,
            clicks: item.clicks,
            position: (Math.random() * 10).toFixed(2) 
        }));

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// =========================================================================
// 8. /api/v1/top-leads (Leads Chart) - FINAL FIX: Use ContactMessage and $toDate
// =========================================================================
router.get('/top-leads', async (req, res) => {
    try {
        // FIX: ContactMessage model ka istemal karein
        const leads = await ContactMessage.aggregate([
            {
                // Ensure 'createdAt' exists and is not null
                $match: {
                    createdAt: { $exists: true, $ne: null } 
                }
            },
            {
                $group: {
                    // CRITICAL: Explicitly convert to Date object for accurate month extraction
                    _id: { $month: { $toDate: "$createdAt" } }, 
                    count: { $sum: 1 } 
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const data = new Array(12).fill(0);

        leads.forEach(item => {
            const monthIndex = item._id - 1; 
            data[monthIndex] = item.count;
        });

        res.json({
            labels,
            data
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// =========================================================================
// 9. /api/v1/top-session (Pie Chart) - Uses Traffic
// =========================================================================
router.get('/top-session', async (req, res) => {
    try {
        const browserData = await Traffic.aggregate([
            { $group: { _id: '$browser', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const labels = browserData.map(item => item._id || 'Unknown');
        const data = browserData.map(item => item.count);

        // Convert to percentages
        const total = data.reduce((sum, val) => sum + val, 0);
        const percentData = data.map(val => total > 0 ? (val / total * 100).toFixed(0) : 0);

        res.json({
            labels,
            data: percentData
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});


// =========================================================================
// 10. /api/v1/traffic-source (Traffic Recording Endpoint) - Uses Traffic
// =========================================================================
router.post('/traffic-source', async (req, res) => {
    try {
        const { device, browser, source, pageUrl } = req.body; 

        if (!device || !pageUrl) {
            return res.status(400).json({ 
                msg: 'Device and pageUrl are required to record traffic.' 
            });
        }

        const newTraffic = new Traffic({
            device: device, 
            browser: browser || 'Unknown', 
            source: source || 'direct', 
            pageUrl: pageUrl, 
        });

        await newTraffic.save();
        
        res.status(201).json({ message: 'Traffic recorded successfully' });

    } catch (err) {
        console.error('Error recording traffic:', err);
        res.status(500).send('Server Error');
    }
});


module.exports = router;