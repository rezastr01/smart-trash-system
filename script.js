// تنظیمات سیستم
const CONFIG = {
    THINGSPEAK_CHANNEL_ID: '3116788',
    THINGSPEAK_API_KEY: 'FOB57VQ57OC6VAP8',
    UPDATE_INTERVAL: 10000, // 10 ثانیه
    AUTO_REFRESH: true
};

// اطلاعات سطل‌های دانشگاه مهارت ملی
const trashCans = [
    {
        id: 1,
        name: 'سطل اصلی دانشگاه',
        location: { lat: 38.043959, lng: 46.268571 },
        description: 'سطل اصلی واقع در محوطه مرکزی دانشگاه',
        status: 'unknown',
        fillPercentage: 0,
        distance: 0,
        lastUpdate: null,
        isOnline: false
    },
    {
        id: 2,
        name: 'سطل محوطه مرکزی',
        location: { lat: 38.044500, lng: 46.269000 },
        description: 'سطل واقع در محوطه مرکزی دانشگاه',
        status: 'unknown',
        fillPercentage: 0,
        distance: 0,
        lastUpdate: null,
        isOnline: false
    },
    {
        id: 3,
        name: 'سطل ورودی شرقی',
        location: { lat: 38.042800, lng: 46.267800 },
        description: 'سطل واقع در ورودی شرقی دانشگاه',
        status: 'unknown',
        fillPercentage: 0,
        distance: 0,
        lastUpdate: null,
        isOnline: false
    }
];

// متغیرهای سیستم
let map;
let markers = [];
let isOnline = false;
let updateCount = 0;
let autoRefreshInterval;
let lastSuccessfulUpdate = null;

// وضعیت‌های سیستم
const STATUS = {
    EMPTY: { text: 'خالی', color: '#27ae60', class: 'empty' },
    HALF: { text: 'نیمه پر', color: '#f39c12', class: 'half' },
    FULL: { text: 'پر', color: '#e74c3c', class: 'full' },
    OFFLINE: { text: 'آفلاین', color: '#95a5a6', class: 'offline' },
    UNKNOWN: { text: 'نامشخص', color: '#3498db', class: 'unknown' }
};

// راه‌اندازی نقشه
function initMap() {
    try {
        // ایجاد نقشه با مرکز دانشگاه مهارت ملی
        map = L.map('map').setView([38.043959, 46.268571], 16);
        
        // اضافه کردن لایه نقشه OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        }).addTo(map);
        
        // ایجاد مارکر برای سطل‌ها
        createTrashMarkers();
        
        console.log('🗺️ نقشه با موفقیت ایجاد شد');
        showNotification('نقشه با موفقیت بارگذاری شد', 'success');
        
    } catch (error) {
        console.error('❌ خطا در ایجاد نقشه:', error);
        showNotification('خطا در بارگذاری نقشه', 'error');
    }
}

// ایجاد مارکرهای سطل‌ها
function createTrashMarkers() {
    trashCans.forEach(trash => {
        const marker = L.marker(trash.location, {
            icon: createTrashIcon(trash.status)
        }).addTo(map);
        
        markers.push({
            id: trash.id,
            marker: marker,
            trash: trash
        });
        
        // آپدیت پاپ‌آپ
        updateMarkerPopup(marker, trash);
        
        // اضافه کردن event برای کلیک روی مارکر
        marker.on('click', function() {
            updateCurrentTrashDisplay(trash.id);
        });
    });
}

// ایجاد آیکون سفارشی برای سطل‌ها
function createTrashIcon(status) {
    const statusConfig = STATUS[status.toUpperCase()] || STATUS.UNKNOWN;
    
    return L.divIcon({
        className: `trash-marker ${statusConfig.class}`,
        html: `
            <div style="
                background: ${statusConfig.color};
                width: 45px;
                height: 45px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 20px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
            " 
            onmouseover="this.style.transform='scale(1.1)'" 
            onmouseout="this.style.transform='scale(1)'"
            title="${statusConfig.text}">
                🗑️
            </div>
        `,
        iconSize: [45, 45],
        iconAnchor: [22, 22]
    });
}

