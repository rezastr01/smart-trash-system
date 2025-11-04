// تنظیمات سیستم
const CHANNEL_ID = '3116788';
const API_KEY = 'FOB57VQ57OC6VAP8';
const UPDATE_TIME = 10000; // 10 ثانیه
const OFFLINE_THRESHOLD = 30000; // 30 ثانیه

// اطلاعات سطل‌های دانشگاه مهارت ملی
const trashCans = [
    {
        id: 1,
        name: 'سطل اصلی دانشگاه',
        location: [38.043972, 46.268583],
        status: 'unknown',
        fill: 0,
        distance: 0,
        lastUpdate: null,
        isReal: true
    },
    {
        id: 2,
        name: 'سطل محوطه مرکزی',
        location: [38.044300, 46.268900],
        status: 'empty',
        fill: 0,
        distance: 12,
        lastUpdate: null,
        isReal: false
    },
    {
        id: 3,
        name: 'سطل ورودی شرقی',
        location: [38.043600, 46.268200],
        status: 'empty', 
        fill: 0,
        distance: 10,
        lastUpdate: null,
        isReal: false
    }
];

let map;
let markers = [];
let isOnline = false;
let lastSuccessfulUpdate = null;
let autoRefreshInterval = null;

// سیستم آمار و مانیتورینگ
let systemStats = {
    totalFetchAttempts: 0,
    successfulFetches: 0,
    failedFetches: 0,
    lastError: null,
    startupTime: new Date()
};

// ایجاد نقشه
function initMap() {
    map = L.map('map').setView([38.043972, 46.268583], 16);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(map);
    
    createMarkers();
}

// ایجاد مارکرهای سطل‌ها
function createMarkers() {
    trashCans.forEach(trash => {
        const marker = L.marker(trash.location, {
            icon: getTrashIcon(trash.status, trash.isReal)
        }).addTo(map);
        
        markers.push({
            id: trash.id,
            marker: marker,
            trash: trash
        });
        
        updateMarkerPopup(marker, trash);
        
        if (trash.isReal) {
            marker.on('click', function() {
                updateCurrentTrashDisplay(trash.id);
            });
        }
    });
}