// آپدیت پاپ‌آپ مارکر
function updateMarkerPopup(marker, trash) {
    const statusConfig = STATUS[trash.status.toUpperCase()] || STATUS.UNKNOWN;
    const timeText = trash.lastUpdate ? 
        formatTime(trash.lastUpdate) : 'آفلاین';
    
    const popupContent = `
        <div class="popup-content">
            <div class="popup-header">
                <h3>🗑️ ${trash.name}</h3>
                <span class="status-badge" style="background: ${statusConfig.color}">
                    ${statusConfig.text}
                </span>
            </div>
            <div class="popup-details">
                <div class="popup-row">
                    <span class="popup-label">میزان پر:</span>
                    <span class="popup-value">${trash.fillPercentage}%</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">فاصله:</span>
                    <span class="popup-value">${trash.distance} سانتی‌متر</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">موقعیت:</span>
                    <span class="popup-value coordinates">${trash.location.lat.toFixed(6)}, ${trash.location.lng.toFixed(6)}</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">بروزرسانی:</span>
                    <span class="popup-value">${timeText}</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">وضعیت:</span>
                    <span class="popup-value">${trash.isOnline ? '🟢 آنلاین' : '🔴 آفلاین'}</span>
                </div>
            </div>
            ${trash.description ? `<div class="popup-description">${trash.description}</div>` : ''}
        </div>
    `;
    
    marker.bindPopup(popupContent, {
        className: 'custom-popup',
        maxWidth: 300
    });
}