// ایجاد آیکون سفارشی برای سطل‌ها
function getTrashIcon(status, isReal) {
    let color;
    switch(status) {
        case 'empty': color = '#27ae60'; break;
        case 'half': color = '#f39c12'; break;
        case 'full': color = '#e74c3c'; break;
        default: color = '#95a5a6';
    }
    
    const className = isReal ? 'custom-trash-icon' : 'custom-trash-icon demo';
    
    return L.divIcon({
        className: className,
        html: `
            <div style="
                background: ${color};
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 18px;
                cursor: pointer;
            ">🗑️</div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
}

// آپدیت پاپ‌آپ مارکر
function updateMarkerPopup(marker, trash) {
    let statusText, timeText, systemStatus;
    
    if (trash.isReal) {
        statusText = getStatusText(trash.status);
        timeText = trash.lastUpdate ? 
            trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
        systemStatus = isOnline ? '🟢 آنلاین' : '🔴 آفلاین';
    } else {
        statusText = getStatusText(trash.status);
        timeText = 'دمو';
        systemStatus = '⚪ دمو';
    }
    
    const popupContent = `
        <div style="padding: 12px; min-width: 220px; font-family: Vazir, sans-serif;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">🗑️ ${trash.name}</h4>
            <div style="display: grid; gap: 6px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">وضعیت:</span>
                    <strong style="color: ${getStatusColor(trash.status)}">${statusText}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">میزان پر:</span>
                    <strong>${trash.fill}%</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">فاصله:</span>
                    <strong>${trash.distance}cm</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">موقعیت:</span>
                    <strong>${trash.location[0].toFixed(6)}, ${trash.location[1].toFixed(6)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">بروزرسانی:</span>
                    <strong>${timeText}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #7f8c8d;">وضعیت سیستم:</span>
                    <strong>${systemStatus}</strong>
                </div>
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent);
}

// دریافت داده از Thingspeak
async function fetchData() {
    systemStats.totalFetchAttempts++;
    
    try {
        console.log('🔄 دریافت داده از ThingSpeak...');
        
        const timestamp = new Date().getTime();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(
            `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds/last.json?api_key=${API_KEY}&round=2&_=${timestamp}`,
            { signal: controller.signal }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`خطای HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 داده دریافتی:', data);
        
        // بررسی کامل داده
        if (data && data.created_at && data.field1 !== null && data.field2 !== null) {
            const dataTime = new Date(data.created_at).getTime();
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - dataTime;
            
            console.log(`⏰ اختلاف زمان با سرور: ${Math.round(timeDiff/1000)} ثانیه`);
            
            // فقط اگر داده جدیدتر از 25 ثانیه باشد، پردازش کن
            if (timeDiff < 25000) {
                lastSuccessfulUpdate = Date.now();
                systemStats.successfulFetches++;
                systemStats.lastError = null;
                
                processThingSpeakData(data);
                
                // فقط اگر آنلاین نیستیم، وضعیت را تغییر دهیم
                if (!isOnline) {
                    setSystemOnline();
                }
                console.log('✅ داده جدید پردازش شد');
            } else {
                console.log('❌ داده بسیار قدیمی - نادیده گرفته شد');
                systemStats.failedFetches++;
                systemStats.lastError = 'داده قدیمی';
                // وضعیت آنلاین را تغییر نده
            }
        } else {
            throw new Error('داده ناقص یا نامعتبر دریافت شد');
        }
        
    } catch (error) {
        console.error('❌ خطا در دریافت داده:', error.message);
        systemStats.failedFetches++;
        systemStats.lastError = error.message;
        // در صورت خطا، وضعیت آنلاین را مستقیماً تغییر نده
    }
}

// پردازش داده Thingspeak
function processThingSpeakData(data) {
    const fillPercentage = Math.round(parseFloat(data.field1));
    const distance = parseFloat(data.field2);
    
    console.log(`📊 پردازش داده: ${fillPercentage}% | فاصله: ${distance}cm`);
    
    let status;
    if (fillPercentage >= 80) {
        status = 'full';
    } else if (fillPercentage >= 50) {
        status = 'half';
    } else {
        status = 'empty';
    }
    
    updateRealTrashCan(status, fillPercentage, distance);
    updateAllDisplays(1);
}

// آپدیت فقط سطل واقعی
function updateRealTrashCan(status, fillPercentage, distance) {
    const realTrash = trashCans.find(trash => trash.isReal);
    if (realTrash) {
        realTrash.status = status;
        realTrash.fill = fillPercentage;
        realTrash.distance = distance;
        realTrash.lastUpdate = new Date();
    }
}

// بررسی وضعیت آنلاین
function checkSystemOnline() {
    const now = Date.now();
    
    if (!lastSuccessfulUpdate) {
        console.log('🔴 هیچ داده موفقی دریافت نشده - آفلاین');
        setSystemOffline();
        return;
    }
    
    const timeSinceLastUpdate = now - lastSuccessfulUpdate;
    console.log(`⏰ ${Math.round(timeSinceLastUpdate/1000)} ثانیه از آخرین بروزرسانی موفق`);
    
    // اگر بیش از 30 ثانیه از آخرین بروزرسانی گذشته باشد، آفلاین شود
    if (timeSinceLastUpdate > OFFLINE_THRESHOLD) {
        console.log('🔴 سیستم آفلاین - داده قدیمی');
        setSystemOffline();
    }
    // اگر کمتر از 25 ثانیه گذشته باشد و آنلاین نیست، آنلاین شود
    else if (timeSinceLastUpdate < 25000) {
        if (!isOnline) {
            console.log('✅ سیستم آنلاین شد');
            setSystemOnline();
        }
    }
    // بین 25 تا 30 ثانیه - وضعیت را تغییر نده
    else {
        console.log('⚠️ وضعیت نامشخص - حفظ وضعیت فعلی');
    }
}

// تنظیم وضعیت آنلاین سیستم
function setSystemOnline() {
    if (!isOnline) {
        isOnline = true;
        console.log('🎉 سیستم آنلاین شد');
        
        const realTrash = trashCans.find(trash => trash.isReal);
        if (realTrash && realTrash.status === 'unknown') {
            // اگر وضعیت ناشناخته بود، به خالی تغییر بده
            realTrash.status = 'empty';
            realTrash.fill = 0;
        }
        
        updateAllDisplays(1);
    }
}

// تنظیم وضعیت آفلاین سیستم
function setSystemOffline() {
    if (isOnline) {
        isOnline = false;
        console.log('🔴 سیستم آفلاین شد');
        
        const realTrash = trashCans.find(trash => trash.isReal);
        if (realTrash) {
            realTrash.status = 'unknown';
            realTrash.fill = 0;
            realTrash.distance = 0;
            realTrash.lastUpdate = new Date(); // زمان آفلاین شدن را ثبت کن
        }
        
        updateAllDisplays(1);
    }
}

// آپدیت تمام نمایش‌ها
function updateAllDisplays(activeTrashId = 1) {
    updateMarkers();
    updateTrashList();
    updateOverviewCards();
    updateCurrentTrashDisplay(activeTrashId);
    updateConnectionStatus();
}

// آپدیت مارکرها روی نقشه
function updateMarkers() {
    markers.forEach(markerData => {
        const trash = markerData.trash;
        
        if (trash.isReal) {
            const newIcon = getTrashIcon(trash.status, trash.isReal);
            markerData.marker.setIcon(newIcon);
            updateMarkerPopup(markerData.marker, trash);
        }
    });
}

// آپدیت لیست سطل‌ها
function updateTrashList() {
    const trashList = document.getElementById('trashList');
    if (!trashList) return;
    
    trashList.innerHTML = '';
    
    trashCans.forEach(trash => {
        let statusText, timeText, displayFill, displayDistance, onlineStatus;
        
        if (trash.isReal) {
            statusText = getStatusText(trash.status);
            timeText = trash.lastUpdate ? 
                trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
            displayFill = trash.fill;
            displayDistance = trash.distance;
            onlineStatus = isOnline ? '🟢 آنلاین' : '🔴 آفلاین';
        } else {
            statusText = getStatusText(trash.status);
            timeText = 'دمو';
            displayFill = trash.fill;
            displayDistance = trash.distance;
            onlineStatus = '⚪ دمو';
        }
        
        const statusClass = `state-${trash.status}`;
        const demoClass = trash.isReal ? '' : 'demo';
        
        const trashItem = document.createElement('div');
        trashItem.className = `trash-item ${trash.status} ${demoClass}`;
        trashItem.innerHTML = `
            <div class="trash-header">
                <div class="trash-title">${trash.name}</div>
                <div class="trash-state ${statusClass}">${statusText}</div>
            </div>
            <div class="trash-details">
                <div class="trash-detail">
                    <span>میزان پر:</span>
                    <span>${displayFill}%</span>
                </div>
                <div class="trash-detail">
                    <span>فاصله:</span>
                    <span>${displayDistance}cm</span>
                </div>
                <div class="trash-detail">
                    <span>کد سطل:</span>
                    <span>${trash.id}</span>
                </div>
                <div class="trash-detail">
                    <span>وضعیت:</span>
                    <span>${onlineStatus}</span>
                </div>
                <div class="trash-detail">
                    <span>آخرین بروزرسانی:</span>
                    <span>${timeText}</span>
                </div>
            </div>
        `;
        
        if (trash.isReal) {
            trashItem.addEventListener('click', () => {
                updateCurrentTrashDisplay(trash.id);
            });
        } else {
            trashItem.style.cursor = 'not-allowed';
        }
        
        trashList.appendChild(trashItem);
    });
}

// آپدیت کارت‌های آمار کلی
function updateOverviewCards() {
    const realTrash = trashCans.find(trash => trash.isReal);
    let emptyCount = 0;
    let fullCount = 0;

    if (realTrash) {
        if (realTrash.status === 'empty') emptyCount = 1;
        if (realTrash.status === 'full') fullCount = 1;
    }
    
    const emptyCansElement = document.getElementById('emptyCans');
    const fullCansElement = document.getElementById('fullCans');
    const totalCansElement = document.getElementById('totalCans');
    
    if (emptyCansElement) emptyCansElement.textContent = emptyCount;
    if (fullCansElement) fullCansElement.textContent = fullCount;
    if (totalCansElement) totalCansElement.textContent = trashCans.length;
}

// آپدیت نمایش سطل فعلی
function updateCurrentTrashDisplay(trashId) {
    const trash = trashCans.find(t => t.id === trashId) || trashCans[0];
    
    if (!trash.isReal) return;
    
    const trashNameElement = document.getElementById('trashName');
    const gaugeTextElement = document.getElementById('gaugeText');
    const gaugeFillElement = document.getElementById('gaugeFill');
    const trashDistanceElement = document.getElementById('trashDistance');
    const trashStatusElement = document.getElementById('trashStatus');
    const lastUpdateElement = document.getElementById('lastUpdate');
    
    if (trashNameElement) trashNameElement.textContent = trash.name;
    if (gaugeTextElement) gaugeTextElement.textContent = trash.fill + '%';
    
    if (gaugeFillElement) {
        gaugeFillElement.style.height = trash.fill + '%';
        gaugeFillElement.style.backgroundColor = getStatusColor(trash.status);
    }
    
    if (trashDistanceElement) trashDistanceElement.textContent = trash.distance + ' cm';
    if (trashStatusElement) trashStatusElement.textContent = getStatusText(trash.status);
    if (lastUpdateElement) {
        lastUpdateElement.textContent = 
            trash.lastUpdate ? trash.lastUpdate.toLocaleTimeString('fa-IR') : 'آفلاین';
    }
    
    if (map) {
        map.setView(trash.location, 16);
    }
}

// آپدیت وضعیت ارتباط
function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;
    
    if (isOnline) {
        statusElement.textContent = 'آنلاین';
        statusElement.style.color = '#27ae60';
    } else {
        statusElement.textContent = 'آفلاین';
        statusElement.style.color = '#e74c3c';
    }
}

// گزارش وضعیت سیستم
function logSystemStatus() {
    const now = new Date();
    const uptime = Math.round((now - systemStats.startupTime) / 1000);
    
    console.log('=== 📊 گزارش وضعیت سیستم ===');
    console.log('⏰ زمان راه‌اندازی:', systemStats.startupTime.toLocaleTimeString('fa-IR'));
    console.log('🕒 مدت فعالیت:', uptime, 'ثانیه');
    console.log('📡 وضعیت آنلاین:', isOnline ? '🟢 آنلاین' : '🔴 آفلاین');
    console.log('🔄 آخرین بروزرسانی موفق:', 
        lastSuccessfulUpdate ? new Date(lastSuccessfulUpdate).toLocaleTimeString('fa-IR') : '❌ ندارد');
    console.log('📈 تلاش‌های دریافت:', systemStats.totalFetchAttempts);
    console.log('✅ دریافت‌های موفق:', systemStats.successfulFetches);
    console.log('❌ دریافت‌های ناموفق:', systemStats.failedFetches);
    
    if (lastSuccessfulUpdate) {
        const diff = now.getTime() - lastSuccessfulUpdate;
        console.log(`⏱️ زمان از آخرین بروزرسانی: ${Math.round(diff/1000)} ثانیه`);
    }
    
    if (systemStats.lastError) {
        console.log('🚨 آخرین خطا:', systemStats.lastError);
    }
    
    const realTrash = trashCans.find(trash => trash.isReal);
    if (realTrash) {
        console.log('🗑️ وضعیت سطل واقعی:', realTrash.status, `(${realTrash.fill}%)`);
    }
    
    console.log('========================');
}

// توابع کمکی
function getStatusText(status) {
    switch(status) {
        case 'empty': return 'خالی';
        case 'half': return 'نیمه پر';
        case 'full': return 'پر';
        case 'unknown': return 'آفلاین';
        default: return 'نامشخص';
    }
}

function getStatusColor(status) {
    switch(status) {
        case 'empty': return '#27ae60';
        case 'half': return '#f39c12';
        case 'full': return '#e74c3c';
        case 'unknown': return '#95a5a6';
        default: return '#3498db';
    }
}

// تابع بروزرسانی دستی
function refreshData() {
    console.log('🔄 بروزرسانی دستی...');
    fetchData();
}

// تابع بروزرسانی خودکار
function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn');
    if (!btn) return;
    
    if (autoRefreshInterval) {
        // غیرفعال کردن
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        btn.textContent = '⏰ بروزرسانی خودکار: غیرفعال';
        btn.style.background = '#e74c3c';
        console.log('⏸️ بروزرسانی خودکار غیرفعال شد');
    } else {
        // فعال کردن
        autoRefreshInterval = setInterval(fetchData, UPDATE_TIME);
        btn.textContent = '⏰ بروزرسانی خودکار: فعال';
        btn.style.background = '#27ae60';
        console.log('▶️ بروزرسانی خودکار فعال شد');
    }
}

function startAutoRefresh() {
    // توقف interval قبلی
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // شروع interval جدید
    autoRefreshInterval = setInterval(fetchData, UPDATE_TIME);
}

// راه‌اندازی مجدد سیستم
function restartSystem() {
    console.log('🔄 راه‌اندازی مجدد سیستم...');
    
    // توقف تمام intervalها
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // ریست متغیرها
    isOnline = false;
    lastSuccessfulUpdate = null;
    
    // ریست آمار
    systemStats = {
        totalFetchAttempts: 0,
        successfulFetches: 0,
        failedFetches: 0,
        lastError: null,
        startupTime: new Date()
    };
    
    // راه‌اندازی مجدد
    startAutoRefresh();
    
    console.log('✅ سیستم راه‌اندازی مجدد شد');
}

// راه‌اندازی سیستم
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 شروع سیستم مدیریت سطل زباله هوشمند...');
    
    // مقداردهی اولیه
    initMap();
    updateAllDisplays();
    
    // شروع بروزرسانی خودکار
    startAutoRefresh();
    
    // شروع چک کردن وضعیت آنلاین هر 5 ثانیه
    setInterval(checkSystemOnline, 5000);
    
    // مانیتورینگ سیستم هر 10 ثانیه
    setInterval(logSystemStatus, 10000);
    
    // اولین دریافت داده
    setTimeout(fetchData, 2000);
    
    console.log('✅ سیستم وب آماده به کار است');
});

// مدیریت رویدادهای صفحه
window.addEventListener('beforeunload', function() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
});

// توابع عمومی برای دسترسی از کنسول
window.systemControls = {
    refreshData: fetchData,
    restartSystem: restartSystem,
    getStatus: logSystemStatus,
    checkOnline: checkSystemOnline,
    getStats: () => systemStats
};