// دریافت داده از Thingspeak
async function fetchData() {
    try {
        console.log('📡 درحال دریافت داده از Thingspeak...');
        
        const response = await fetch(
            `https://api.thingspeak.com/channels/${CONFIG.THINGSPEAK_CHANNEL_ID}/feeds/last.json?api_key=${CONFIG.THINGSPEAK_API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`خطای HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 داده دریافتی:', data);
        
        if (data && data.field1) {
            isOnline = true;
            lastSuccessfulUpdate = new Date();
            updateCount++;
            await processThingSpeakData(data);
            showNotification('داده با موفقیت دریافت شد', 'success');
        } else {
            throw new Error('داده معتبر دریافت نشد');
        }
        
    } catch (error) {
        console.error('❌ خطا در دریافت داده:', error);
        isOnline = false;
        updateOfflineStatus();
        showNotification('خطا در دریافت داده', 'error');
    }
}

// پردازش داده Thingspeak
function processThingSpeakData(data) {
    const fillPercentage = Math.round(parseFloat(data.field1));
    const distance = parseFloat(data.field2);
    const latitude = parseFloat(data.field3);
    const longitude = parseFloat(data.field4);
    const isFull = parseInt(data.field5) === 1;
    const trashId = parseInt(data.field6) || 1;
    
    // تشخیص وضعیت سطل
    let status;
    if (fillPercentage >= 80 || isFull) {
        status = 'FULL';
    } else if (fillPercentage >= 50) {
        status = 'HALF';
    } else {
        status = 'EMPTY';
    }
    
    // آپدیت سطل مربوطه
    updateTrashCan(trashId, status, fillPercentage, distance, latitude, longitude);
    
    // آپدیت تمام نمایش‌ها
    updateAllDisplays(trashId);
}

// آپدیت اطلاعات سطل
function updateTrashCan(id, status, fillPercentage, distance, lat, lng) {
    const trashIndex = trashCans.findIndex(trash => trash.id === id);
    if (trashIndex !== -1) {
        trashCans[trashIndex].status = status.toLowerCase();
        trashCans[trashIndex].fillPercentage = fillPercentage;
        trashCans[trashIndex].distance = distance;
        trashCans[trashIndex].lastUpdate = new Date();
        trashCans[trashIndex].isOnline = true;
        
        // اگر مختصات جدید ارسال شده
        if (lat && lng) {
            trashCans[trashIndex].location.lat = lat;
            trashCans[trashIndex].location.lng = lng;
        }
    }
}

// آپدیت وضعیت آفلاین
function updateOfflineStatus() {
    trashCans.forEach(trash => {
        trash.status = 'offline';
        trash.isOnline = false;
    });
    updateAllDisplays(1);
}

// آپدیت تمام نمایش‌ها
function updateAllDisplays(activeTrashId = 1) {
    updateMarkers();
    updateTrashList();
    updateOverviewCards();
    updateCurrentTrashDisplay(activeTrashId);
    updateTechnicalInfo();
}

// آپدیت مارکرها روی نقشه
function updateMarkers() {
    markers.forEach(markerData => {
        const trash = markerData.trash;
        const newIcon = createTrashIcon(trash.status);
        markerData.marker.setIcon(newIcon);
        
        // آپدیت موقعیت اگر تغییر کرده
        markerData.marker.setLatLng(trash.location);
        
        // آپدیت پاپ‌آپ
        updateMarkerPopup(markerData.marker, trash);
    });
}

// آپدیت لیست سطل‌ها
function updateTrashList() {
    const trashList = document.getElementById('trashList');
    trashList.innerHTML = '';
    
    trashCans.forEach(trash => {
        const statusConfig = STATUS[trash.status.toUpperCase()] || STATUS.UNKNOWN;
        const timeText = trash.lastUpdate ? formatTime(trash.lastUpdate) : 'آفلاین';
        
        const trashItem = document.createElement('div');
        trashItem.className = `trash-item ${trash.status}`;
        trashItem.innerHTML = `
            <div class="trash-header">
                <div class="trash-info">
                    <div class="trash-name">${trash.name}</div>
                    <div class="trash-description">${trash.description}</div>
                </div>
                <div class="trash-status ${statusConfig.class}" style="background: ${statusConfig.color}">
                    ${statusConfig.text}
                </div>
            </div>
            <div class="trash-details">
                <div class="detail-item">
                    <span class="detail-label">کد سطل:</span>
                    <span class="detail-value">${trash.id}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">میزان پر:</span>
                    <span class="detail-value">${trash.fillPercentage}%</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">فاصله:</span>
                    <span class="detail-value">${trash.distance}cm</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">موقعیت:</span>
                    <span class="detail-value coordinates">${trash.location.lat.toFixed(4)}, ${trash.location.lng.toFixed(4)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">وضعیت:</span>
                    <span class="detail-value">${trash.isOnline ? '🟢 آنلاین' : '🔴 آفلاین'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">آخرین بروزرسانی:</span>
                    <span class="detail-value">${timeText}</span>
                </div>
            </div>
        `;
        
        // اضافه کردن event برای کلیک روی آیتم لیست
        trashItem.addEventListener('click', () => {
            updateCurrentTrashDisplay(trash.id);
        });
        
        trashList.appendChild(trashItem);
    });
}

// آپدیت نمایش سطل فعلی
function updateCurrentTrashDisplay(trashId) {
    const trash = trashCans.find(t => t.id === trashId) || trashCans[0];
    const statusConfig = STATUS[trash.status.toUpperCase()] || STATUS.UNKNOWN;
    
    // آپدیت اطلاعات اصلی
    document.getElementById('trashName').textContent = trash.name;
    document.getElementById('trashId').textContent = trash.id;
    document.getElementById('fillPercentage').textContent = `${trash.fillPercentage}%`;
    document.getElementById('percentageValue').textContent = `${trash.fillPercentage}%`;
    
    // آپدیت نوار پیشرفت
    const fillLevel = document.getElementById('fillLevel');
    fillLevel.style.width = `${trash.fillPercentage}%`;
    fillLevel.style.backgroundColor = statusConfig.color;
    
    // آپدیت وضعیت
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = statusConfig.text;
    statusBadge.style.backgroundColor = statusConfig.color;
    
    // آپدیت سایر اطلاعات
    document.getElementById('distanceValue').textContent = `${trash.distance} سانتی‌متر`;
    document.getElementById('coordinatesValue').textContent = 
        `${trash.location.lat.toFixed(6)}, ${trash.location.lng.toFixed(6)}`;
    document.getElementById('lastUpdateValue').textContent = 
        trash.lastUpdate ? formatTime(trash.lastUpdate) : 'آفلاین';
    
    // مرکز کردن نقشه روی سطل انتخاب شده
    if (map) {
        map.setView([trash.location.lat, trash.location.lng], 16);
    }
}

// آپدیت کارت‌های آمار کلی
function updateOverviewCards() {
    document.getElementById('onlineStatus').textContent = isOnline ? '🟢 آنلاین' : '🔴 آفلاین';
    document.getElementById('onlineStatus').style.color = isOnline ? '#27ae60' : '#e74c3c';
    
    const emptyCount = trashCans.filter(trash => trash.status === 'empty').length;
    const fullCount = trashCans.filter(trash => trash.status === 'full').length;
    
    document.getElementById('emptyTrashCans').textContent = emptyCount;
    document.getElementById('fullTrashCans').textContent = fullCount;
    document.getElementById('totalTrashCans').textContent = trashCans.length;
}

// آپدیت اطلاعات فنی
function updateTechnicalInfo() {
    document.getElementById('connectionStatus').textContent = isOnline ? 'متصل' : 'قطع';
    document.getElementById('connectionStatus').style.color = isOnline ? '#27ae60' : '#e74c3c';
    
    document.getElementById('dataUsage').textContent = isOnline ? 
        `${updateCount} درخواست موفق` : 'قطع ارتباط';
    
    document.getElementById('updateCount').textContent = updateCount;
    
    // محاسبه زمان فعالیت
    const uptimeElement = document.getElementById('uptime');
    if (lastSuccessfulUpdate) {
        const uptime = Math.floor((new Date() - lastSuccessfulUpdate) / 1000);
        uptimeElement.textContent = formatUptime(uptime);
    } else {
        uptimeElement.textContent = 'آفلاین';
    }
}

// توابع utility
function formatTime(date) {
    return date.toLocaleTimeString('fa-IR');
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showNotification(message, type = 'info') {
    // ایجاد نوتیفیکیشن موقت در کنسول
    console.log(`🔔 ${type.toUpperCase()}: ${message}`);
}

function refreshData() {
    console.log('🔄 بروزرسانی دستی داده‌ها...');
    showNotification('درحال بروزرسانی داده‌ها...', 'info');
    fetchData();
}

function toggleAutoRefresh() {
    CONFIG.AUTO_REFRESH = !CONFIG.AUTO_REFRESH;
    const btn = document.getElementById('autoRefreshBtn');
    
    if (CONFIG.AUTO_REFRESH) {
        startAutoRefresh();
        btn.textContent = '⏰ بروزرسانی خودکار: فعال';
        btn.style.background = '#27ae60';
        showNotification('بروزرسانی خودکار فعال شد', 'success');
    } else {
        stopAutoRefresh();
        btn.textContent = '⏰ بروزرسانی خودکار: غیرفعال';
        btn.style.background = '#e74c3c';
        showNotification('بروزرسانی خودکار غیرفعال شد', 'warning');
    }
}

function startAutoRefresh() {
    stopAutoRefresh(); // توقف interval قبلی
    autoRefreshInterval = setInterval(fetchData, CONFIG.UPDATE_INTERVAL);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// راه‌اندازی سیستم
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 شروع سیستم مدیریت سطل زباله هوشمند...');
    
    // مقداردهی اولیه
    initMap();
    updateAllDisplays();
    
    // شروع بروزرسانی خودکار
    startAutoRefresh();
    
    // اولین دریافت داده
    setTimeout(fetchData, 2000);
    
    console.log('✅ سیستم وب آماده به کار است');
    showNotification('سیستم با موفقیت راه‌اندازی شد', 'success');
});

// مدیریت رویدادهای صفحه
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
    console.log('🛑 توقف سیستم...');
});
